import type { SampleMap } from './samples';

/** Hit and kill feedback, player state, interface and match stingers, scenery one-shots. Sources: public/audio/CREDITS-ui.md and CREDITS-ambience.md. */
export const FEEDBACK_SAMPLES: SampleMap = {
  hitmarker: ['ui/hit-1.mp3', 'ui/hit-2.mp3', 'ui/hit-3.mp3', 'ui/hit-4.mp3', 'ui/hit-5.mp3'],
  headshotMarker: ['ui/headshot-1.mp3', 'ui/headshot-2.mp3', 'ui/headshot-3.mp3', 'ui/headshot-4.mp3'],
  killConfirm: ['ui/kill-1.mp3', 'ui/kill-2.mp3', 'ui/kill-3.mp3'],
  respawn: ['ui/respawn-1.mp3', 'ui/respawn-2.mp3', 'ui/respawn-3.mp3'],
  // The lub of six recorded beats, then the dub of each in the same order (heartbeat.ts pairs them).
  heartbeat: [1, 2, 3, 4, 5, 6].map((n) => `ui/heartbeat-lub-${n}.mp3`).concat([1, 2, 3, 4, 5, 6].map((n) => `ui/heartbeat-dub-${n}.mp3`)),
  uiClick: ['ui/ui-click-1.mp3', 'ui/ui-click-2.mp3', 'ui/ui-click-3.mp3'],
  uiHover: ['ui/ui-hover-1.mp3', 'ui/ui-hover-2.mp3', 'ui/ui-hover-3.mp3'],
  uiBack: ['ui/ui-back-1.mp3', 'ui/ui-back-2.mp3', 'ui/ui-back-3.mp3'],
  countdown: ['ui/countdown-1.mp3', 'ui/countdown-2.mp3', 'ui/countdown-3.mp3'],
  matchStart: ['ui/match-start-1.mp3', 'ui/match-start-2.mp3', 'ui/match-start-3.mp3'],
  matchEnd: ['ui/match-end-1.mp3', 'ui/match-end-2.mp3', 'ui/match-end-3.mp3'],
  waveStart: ['ui/wave-start-1.mp3', 'ui/wave-start-2.mp3', 'ui/wave-start-3.mp3'],
  'spot:bird': ['ambience/spot-bird-1.mp3', 'ambience/spot-bird-2.mp3', 'ambience/spot-bird-3.mp3', 'ambience/spot-bird-4.mp3', 'ambience/spot-bird-5.mp3', 'ambience/spot-bird-6.mp3'],
  'spot:crow': ['ambience/spot-crow-1.mp3', 'ambience/spot-crow-2.mp3', 'ambience/spot-crow-3.mp3', 'ambience/spot-crow-4.mp3'],
  'spot:flag': ['ambience/spot-flag-1.mp3', 'ambience/spot-flag-2.mp3', 'ambience/spot-flag-3.mp3', 'ambience/spot-flag-4.mp3'],
  'spot:gull': ['ambience/spot-gull-1.mp3', 'ambience/spot-gull-2.mp3', 'ambience/spot-gull-3.mp3', 'ambience/spot-gull-4.mp3', 'ambience/spot-gull-5.mp3'],
  'spot:pigeon': ['ambience/spot-pigeon-1.mp3', 'ambience/spot-pigeon-2.mp3', 'ambience/spot-pigeon-3.mp3', 'ambience/spot-pigeon-4.mp3'],
  'spot:bell': ['ambience/spot-bell-1.mp3', 'ambience/spot-bell-2.mp3', 'ambience/spot-bell-3.mp3'],
  'spot:creak': ['ambience/spot-creak-1.mp3', 'ambience/spot-creak-2.mp3', 'ambience/spot-creak-3.mp3', 'ambience/spot-creak-4.mp3', 'ambience/spot-creak-5.mp3'],
  'spot:horn': ['ambience/spot-horn-1.mp3', 'ambience/spot-horn-2.mp3', 'ambience/spot-horn-3.mp3', 'ambience/spot-horn-4.mp3']
};
