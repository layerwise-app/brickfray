import type * as THREE from 'three';
import { CATEGORIES, FALLOFF, inverseGain } from './catalog';
import { applyMix, createMixer, outputPeak, type Mixer } from './mixer';
import { renderBank, yieldToMain } from './render';
import { SOUNDS } from './sounds';
import type { AudioEngine, AudioMix, MusicTrack, PlayOptions, SoundId } from './types';
import { VoicePool } from './voices';

export const DEFAULT_MIX: AudioMix = { master: 0.9, effects: 0.85, music: 0.6, ui: 0.8 };

export function createAudioEngine(): AudioEngine {
  return new WebAudioEngine();
}

/** Shots farther than this switch to the distant recipe and arrive late. */
const FAR_SHOT = 25;
const SPEED_OF_SOUND = 343;
const MAX_DELAY = 0.35;
/** Positional sounds quieter than this after distance attenuation are skipped. */
const CULL = 0.004;

interface Voice {
  source: AudioBufferSourceNode;
  amp: GainNode;
  nodes: AudioNode[];
}

interface MusicVoice {
  track: MusicTrack;
  source: AudioBufferSourceNode;
  gain: GainNode;
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
  private readonly tracks = new Map<MusicTrack, AudioBuffer>();
  private readonly pool = new VoicePool<Voice>(32);
  private readonly lastVariant = new Map<SoundId, number>();
  private readonly listener = { x: 0, y: 0, z: 0 };
  private mix: AudioMix = { ...DEFAULT_MIX };
  private muffle = 0;
  private suspended = false;
  private disposed = false;
  private wantMusic: MusicTrack | null = null;
  private current: MusicVoice | null = null;
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
    this.applyMix();
    this.syncMusic();
    const started = performance.now();
    await renderBank({
      sampleRate: ctx.sampleRate,
      cancelled: () => this.disposed,
      onSound: (id, sound) => this.bank.set(id, sound.buffers),
      onMusic: (track, buffer) => {
        this.tracks.set(track, buffer);
        this.syncMusic();
      }
    });
    this.renderMs = performance.now() - started;
  }

  play(id: SoundId, options: PlayOptions = {}): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph || this.disposed || this.suspended) return;
    const pos = options.position;
    let sound = id;
    let delay = 0;
    let distance = 0;
    if (pos) {
      const l = this.listener;
      distance = Math.hypot(pos.x - l.x, pos.y - l.y, pos.z - l.z);
      if (sound.startsWith('fire:') && distance > FAR_SHOT) sound = sound.replace('fire:', 'fireFar:') as SoundId;
      if (sound.startsWith('fireFar:')) delay = Math.min(distance / SPEED_OF_SOUND, MAX_DELAY);
    }
    const buffers = this.bank.get(sound);
    if (!buffers?.length) return;
    const cat = CATEGORIES[SOUNDS[sound].category];
    const volume = options.volume ?? 1;
    if (pos && volume * inverseGain(cat.falloff, distance) < CULL) return;
    const now = ctx.currentTime;
    const start = now + delay;
    const buffer = this.pickVariant(sound, buffers);
    const rate = (options.rate ?? 1) * (1 + (Math.random() * 2 - 1) * cat.jitter);
    const admission = this.pool.admit(sound, options.priority ?? cat.priority, start, now, cat.burst);
    if (!admission) return;
    if (admission.evicted) this.stopVoice(admission.evicted, now);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const amp = ctx.createGain();
    amp.gain.value = volume * admission.gain;
    source.connect(amp);
    const nodes: AudioNode[] = [source, amp];
    let out: AudioNode = amp;
    if (pos) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = -3;
      lp.frequency.value = 18000 / (1 + distance / 12);
      const panner = this.makePanner(ctx, cat.falloff, pos);
      amp.connect(lp).connect(panner);
      nodes.push(lp, panner);
      out = panner;
    }
    out.connect(cat.bus === 'ui' ? graph.ui : graph.effectsIn);
    if (cat.reverb > 0 && cat.bus === 'effects') {
      const send = ctx.createGain();
      send.gain.value = cat.reverb * Math.min(1 + distance / 15, 3);
      out.connect(send).connect(graph.reverb);
      nodes.push(send);
    }
    const voice: Voice = { source, amp, nodes };
    source.onended = () => {
      for (const n of nodes) n.disconnect();
      this.pool.remove(voice);
    };
    source.start(start);
    this.pool.add({ handle: voice, key: sound, priority: options.priority ?? cat.priority, start, end: start + buffer.duration / rate });
  }

  setListener(position: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3): void {
    this.listener.x = position.x;
    this.listener.y = position.y;
    this.listener.z = position.z;
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

  playMusic(track: MusicTrack | null): void {
    this.wantMusic = track;
    this.syncMusic();
  }

  dispose(): void {
    this.disposed = true;
    this.pool.clear();
    this.bank.clear();
    this.tracks.clear();
    this.current = null;
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
      music: [...this.tracks.keys()],
      renderMs: this.renderMs,
      outputPeak: this.graph ? outputPeak(this.graph) : 0
    };
  }

  /** Random variant, never the same one twice in a row. */
  private pickVariant(id: SoundId, buffers: AudioBuffer[]): AudioBuffer {
    const last = this.lastVariant.get(id) ?? -1;
    let i = Math.floor(Math.random() * buffers.length);
    if (buffers.length > 1 && i === last) i = (i + 1) % buffers.length;
    this.lastVariant.set(id, i);
    return buffers[i]!;
  }

  private makePanner(ctx: AudioContext, falloff: keyof typeof FALLOFF, pos: { x: number; y: number; z: number }): PannerNode {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = FALLOFF[falloff].ref;
    p.rolloffFactor = FALLOFF[falloff].rolloff;
    p.maxDistance = 10000;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
    return p;
  }

  private stopVoice(voice: Voice, now: number): void {
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setTargetAtTime(0, now, 0.008);
    voice.source.stop(now + 0.05);
  }

  private applyMix(): void {
    if (this.ctx && this.graph) applyMix(this.ctx, this.graph, this.mix, this.muffle);
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph || this.current?.track === this.wantMusic) return;
    const want = this.wantMusic;
    const buffer = want ? this.tracks.get(want) : null;
    if (want && !buffer && this.current === null) return;
    const now = ctx.currentTime;
    if (this.current) {
      const { gain, source } = this.current;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.2);
      source.stop(now + 1.3);
      source.onended = () => gain.disconnect();
      this.current = null;
    }
    if (!want || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 1.5);
    source.connect(gain).connect(graph.music);
    source.start(now);
    this.current = { track: want, source, gain };
  }
}
