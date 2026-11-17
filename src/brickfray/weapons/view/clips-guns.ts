import { bump, hand, track, type Clip, type ClipEvent, type Keys } from './clip';
import { env } from './springs';

const Z = [0, 0, 0, 0, 0, 0];
type Events = (readonly [number, ClipEvent])[];

function clip(name: string, duration: number, events: Events, sample: Clip['sample'], hold = false): Clip {
  return { name, duration, events: [...events].sort((a, b) => a[0] - b[0]), sample, hold };
}

/** Mag swap keys shared by rifles: seated → unseated → away (off screen) → back → seated. */
function magKeys(t0: number, t1: number, t2: number, t3: number, t4: number, t5: number, drop = [0, -0.045, -0.01]): Keys {
  const away = [-0.06, -0.4, 0.14, 0.9, 0.3, 0.6];
  return [
    [t0, Z],
    [t1, [...drop, 0.05, 0, 0]],
    [t2, away],
    [t3, away],
    [t4, [0, -0.07, -0.014, 0.12, 0, 0.02]],
    [t5 - 0.015, [0, -0.012, -0.003, 0, 0, 0]],
    [t5, Z]
  ];
}

const TILT_AR = [-0.07, 0.08, -0.03, 0.22, 0.32, -0.62];
const CHARGE_AR = [-0.06, 0.07, -0.01, 0.24, 0.5, -0.3];

export function arReload(empty: boolean, duration: number): Clip {
  if (!empty) {
    const gun: Keys = [[0, Z], [0.13, TILT_AR], [0.8, TILT_AR], [1, Z]];
    const mag = magKeys(0.15, 0.21, 0.4, 0.46, 0.56, 0.615);
    return clip('arReload', duration, [[0.02, 'cloth'], [0.18, 'magOut'], [0.61, 'magIn'], [0.86, 'cloth']], (u, f, c) => {
      f.gun(track(u, gun));
      f.gun([0, -0.01, 0, -0.05, 0, 0.02], bump(u, 0.185, 0.03));
      f.gun([0, 0.012, 0, 0.06, 0, 0], bump(u, 0.615, 0.03));
      f.part('magazine', track(u, mag));
      f.left = hand(u, [[0, c.goals.leftRest!], [0.13, c.goals.mag!], [0.66, c.goals.mag!], [0.82, c.goals.leftRest!]]);
      f.busy = env(u, 0, 0.08, 0.9, 1);
    });
  }
  const gun: Keys = [[0, Z], [0.11, TILT_AR], [0.56, TILT_AR], [0.66, CHARGE_AR], [0.82, CHARGE_AR], [1, Z]];
  const mag = magKeys(0.12, 0.17, 0.32, 0.37, 0.45, 0.505);
  const bolt: Keys = [[0.68, Z], [0.735, [0, 0, 0.068]], [0.755, [0, 0, 0.068]], [0.77, Z]];
  return clip('arReloadEmpty', duration, [[0.02, 'cloth'], [0.15, 'magOut'], [0.5, 'magIn'], [0.715, 'boltBack'], [0.765, 'boltForward'], [0.9, 'cloth']], (u, f, c) => {
    const g = c.goals;
    f.gun(track(u, gun));
    f.gun([0, -0.01, 0, -0.05, 0, 0.02], bump(u, 0.15, 0.025));
    f.gun([0, 0.012, 0, 0.06, 0, 0], bump(u, 0.505, 0.025));
    f.gun([0, 0, 0.006, -0.03, 0, 0], bump(u, 0.765, 0.02));
    f.part('magazine', track(u, mag));
    f.part('bolt', track(u, bolt));
    f.left = hand(u, [[0, g.leftRest!], [0.1, g.mag!], [0.54, g.mag!], [0.66, g.charge!], [0.755, g.charge!], [0.7551, g.chargeBack!], [0.9, g.leftRest!]]);
    f.busy = env(u, 0, 0.07, 0.92, 1);
  });
}

const PUMP_TILT = [0, -0.008, 0.012, 0.03, 0.05, -0.1];

export function shotgunPump(duration: number, eject: boolean): Clip {
  const pump: Keys = [[0.08, Z], [0.3, [0, 0, 0.078]], [0.4, [0, 0, 0.078]], [0.64, Z]];
  const gun: Keys = [[0, Z], [0.25, PUMP_TILT], [0.5, [0, -0.004, 0.004, 0.01, 0.04, -0.06]], [0.8, Z]];
  const events: Events = [[0.26, 'pumpBack'], [0.62, 'pumpForward']];
  if (eject) events.push([0.3, 'shellEject']);
  return clip('pump', duration, events, (u, f) => {
    f.gun(track(u, gun));
    f.gun([0, 0, 0.006, 0.02, 0, 0], bump(u, 0.3, 0.05));
    f.gun([0, 0, -0.005, -0.015, 0, 0], bump(u, 0.64, 0.05));
    f.part('pump', track(u, pump));
    f.busy = env(u, 0, 0.1, 0.7, 0.95) * 0.7;
  });
}

const LOAD_POSE = [-0.065, 0.075, -0.03, 0.2, 0.28, -0.75];

/** Shotgun: roll the gun to show the loading port, left hand drops for shells. Holds. */
export function shotgunLoadIn(duration: number): Clip {
  return clip('loadIn', duration, [[0.05, 'cloth']], (u, f, c) => {
    f.gun(track(u, [[0, Z], [1, LOAD_POSE]]));
    f.left = hand(u, [[0, c.goals.leftRest!], [1, c.goals.shellLow!]]);
    f.busy = Math.min(1, u * 2);
  }, true);
}

/** One shell: up from below, thumbed into the port, hand back down. Holds below. */
export function shotgunShell(duration: number): Clip {
  return clip('shell', duration, [[0.62, 'shellIn'], [0.62, 'shellLoaded']], (u, f, c) => {
    const g = c.goals;
    f.gun(LOAD_POSE);
    f.gun([0, 0.007, -0.004, 0.035, 0, 0], bump(u, 0.63, 0.06));
    f.left = hand(u, [[0, g.shellLow!], [0.42, g.portNear!], [0.62, g.port!], [0.7, g.port!], [1, g.shellLow!]]);
    f.show.shell = u < 0.63;
    f.busy = 1;
  }, true);
}

/** Back to the pump; racks it if the reload started empty. */
export function shotgunLoadOut(duration: number, rack: boolean): Clip {
  const events: Events = [[0.1, 'cloth']];
  if (rack) events.push([0.56, 'pumpBack'], [0.82, 'pumpForward']);
  return clip('loadOut', duration, events, (u, f, c) => {
    f.gun(track(u, rack ? [[0, LOAD_POSE], [0.35, PUMP_TILT], [0.85, PUMP_TILT], [1, Z]] : [[0, LOAD_POSE], [1, Z]]));
    f.left = hand(u, [[0, c.goals.shellLow!], [rack ? 0.36 : 0.75, c.goals.leftRest!]]);
    if (rack) f.part('pump', track(u, [[0.42, Z], [0.58, [0, 0, 0.078]], [0.64, [0, 0, 0.078]], [0.82, Z]]));
    f.busy = 1 - u * u;
  });
}

const BOLT_TILT = [-0.07, -0.015, -0.085, 0.08, 0.12, -0.42];
const BOLT_UP = [0, 0, 0, 0, 0, 1.05];
const BOLT_BACK = [0, 0, 0.09, 0, 0, 1.05];

export function sniperCycle(duration: number): Clip {
  const bolt: Keys = [[0.18, Z], [0.3, BOLT_UP], [0.46, BOLT_BACK], [0.6, BOLT_UP], [0.7, Z]];
  const gun: Keys = [[0, Z], [0.18, BOLT_TILT], [0.78, BOLT_TILT], [1, Z]];
  return clip('bolt', duration, [[0.05, 'cloth'], [0.3, 'boltBack'], [0.44, 'eject'], [0.62, 'boltForward']], (u, f, c) => {
    f.gun(track(u, gun));
    f.gun([0, 0, 0.005, 0.015, 0, 0], bump(u, 0.46, 0.04));
    f.gun([0, 0, -0.004, -0.012, 0, 0], bump(u, 0.62, 0.04));
    f.part('bolt', track(u, bolt));
    f.right = hand(u, [[0, c.goals.rightRest!], [0.17, c.goals.bolt!], [0.78, c.goals.bolt!], [0.95, c.goals.rightRest!]]);
    f.busy = env(u, 0, 0.12, 0.8, 1);
  });
}

const TILT_SN = [-0.065, 0.075, -0.03, 0.2, 0.3, -0.58];

export function sniperReload(empty: boolean, duration: number): Clip {
  if (!empty) {
    const gun: Keys = [[0, Z], [0.12, TILT_SN], [0.82, TILT_SN], [1, Z]];
    const mag = magKeys(0.15, 0.22, 0.4, 0.47, 0.58, 0.635, [0, -0.035, 0]);
    return clip('sniperReload', duration, [[0.02, 'cloth'], [0.19, 'magOut'], [0.63, 'magIn'], [0.88, 'cloth']], (u, f, c) => {
      f.gun(track(u, gun));
      f.gun([0, 0.012, 0, 0.05, 0, 0], bump(u, 0.635, 0.03));
      f.part('magazine', track(u, mag));
      f.left = hand(u, [[0, c.goals.leftRest!], [0.13, c.goals.mag!], [0.68, c.goals.mag!], [0.84, c.goals.leftRest!]]);
      f.busy = env(u, 0, 0.08, 0.9, 1);
    });
  }
  const gun: Keys = [[0, Z], [0.1, TILT_SN], [0.88, TILT_SN], [1, Z]];
  const bolt: Keys = [[0.09, Z], [0.14, BOLT_UP], [0.2, BOLT_BACK], [0.76, BOLT_BACK], [0.84, BOLT_UP], [0.9, Z]];
  const mag = magKeys(0.28, 0.33, 0.46, 0.52, 0.62, 0.675, [0, -0.035, 0]);
  return clip('sniperReloadEmpty', duration, [[0.02, 'cloth'], [0.15, 'boltBack'], [0.31, 'magOut'], [0.67, 'magIn'], [0.83, 'boltForward'], [0.92, 'cloth']], (u, f, c) => {
    const g = c.goals;
    f.gun(track(u, gun));
    f.gun([0, 0.012, 0, 0.05, 0, 0], bump(u, 0.675, 0.025));
    f.part('bolt', track(u, bolt));
    f.part('magazine', track(u, mag));
    f.right = hand(u, [[0, g.rightRest!], [0.08, g.bolt!], [0.22, g.bolt!], [0.3, g.rightRest!], [0.7, g.rightRest!], [0.76, g.bolt!], [0.9, g.bolt!], [0.98, g.rightRest!]]);
    f.left = hand(u, [[0, g.leftRest!], [0.26, g.mag!], [0.71, g.mag!], [0.86, g.leftRest!]]);
    f.busy = env(u, 0, 0.06, 0.93, 1);
  });
}

const TILT_P = [-0.07, 0.07, -0.07, 0.3, 0.3, -0.45];
const SLIDE_LOCK = 0.03;

export function pistolReload(empty: boolean, duration: number): Clip {
  const fall = [0, -0.46, 0.07, 0.35, 0, 0.25];
  if (!empty) {
    const mag: Keys = [[0.1, Z], [0.16, [0, -0.03, 0.004]], [0.3, fall], [0.42, fall], [0.56, [0, -0.06, 0.01]], [0.605, [0, -0.008, 0]], [0.62, Z]];
    return clip('pistolReload', duration, [[0.02, 'cloth'], [0.14, 'magOut'], [0.615, 'magIn'], [0.86, 'cloth']], (u, f, c) => {
      const g = c.goals;
      f.gun(track(u, [[0, Z], [0.14, TILT_P], [0.8, TILT_P], [1, Z]]));
      f.gun([0, 0.012, 0, 0.07, 0, 0], bump(u, 0.62, 0.03));
      f.part('magazine', track(u, mag));
      f.left = hand(u, [[0, g.leftRest!], [0.1, g.leftRest!], [0.3, g.low!], [0.4, g.mag!], [0.66, g.mag!], [0.84, g.leftRest!]]);
      f.busy = env(u, 0, 0.08, 0.9, 1);
    });
  }
  const mag: Keys = [[0.08, Z], [0.13, [0, -0.03, 0.004]], [0.25, fall], [0.34, fall], [0.48, [0, -0.06, 0.01]], [0.525, [0, -0.008, 0]], [0.54, Z]];
  const slide: Keys = [[0.64, [0, 0, SLIDE_LOCK]], [0.71, [0, 0, SLIDE_LOCK + 0.006]], [0.755, [0, 0, SLIDE_LOCK + 0.006]], [0.772, Z]];
  return clip('pistolReloadEmpty', duration, [[0.02, 'cloth'], [0.12, 'magOut'], [0.535, 'magIn'], [0.7, 'slideBack'], [0.77, 'slideForward'], [0.9, 'cloth']], (u, f, c) => {
    const g = c.goals;
    f.gun(track(u, [[0, Z], [0.12, TILT_P], [0.56, TILT_P], [0.66, [0.0, 0.07, -0.16, 0.1, 0.35, -0.55]], [0.82, [0.0, 0.07, -0.16, 0.1, 0.35, -0.55]], [1, Z]]));
    f.gun([0, 0.012, 0, 0.07, 0, 0], bump(u, 0.54, 0.025));
    f.gun([0, 0, 0.006, -0.03, 0, 0], bump(u, 0.775, 0.02));
    f.part('magazine', track(u, mag));
    f.part('slide', track(u, slide));
    f.left = hand(u, [[0, g.leftRest!], [0.08, g.leftRest!], [0.24, g.low!], [0.32, g.mag!], [0.56, g.mag!], [0.66, g.slide!], [0.755, g.slide!], [0.7551, g.slideBack!], [0.9, g.leftRest!]]);
    f.busy = env(u, 0, 0.07, 0.92, 1);
  });
}

export { SLIDE_LOCK };
