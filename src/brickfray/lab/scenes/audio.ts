import * as THREE from 'three';
import { CATEGORIES } from '../../audio/catalog';
import { DEFAULT_MIX, WebAudioEngine } from '../../audio/engine';
import { analyzeAll, analyzeMusic, plotMusic, plotSound } from '../../audio/inspect';
import { SOUNDS, SOUND_IDS } from '../../audio/sounds';
import type { AudioMix, MusicTrack, SoundId } from '../../audio/types';
import { buildGround } from '../../engine/ground';
import { partGeometry } from '../../engine/geometry';
import { PLASTIC } from '../../engine/palette';
import type { LabContext } from '../types';

const GROUPS: readonly [string, (id: SoundId) => boolean][] = [
  ['Guns', (id) => id.startsWith('fire') || id === 'dryFire'],
  ['Reload & handling', (id) => id.startsWith('cue:')],
  ['Footsteps & movement', (id) => id.startsWith('step:') || ['jump', 'land', 'slide'].includes(id)],
  ['Impacts', (id) => id.startsWith('impact') || ['malletHit', 'malletMiss', 'grenadeBounce'].includes(id)],
  ['Feedback', (id) => ['hitmarker', 'headshotMarker', 'killConfirm', 'hurt', 'death', 'heartbeat', 'respawn'].includes(id)],
  ['Debris & FX', (id) => ['shatter', 'brickClatter', 'casing', 'shell', 'explosion', 'explosionFar'].includes(id) || id.startsWith('whiz') || id.startsWith('spot:')],
  ['UI & match', (id) => SOUNDS[id].category === 'ui' || SOUNDS[id].category === 'stinger']
];

const CSS = `
.bfa{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);overflow:auto;background:rgba(16,20,24,.92);color:#e8eef2;font:13px/1.35 system-ui,sans-serif;padding:14px 14px 40px;box-sizing:border-box;z-index:10}
.bfa h2{font-size:15px;margin:0 0 8px}.bfa h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#9fb0bc;margin:14px 0 6px}
.bfa .row{display:flex;flex-wrap:wrap;gap:5px}.bfa button{background:#26313a;color:#e8eef2;border:1px solid #3a4a56;border-radius:6px;padding:4px 8px;font:inherit;cursor:pointer}
.bfa button:hover{background:#334250}.bfa button.on{background:#1f62c7;border-color:#3b8cff}.bfa .unlock{background:#c8231b;border-color:#ff6f61;font-weight:600;padding:8px 14px}
.bfa label{display:grid;grid-template-columns:90px 1fr 44px;align-items:center;gap:8px;margin:3px 0}.bfa input[type=range]{width:100%}
.bfa .status{font-family:ui-monospace,monospace;font-size:11px;color:#9fb0bc;margin-top:6px;white-space:pre}`;

/** Audition every sound, the music, the mix and positional playback. */
export default function setup(ctx: LabContext) {
  const { scene, camera, controls, renderer: gr } = ctx;
  scene.add(buildGround([{ x0: -40, z0: -80, x1: 40, z1: 20, y: 0, color: PLASTIC.green }], gr.profile));
  const marker = new THREE.Mesh(partGeometry({ w: 2, d: 2, h: 3 }, gr.profile), gr.materials.get(PLASTIC.red));
  scene.add(marker);
  camera.position.set(0, 1.7, 4);
  controls.target.set(0, 1.5, 0);

  const engine = new WebAudioEngine();
  const mix: AudioMix = { ...DEFAULT_MIX };
  const place = { positional: false, distance: 10, angle: 0 };
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3();
  const sourcePos = new THREE.Vector3();

  const style = document.createElement('style');
  style.textContent = CSS;
  const panel = document.createElement('div');
  panel.className = 'bfa';
  document.head.appendChild(style);
  document.body.appendChild(panel);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, text = '') => {
    const node = document.createElement(tag);
    node.textContent = text;
    parent.appendChild(node);
    return node;
  };
  el('h2', panel, 'Brickfray audio lab');
  const unlock = el('button', panel, 'Unlock audio');
  unlock.className = 'unlock';
  unlock.onclick = () => {
    void engine.unlock();
    unlock.textContent = 'Audio unlocked';
  };
  const status = el('div', panel);
  status.className = 'status';

  el('h3', panel, 'Music');
  const musicRow = el('div', panel);
  musicRow.className = 'row';
  const musicButtons: HTMLButtonElement[] = [];
  for (const track of ['menu', 'match', null] as (MusicTrack | null)[]) {
    const b = el('button', musicRow, track ?? 'stop');
    musicButtons.push(b);
    b.onclick = () => {
      engine.playMusic(track);
      musicButtons.forEach((m) => m.classList.toggle('on', m === b && track !== null));
    };
  }

  el('h3', panel, 'Mix');
  const slider = (label: string, min: number, max: number, value: number, step: number, set: (v: number) => void) => {
    const row = el('label', panel);
    el('span', row, label);
    const input = el('input', row);
    const out = el('span', row, String(value));
    Object.assign(input, { type: 'range', min, max, step, value: String(value) });
    input.oninput = () => {
      set(Number(input.value));
      out.textContent = input.value;
    };
  };
  for (const key of ['master', 'effects', 'music', 'ui'] as (keyof AudioMix)[]) {
    slider(key, 0, 1, mix[key], 0.05, (v) => {
      mix[key] = v;
      engine.setMix(mix);
    });
  }
  slider('muffle', 0, 1, 0, 0.05, (v) => engine.setMuffle(v));

  el('h3', panel, 'Placement');
  const posRow = el('div', panel);
  posRow.className = 'row';
  const mode2d = el('button', posRow, '2D (own player)');
  const mode3d = el('button', posRow, '3D at red brick');
  const setMode = (positional: boolean) => {
    place.positional = positional;
    mode2d.classList.toggle('on', !positional);
    mode3d.classList.toggle('on', positional);
  };
  mode2d.onclick = () => setMode(false);
  mode3d.onclick = () => setMode(true);
  setMode(false);
  slider('distance m', 1, 90, place.distance, 1, (v) => (place.distance = v));
  slider('angle °', -180, 180, place.angle, 5, (v) => (place.angle = v));

  const play = (id: SoundId) => engine.play(id, place.positional ? { position: sourcePos } : {});
  for (const [title, match] of GROUPS) {
    el('h3', panel, title);
    const row = el('div', panel);
    row.className = 'row';
    for (const id of SOUND_IDS.filter(match)) {
      const b = el('button', row, id);
      b.title = `${SOUNDS[id].category} · priority ${CATEGORIES[SOUNDS[id].category].priority}`;
      b.onclick = () => play(id);
    }
  }
  el('h3', panel, 'Stress');
  const stressRow = el('div', panel);
  stressRow.className = 'row';
  el('button', stressRow, '8 pellet impacts').onclick = () => {
    for (let i = 0; i < 8; i++) engine.play('impact:plastic', place.positional ? { position: sourcePos } : {});
  };
  el('button', stressRow, '40 voices').onclick = () => voiceFlood();
  el('button', stressRow, 'AR burst').onclick = () => {
    for (let i = 0; i < 10; i++) setTimeout(() => play('fire:ar'), i * 91);
  };

  /** 40 different sounds at mixed priorities, then a high-priority shot: the pool must stay at 32. */
  function voiceFlood() {
    const ids = SOUND_IDS.filter((id) => SOUNDS[id].category !== 'ui').slice(0, 40);
    ids.forEach((id, i) => engine.play(id, { priority: i % 10 }));
    engine.play('fire:sniper', { priority: 10 });
    return engine.debug().voices;
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const peakOver = async (ms: number) => {
    let peak = 0;
    for (let t = 0; t < ms; t += 20) {
      peak = Math.max(peak, engine.debug().outputPeak);
      await wait(20);
    }
    return peak;
  };

  /** Drives the live engine: every sound 2D and 3D, limiter under a volley, music, muffle, suspend. */
  async function smoke() {
    await engine.unlock();
    const errors: string[] = [];
    const far = { x: 0, y: 1, z: -60 };
    for (const id of SOUND_IDS) {
      try {
        engine.play(id, { volume: 0.05 });
        engine.play(id, { position: far, volume: 0.05 });
      } catch (e) {
        errors.push(`${id}: ${String(e)}`);
      }
    }
    await wait(3500);
    const quiet = await peakOver(200);
    for (const id of ['fire:ar', 'fire:shotgun', 'fire:sniper', 'fire:pistol', 'explosion'] as SoundId[]) {
      engine.play(id);
      engine.play(id, { position: { x: 1, y: 1, z: -3 } });
    }
    const volley = await peakOver(600);
    await wait(3000);
    engine.play('fire:ar');
    const single = await peakOver(300);
    await wait(1200);
    engine.playMusic('menu');
    await wait(2500);
    const music = await peakOver(1000);
    engine.setMuffle(1);
    engine.playMusic('match');
    await wait(2500);
    const matchMusic = await peakOver(800);
    engine.setMuffle(0);
    engine.playMusic(null);
    await wait(1500);
    const afterStop = await peakOver(200);
    engine.setSuspended(true);
    await wait(200);
    const suspended = engine.debug().state;
    engine.setSuspended(false);
    await wait(200);
    return { errors, quiet, volley, single, music, matchMusic, afterStop, suspended, resumed: engine.debug().state, debug: engine.debug() };
  }

  ctx.onFrame(() => {
    camera.getWorldDirection(forward);
    up.copy(camera.up).applyQuaternion(camera.quaternion);
    engine.setListener(camera.position, forward, up);
    const flat = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    flat.applyAxisAngle(new THREE.Vector3(0, 1, 0), (-place.angle * Math.PI) / 180);
    sourcePos.copy(camera.position).addScaledVector(flat, place.distance).setY(1.2);
    marker.position.set(sourcePos.x, 0, sourcePos.z);
    const d = engine.debug();
    status.textContent = `context ${d.state} · sounds ${d.sounds}/${d.totalSounds} · music ${d.music.join(',') || '–'} · voices ${d.voices}${
      d.renderMs ? ` · rendered in ${(d.renderMs / 1000).toFixed(1)} s` : ''
    }`;
  });

  return {
    api: {
      analyze: async () => [...(await analyzeAll()), await analyzeMusic('menu'), await analyzeMusic('match')],
      plot: (id: unknown) => plotSound(id as SoundId),
      plotMusic: (track: unknown) => plotMusic(track as MusicTrack),
      debug: () => engine.debug(),
      play: (id: unknown) => play(id as SoundId),
      voiceFlood,
      smoke: () => smoke(),
      /** Unlock outside a gesture and time the render, recording main-thread stalls. */
      unlockTiming: async () => {
        const longTasks: number[] = [];
        const observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => longTasks.push(e.duration)));
        try {
          observer.observe({ type: 'longtask', buffered: false });
        } catch {
          /* longtask entries unsupported */
        }
        let last = performance.now();
        let maxGap = 0;
        const probe = setInterval(() => {
          const now = performance.now();
          maxGap = Math.max(maxGap, now - last);
          last = now;
        }, 4);
        const t0 = performance.now();
        const pending = engine.unlock();
        const syncMs = performance.now() - t0;
        let firstSound = 0;
        const firstProbe = setInterval(() => {
          if (!firstSound && engine.debug().sounds > 0) firstSound = performance.now() - t0;
        }, 2);
        await pending;
        clearInterval(probe);
        clearInterval(firstProbe);
        observer.disconnect();
        return { ms: performance.now() - t0, syncMs, firstSoundMs: firstSound, maxGap, longTasks, debug: engine.debug() };
      }
    },
    dispose() {
      engine.dispose();
      panel.remove();
      style.remove();
    }
  };
}
