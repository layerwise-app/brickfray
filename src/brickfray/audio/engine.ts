import type * as THREE from 'three';
import type { MapId } from '../world/types';
import { Ambience } from './ambience';
import { Announcer } from './announcer';
import { CATEGORIES, inverseGain, type Category } from './catalog';
import { applyMix, busInput, createMixer, outputPeak, setRoom, type Mixer } from './mixer';
import { MATCH_TRACKS } from './music';
import { MusicPlayer } from './music-player';
import { audibility, behind, OCCLUDED, place } from './positional';
import { renderBank, yieldToMain } from './render';
import { ROOMS } from './rooms';
import { SOUNDS } from './sounds';
import { loadSpace, neutralSpace, roomAt, roomSpace } from './space';
import type { AudioEngine, AudioMix, HeldSound, MusicTrack, PlayOptions, SoundId } from './types';
import { VariantPicker } from './variants';
import { VoicePool } from './voices';

export const DEFAULT_MIX: AudioMix = { master: 0.9, effects: 0.85, music: 0.6, ui: 0.8 };

/** Voices playing at once; a plaza firefight with six players, debris and gear layers peaks near 50. */
export const VOICES = 64;

/** How much of a sound `distance` m away is its distant recording: 0 up to `blend.from`, 1 past `blend.to`. */
export function farShare(distance: number, blend: Blend = FAR_BLEND): number {
  return Math.min(Math.max((distance - blend.from) / (blend.to - blend.from), 0), 1);
}

/** The distant recording of a sound that has one, and the distances (m) over which it takes over. */
export function distantOf(id: SoundId): { id: SoundId; blend: Blend } | null {
  if (id.startsWith('fire:')) return { id: id.replace('fire:', 'fireFar:') as SoundId, blend: FAR_BLEND };
  if (id === 'explosion') return { id: 'explosionFar', blend: BOOM_BLEND };
  return null;
}

interface Blend {
  from: number;
  to: number;
}

export function createAudioEngine(): AudioEngine {
  return new WebAudioEngine();
}

/** A gunshot cross-fades from its near to its distant recording over this range of distances (m); a blast further out. */
const FAR_BLEND: Blend = { from: 20, to: 40 };
const BOOM_BLEND: Blend = { from: 30, to: 70 };
const SPEED_OF_SOUND = 343;
const MAX_DELAY = 0.35;
/** Loud enough to be heard from far away, so they arrive late by their distance. */
const TRAVELS: ReadonlySet<Category> = new Set<Category>(['gun', 'gunFar', 'boom']);
/** A held sound's file carries this much (s) of its loop's other end before and after it: the loader fades both ends of every file. */
export const HELD_MARGIN = 0.05;
/** Sounds of a fight that the music ducks under (music-player.ts DUCK). */
const DUCKS: ReadonlySet<Category> = new Set<Category>(['gun', 'boom', 'player']);

interface Voice {
  source: AudioBufferSourceNode;
  amp: GainNode;
  nodes: AudioNode[];
}

export interface EngineDebug {
  state: AudioContextState | 'locked';
  voices: number;
  sounds: number;
  totalSounds: number;
  music: MusicTrack[];
  renderMs: number | null;
  /** Output peak over the last ~40 ms, after the limiter. */
  outputPeak: number;
}

export class WebAudioEngine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private graph: Mixer | null = null;
  private ready: Promise<void> | null = null;
  private readonly bank = new Map<SoundId, AudioBuffer[]>();
  private readonly music = new MusicPlayer();
  private ambience: Ambience | null = null;
  private announcer: Announcer | null = null;
  private scene: MapId | null = null;
  private readonly pool = new VoicePool<Voice>(VOICES);
  private readonly variants = new VariantPicker();
  private room = 0;
  /** Which of the map's rooms the room reverb holds. */
  private roomIndex = 0;
  private readonly listener = { x: 0, y: 0, z: 0 };
  private readonly forward = { x: 0, y: 0, z: -1 };
  private mix: AudioMix = { ...DEFAULT_MIX };
  private muffle = 0;
  private suspended = false;
  private disposed = false;
  private renderMs: number | null = null;

  unlock(): Promise<void> {
    if (this.ready) {
      if (!this.suspended) void this.ctx?.resume();
      return this.ready;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    void ctx.resume();
    this.ready = this.prepare(ctx);
    return this.ready;
  }

  /** Everything after context creation runs in later tasks so the click handler returns fast. */
  private async prepare(ctx: AudioContext): Promise<void> {
    await yieldToMain();
    if (this.disposed) return;
    this.graph = createMixer(ctx);
    this.ambience = new Ambience(ctx, this.graph.effectsIn);
    this.applyMix();
    this.music.attach(ctx, this.graph.music);
    this.announcer = new Announcer(ctx, busInput(this.graph, 'marker'), (seconds) => this.music.duck(seconds));
    this.syncScene();
    const started = performance.now();
    await renderBank({
      sampleRate: ctx.sampleRate,
      cancelled: () => this.disposed,
      onSound: (id, sound) => this.bank.set(id, sound.buffers)
    });
    this.renderMs = performance.now() - started;
    this.music.prefetch(MATCH_TRACKS);
  }

  play(id: SoundId, options: PlayOptions = {}): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph || this.disposed || this.suspended) return;
    const pos = options.position;
    if (!pos) {
      this.voice(ctx, graph, id, options, 1, 0, 0);
      return;
    }
    const l = this.listener;
    const distance = Math.hypot(pos.x - l.x, pos.y - l.y, pos.z - l.z);
    const travel = TRAVELS.has(SOUNDS[id].category) ? Math.min(distance / SPEED_OF_SOUND, MAX_DELAY) : 0;
    const distant = distantOf(id);
    if (!distant) {
      this.voice(ctx, graph, id, options, 1, distance, travel);
      return;
    }
    const far = farShare(distance, distant.blend);
    if (far < 1) this.voice(ctx, graph, id, options, Math.cos((far * Math.PI) / 2), distance, travel);
    if (far > 0) this.voice(ctx, graph, distant.id, options, Math.sin((far * Math.PI) / 2), distance, travel);
  }

  hold(id: SoundId, options: PlayOptions = {}): HeldSound | null {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph || this.disposed || this.suspended) return null;
    const pos = options.position;
    const l = this.listener;
    const voice = this.voice(ctx, graph, id, options, 1, pos ? Math.hypot(pos.x - l.x, pos.y - l.y, pos.z - l.z) : 0, 0, true);
    if (!voice) return null;
    const base = voice.amp.gain.value;
    return {
      stop: (fade = 0.12) => {
        const now = ctx.currentTime;
        voice.amp.gain.cancelScheduledValues(now);
        voice.amp.gain.setTargetAtTime(0, now, fade / 3);
        voice.source.stop(now + fade + 0.05);
      },
      level: (volume) => voice.amp.gain.setTargetAtTime(base * volume, ctx.currentTime, 0.04)
    };
  }

  private voice(ctx: AudioContext, graph: Mixer, sound: SoundId, options: PlayOptions, blend: number, distance: number, travel: number, loop = false): Voice | null {
    const buffers = this.bank.get(sound);
    if (!buffers?.length) return null;
    const pos = options.position;
    const cat = CATEGORIES[SOUNDS[sound].category];
    const occlusion = pos ? Math.min(Math.max(options.occlusion ?? 0, 0), 1) : 0;
    const volume = (options.volume ?? 1) * blend * (1 - (1 - OCCLUDED.gain) * occlusion);
    const offset = options.offset ?? 0;
    const fade = pos ? audibility((SOUNDS[sound].loudness ?? cat.loudness) + 20 * Math.log10(Math.max(volume * inverseGain(cat.falloff, distance), 1e-6))) : 1;
    if (fade <= 0) return null;
    const now = ctx.currentTime;
    const start = now + travel + Math.max(options.delay ?? 0, 0);
    const buffer = buffers[options.variant === undefined ? this.variants.pick(sound, buffers.length) : Math.min(options.variant, buffers.length - 1)]!;
    if (offset >= buffer.duration) return null;
    const rate = (options.rate ?? 1) * (1 + (Math.random() * 2 - 1) * cat.jitter);
    const level = 10 ** (((Math.random() * 2 - 1) * (cat.levelJitter ?? 0)) / 20);
    const key = options.source === undefined ? sound : `${sound}#${options.source}`;
    // A fading voice yields to a full one up to two priorities below it.
    const priority = (options.priority ?? cat.priority) - 2 * (1 - fade);
    const admission = this.pool.admit(key, priority, start, now, cat.burst);
    if (!admission) return null;
    if (admission.evicted) this.stopVoice(admission.evicted, now);
    if (DUCKS.has(SOUNDS[sound].category) && volume * fade > 0.3) this.music.duck();

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = loop;
    if (loop) {
      source.loopStart = HELD_MARGIN;
      source.loopEnd = buffer.duration - HELD_MARGIN;
    }
    const amp = ctx.createGain();
    amp.gain.value = volume * fade * admission.gain * level;
    source.connect(amp);
    const nodes: AudioNode[] = [source, amp];
    let out: AudioNode = amp;
    if (pos) {
      const tone = Math.min(Math.max(options.tone ?? 1, 0), 1);
      const placed = place(ctx, amp, { pos, distance, occlusion, tone, rear: behind(this.listener, this.forward, pos), falloff: cat.falloff });
      nodes.push(...placed);
      out = placed[placed.length - 1]!;
    }
    const bus = pos ? 'effects' : cat.bus;
    out.connect(busInput(graph, bus));
    if (cat.reverb > 0 && bus !== 'ui') {
      const send = ctx.createGain();
      send.gain.value = cat.reverb * Math.min(1 + distance / 25, 1.8);
      out.connect(send).connect(graph.reverb);
      nodes.push(send);
    }
    if (!pos && cat.near) {
      const send = ctx.createGain();
      send.gain.value = cat.near;
      out.connect(send).connect(graph.near);
      nodes.push(send);
    }
    const voice: Voice = { source, amp, nodes };
    source.onended = () => {
      for (const n of nodes) n.disconnect();
      this.pool.remove(voice);
    };
    source.start(start, offset);
    this.pool.add({ handle: voice, key, priority, start, end: loop ? Infinity : start + (buffer.duration - offset) / rate });
    return voice;
  }

  setListener(position: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3): void {
    this.listener.x = position.x;
    this.listener.y = position.y;
    this.listener.z = position.z;
    this.forward.x = forward.x;
    this.forward.y = forward.y;
    this.forward.z = forward.z;
    const { index, amount: room } = roomAt(this.scene, position.x, position.y, position.z);
    if (this.ctx && this.graph && this.scene && index >= 0 && index !== this.roomIndex) {
      this.roomIndex = index;
      this.graph.room.buffer = roomSpace(this.ctx, this.scene, index);
    }
    if (Math.abs(room - this.room) > 0.02 || (room !== this.room && (room === 0 || room === 1))) {
      this.room = room;
      const def = this.scene ? ROOMS[this.scene][this.roomIndex] : undefined;
      if (this.ctx && this.graph) setRoom(this.ctx, this.graph, room, def?.outdoor);
      this.ambience?.setRoom(room, def?.bed);
    }
    const l = this.ctx?.listener;
    if (!l) return;
    if (l.positionX) {
      l.positionX.value = position.x;
      l.positionY.value = position.y;
      l.positionZ.value = position.z;
      l.forwardX.value = forward.x;
      l.forwardY.value = forward.y;
      l.forwardZ.value = forward.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else {
      l.setPosition(position.x, position.y, position.z);
      l.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  setMix(mix: AudioMix): void {
    this.mix = { ...mix };
    this.applyMix();
  }

  setMuffle(amount: number): void {
    this.muffle = Math.min(Math.max(amount, 0), 1);
    this.applyMix();
  }

  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    if (!this.ctx || this.ctx.state === 'closed') return;
    void (suspended ? this.ctx.suspend() : this.ctx.resume());
  }

  playMusic(track: MusicTrack | null, level = 1, delay = 0): void {
    this.music.set(track, level, delay);
  }

  announce(count: number): void {
    if (!this.disposed && !this.suspended) this.announcer?.say(count);
  }

  setScene(map: MapId | null): void {
    if (map === this.scene) return;
    this.scene = map;
    this.syncScene();
  }

  dispose(): void {
    this.disposed = true;
    this.pool.clear();
    this.bank.clear();
    this.music.clear();
    this.ambience?.dispose();
    this.ambience = null;
    this.announcer = null;
    void this.ctx?.close();
    this.ctx = null;
    this.graph = null;
  }

  debug(): EngineDebug {
    return {
      state: this.ctx?.state ?? 'locked',
      voices: this.pool.size,
      sounds: this.bank.size,
      totalSounds: Object.keys(SOUNDS).length,
      music: this.music.loaded,
      renderMs: this.renderMs,
      outputPeak: this.graph ? outputPeak(this.graph) : 0
    };
  }

  private stopVoice(voice: Voice, now: number): void {
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setTargetAtTime(0, now, 0.008);
    voice.source.stop(now + 0.05);
  }

  private applyMix(): void {
    if (this.ctx && this.graph) applyMix(this.ctx, this.graph, this.mix, this.muffle);
  }

  private syncScene(): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const map = this.scene;
    this.ambience?.set(map);
    if (map) void this.announcer?.prefetch();
    this.roomIndex = 0;
    graph.room.buffer = map ? roomSpace(ctx, map) : null;
    if (!map) {
      graph.space.buffer = neutralSpace(ctx);
      return;
    }
    void loadSpace(ctx, map).then((space) => {
      if (this.scene === map && this.graph === graph) graph.space.buffer = space;
    });
  }
}
