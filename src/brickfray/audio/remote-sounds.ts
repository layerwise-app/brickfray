import type { RemoteSnapshotPlayer } from '../net/codec';
import { WEAPONS, type WeaponId } from '../weapons/defs';
import { loadsShells, reloadClip } from '../weapons/view/clips-guns';
import type { Ears, Vec3 } from './bullet-sounds';
import { handlingSound } from './foley';
import { reloadLayers } from './reload-layers';
import type { AudioEngine, HandlingCue, PlayOptions, SoundId } from './types';

/** Reload cues heard from another player (cloth rustles are too faint to carry). */
const RELOAD_CUES: ReadonlySet<string> = new Set<HandlingCue>(['magOut', 'magIn', 'boltBack', 'boltForward', 'pumpBack', 'pumpForward', 'shellIn', 'slideBack', 'slideForward']);
/** Where a shell goes in during each shell cycle of a shotgun reload (clips-shotgun.ts shotgunShell: 0.3 of 0.5 s). */
const SHELL_AT = 0.6;
/** Grenade progress at which the third-person throw lets go (characters/actions.ts throwAction). */
const THROW_AT = 0.4;
/** Grounded, crouched and faster than this: a sprint slide (a crouch walk is under 3 m/s). */
const SLIDE_SPEED = 6;
const JUMP_SPEED = 2.5;
/** How much of the ground's own footstep sounds under a jump, a landing and a slide (their recordings carry no ground). */
export const GROUND = { jump: 0.5, land: 0.9, slide: 0.7 } as const;

interface Seen {
  alive: boolean;
  weapon: WeaponId;
  reload: number;
  /** Progress cycles seen in the current reload (a shotgun restarts its progress for every shell). */
  cycles: number;
  grenade: number;
  grounded: boolean;
  /** Fastest fall since leaving the ground, m/s. */
  fall: number;
  sliding: boolean;
}

/** The sounds of a gun's ordinary reload (its cues and the layers between them) as fractions of the reload. */
function reloadCues(weapon: WeaponId): readonly (readonly [number, SoundId])[] {
  const clip = reloadClip(weapon, false, WEAPONS[weapon].reload);
  const cues = clip.events.filter((e): e is readonly [number, HandlingCue] => RELOAD_CUES.has(e[1])).map(([t, cue]) => [t, handlingSound(cue, weapon)] as const);
  const { duration, layers } = reloadLayers(weapon, false, WEAPONS[weapon].reload);
  return [...cues, ...layers.map((l) => [l.at / duration, l.id] as const)];
}

/**
 * Sounds other players make that no host event reports, derived from the state each snapshot carries: reload cues
 * at the times the reload animation reaches them, jump and landing, the grenade pin and throw, and a slide.
 */
export class RemoteSounds {
  private readonly seen = new Map<number, Seen>();
  private readonly cues = new Map<WeaponId, ReturnType<typeof reloadCues>>();

  constructor(
    private readonly audio: AudioEngine,
    private readonly ears: Ears
  ) {}

  update(id: number, s: RemoteSnapshotPlayer, at: Vec3): void {
    const prev = this.seen.get(id);
    const sliding = s.grounded && s.crouch > 0.5 && Math.hypot(s.vx, s.vz) > SLIDE_SPEED;
    const restarted = prev !== undefined && prev.reload >= 0 && s.reload >= 0 && s.reload < prev.reload - 0.2;
    const cycles = s.reload < 0 ? 0 : (prev && prev.reload >= 0 ? prev.cycles : 1) + (restarted ? 1 : 0);
    const fall = s.grounded ? 0 : Math.max(prev?.grounded === false ? prev.fall : 0, -s.vy);
    this.seen.set(id, { alive: s.alive, weapon: s.weapon, reload: s.reload, cycles, grenade: s.grenade, grounded: s.grounded, fall, sliding });
    if (!prev || !prev.alive || !s.alive) return;
    const play = (sound: SoundId, options: PlayOptions) => this.audio.play(sound, { position: at, occlusion: this.ears.occlusion(id, at, 1), ...options });
    if (s.reload >= 0 && s.weapon === prev.weapon) {
      const from = prev.reload < 0 || restarted ? -1 : prev.reload;
      if (loadsShells(s.weapon)) {
        if (cycles > 1 && from < SHELL_AT && s.reload >= SHELL_AT) play('cue:shellIn', { volume: 0.9, priority: 3 });
      } else {
        for (const [t, sound] of this.cuesOf(s.weapon)) if (from < t && s.reload >= t) play(sound, { volume: 0.9, priority: 3 });
      }
    }
    const move = (kind: keyof typeof GROUND, volume: number) => {
      play(kind, { volume, priority: 3, source: id });
      play(`step:${this.ears.surfaceAt(at)}`, { volume: volume * GROUND[kind], priority: 2, source: id });
    };
    if (prev.grounded && !s.grounded && s.vy > JUMP_SPEED) move('jump', 0.8);
    if (!prev.grounded && s.grounded) move('land', Math.min(Math.max(prev.fall / 10, 0.3), 1));
    if (prev.grenade < 0 && s.grenade >= 0) play('cue:pinPull', { volume: 0.9, priority: 4 });
    if (prev.grenade < THROW_AT && s.grenade >= THROW_AT) play('cue:throw', { volume: 1, priority: 4 });
    if (sliding && !prev.sliding) move('slide', 0.8);
  }

  forget(id: number): void {
    this.seen.delete(id);
  }

  clear(): void {
    this.seen.clear();
  }

  private cuesOf(weapon: WeaponId) {
    let cues = this.cues.get(weapon);
    if (!cues) this.cues.set(weapon, (cues = reloadCues(weapon)));
    return cues;
  }
}
