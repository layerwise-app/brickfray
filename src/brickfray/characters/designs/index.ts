import type { PartSet } from '../parts';
import type { RestOverrides } from '../skeleton';
import type { BotKind, CharacterId } from '../types';
import { bot } from './bots';
import { clack } from './clack';
import { coral } from './coral';
import { moss } from './moss';
import { nova } from './nova';
import { rivet } from './rivet';
import { vega } from './vega';

export interface Design {
  build(b: PartSet): void;
  /** Where the swinging bones hang from (ponytail, plume, antenna, scarf, cloak). */
  rest?: RestOverrides;
  scale?: number;
}

export const BOT_KINDS: readonly BotKind[] = ['grunt', 'rusher', 'sniper', 'boss'];

export const DESIGNS: Record<CharacterId | BotKind, Design> = {
  rivet: { build: rivet },
  vega: { build: vega, rest: { dangleHead: [0, 0.215, 0.125], dangleBack: [0, 0.21, 0.115] } },
  clack: { build: clack, rest: { dangleHead: [0, 0.26, 0.02] } },
  coral: { build: coral },
  moss: { build: moss, rest: { dangleBack: [0, 0.22, 0.135] } },
  nova: { build: nova, rest: { dangleHead: [0.11, 0.24, 0.04] } },
  grunt: { build: bot('grunt') },
  rusher: { build: bot('rusher') },
  sniper: { build: bot('sniper'), rest: { dangleHead: [0.06, 0.19, 0.07] } },
  boss: { build: bot('boss'), scale: 1.6 }
};
