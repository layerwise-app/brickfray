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
  waveStart: ['ui/wave-start-1.mp3', 'ui/wave-start-2.mp3', 'ui/wave-start-3.mp3'],
  bossWave: ['ui/boss-wave-1.mp3', 'ui/boss-wave-2.mp3'],
  waveClear: ['ui/wave-clear-1.mp3', 'ui/wave-clear-2.mp3'],
  upgradeOffer: ['ui/upgrade-offer-1.mp3', 'ui/upgrade-offer-2.mp3'],
  upgradeTaken: ['ui/upgrade-taken-1.mp3', 'ui/upgrade-taken-2.mp3', 'ui/upgrade-taken-3.mp3'],
  grenadeReady: ['ui/grenade-ready-1.mp3', 'ui/grenade-ready-2.mp3', 'ui/grenade-ready-3.mp3'],
  victory: ['ui/victory-1.mp3', 'ui/victory-2.mp3'],
  defeat: ['ui/defeat-1.mp3', 'ui/defeat-2.mp3'],
  runOver: ['ui/run-over-1.mp3', 'ui/run-over-2.mp3'],
  'spot:bird': ['ambience/spot-bird-1.mp3', 'ambience/spot-bird-2.mp3', 'ambience/spot-bird-3.mp3', 'ambience/spot-bird-4.mp3', 'ambience/spot-bird-5.mp3', 'ambience/spot-bird-6.mp3'],
  'spot:crow': ['ambience/spot-crow-1.mp3', 'ambience/spot-crow-2.mp3', 'ambience/spot-crow-3.mp3', 'ambience/spot-crow-4.mp3'],
  'spot:flag': ['ambience/spot-flag-1.mp3', 'ambience/spot-flag-2.mp3', 'ambience/spot-flag-3.mp3', 'ambience/spot-flag-4.mp3'],
  'spot:gull': ['ambience/spot-gull-1.mp3', 'ambience/spot-gull-2.mp3', 'ambience/spot-gull-3.mp3', 'ambience/spot-gull-4.mp3', 'ambience/spot-gull-5.mp3'],
  'spot:pigeon': ['ambience/spot-pigeon-1.mp3', 'ambience/spot-pigeon-2.mp3', 'ambience/spot-pigeon-3.mp3', 'ambience/spot-pigeon-4.mp3'],
  'spot:bell': ['ambience/spot-bell-1.mp3', 'ambience/spot-bell-2.mp3', 'ambience/spot-bell-3.mp3'],
  'spot:creak': ['ambience/spot-creak-1.mp3', 'ambience/spot-creak-2.mp3', 'ambience/spot-creak-3.mp3', 'ambience/spot-creak-4.mp3', 'ambience/spot-creak-5.mp3'],
  'spot:gong': ['ambience/spot-gong-1.mp3', 'ambience/spot-gong-2.mp3', 'ambience/spot-gong-3.mp3'],
  'spot:chime': ['ambience/spot-chime-1.mp3', 'ambience/spot-chime-2.mp3', 'ambience/spot-chime-3.mp3', 'ambience/spot-chime-4.mp3', 'ambience/spot-chime-5.mp3'],
  'spot:jungle': ['ambience/spot-jungle-1.mp3', 'ambience/spot-jungle-2.mp3', 'ambience/spot-jungle-3.mp3', 'ambience/spot-jungle-4.mp3', 'ambience/spot-jungle-5.mp3', 'ambience/spot-jungle-6.mp3', 'ambience/spot-jungle-7.mp3', 'ambience/spot-jungle-8.mp3'],
  'spot:water': ['ambience/spot-water-1.mp3', 'ambience/spot-water-2.mp3', 'ambience/spot-water-3.mp3', 'ambience/spot-water-4.mp3'],
  'spot:bamboo': ['ambience/spot-bamboo-1.mp3', 'ambience/spot-bamboo-2.mp3', 'ambience/spot-bamboo-3.mp3', 'ambience/spot-bamboo-4.mp3', 'ambience/spot-bamboo-5.mp3', 'ambience/spot-bamboo-6.mp3'],
  'spot:horn': ['ambience/spot-horn-1.mp3', 'ambience/spot-horn-2.mp3', 'ambience/spot-horn-3.mp3', 'ambience/spot-horn-4.mp3']
};
