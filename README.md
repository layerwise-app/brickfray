<a href="https://layerwise.app"><picture><source media="(prefers-color-scheme: dark)" srcset="https://layerwise.app/powered-by-dark.png"><img src="https://layerwise.app/powered-by.png" alt="Powered by Layerwise" width="174" height="28"></picture></a>

# Doodle Shooter

Doodle Shooter is a first-person survival shooter that looks like blue ballpoint
pen on lined notebook paper, and it runs right in the browser. In the game it
is called Doodle District (涂鸦街区). It's a starting point for anyone who wants
to make their own browser shooter or 3D game without setting up an engine.
Visitors can play solo against waves of doodled enemies, with a boss every
fifth wave. They can also join a free-for-all online match with up to 10
players. Try the live demo at <https://doodleshooter.layerwise.site/>.

It was built with [Layerwise](https://layerwise.app), and you can open it in
Layerwise to make your own version.

## What's in the game

- **Solo waves.** Each wave is bigger than the last, and from wave 4 regular
  waves can roll a random modifier. Every fifth wave brings a boss: The
  Doodler, The Eraser, or The Inkblot, in turn. Reaching wave 5, 10, 15 and so
  on saves a checkpoint you can restart from.
- **Weapons and moves.** You get a rifle, a shotgun, a sniper rifle, a katana,
  and grenades, plus a grappling hook, wall jumps, double jumps, slides, and
  air dashes.
- **Online free-for-all.** The first player to 20 kills wins, and a match lasts
  at most 10 minutes. Players can quick match, browse public lobbies, or share
  a private lobby code. Matches are peer-to-peer over WebRTC: the host's
  browser runs the match, the public PeerJS signalling service connects the
  players, and there is no game server.
- **Controls.** Use a mouse and keyboard, or a gamepad (its button labels
  follow the PS5 layout).
- **Two languages.** The game picks English or Chinese from the browser
  language. Force one with `?lang=en` or `?lang=zh`, or change it in the start
  menu.
- **Saved in the browser.** The best score, checkpoint, player name, and
  settings are kept in `localStorage`.

## How it's built

The game is strict TypeScript in `src/game/`, bundled by the project's Vite
build. three.js and PeerJS come from npm (`three`, `peerjs`). The home page,
`src/routes/index.tsx`, renders `src/components/DoodleDistrict.tsx`, which
lazy-loads the game on the client only and calls `startGame(root)`; the
returned `dispose()` tears everything down again when the page unmounts.

```
src/game/
  index.ts          public entry: startGame() and the game stylesheet
  game.ts           orchestrator: wiring, level swaps, run control, frame loop
  context.ts        GameContext, the contract every system receives
  config.ts         match rules, wave roster and modifiers, focus tuning
  storage.ts        typed localStorage preferences (doodle_* keys)
  core/             math helpers, i18n, synthesized audio, keyboard/mouse/gamepad input
  render/           ink-on-paper renderer and materials
  world/            physics, nav grid, maps
  entities/         player, weapons, enemies, remote players, effects
  net/              peer-to-peer lobby networking
  session/          solo waves, focus, pickups, props, combat, lobby, online match, scores
  ui/               HUD, menu screens, game.css (scoped to .dd-root)
```

| What to change | Where |
| --- | --- |
| All game text, in both languages | `src/game/core/i18n.ts`: the `ZH` and `EN` dictionaries (keys are type-checked), plus the HUD and controls markup |
| Menu and HUD colors and font | `src/game/ui/game.css`: `--ink`, `--red`, `--paper` and the font stack on `.dd-root` |
| 3D pen colors and paper | `src/game/render/ink-renderer.ts`: `INK_COLORS`, plus `uPaper` and `uLineSpacing` in the paper shader's uniforms |
| Match rules | `src/game/config.ts`: `FFA_TARGET` (kills to win), `FFA_TIME` (seconds) and `RESPAWN` (seconds); player health is set in `resetGame()` in `src/game/game.ts` |
| Waves | `src/game/config.ts`: `ROSTER` (which enemies appear and from which wave) and `MODIFIERS`; the director is `src/game/session/waves.ts` |
| Weapon stats | `src/game/entities/weapons.ts`: `GUNS`, the typed gun stats table (magazine, reserve, damage, spread, reload time and more) |
| Enemy stats | `src/game/entities/enemies.ts`: `TYPES` (health, speed, damage, score) and `BOSSES` |
| The map | `src/game/world/level.ts`; a second map is switched off with `MEXICO_READY = false` |
| Lobby size | `maxPlayers` in `src/game/net/net.ts`; the "up to 10 players" copy is in `i18n.ts` |
| Sound effects and music | `src/game/core/audio.ts`: everything is synthesized with the Web Audio API, so there are no audio files |
| Page title and description | `src/routes/index.tsx`, with fallbacks in `src/routes/__root.tsx` |
| Logo and icons | `public/logo.svg`, `public/logo.png`, and the favicons and `android-chrome-*` icons in `public/` |
| "Make your own game with Layerwise" | Created in `src/game/ui/hud.ts` and styled by `.lw-promo` in `game.css`; it shows on the start, online and lobby screens only |

### Add an enemy type

1. In `src/game/entities/enemies.ts`, add a key to `EnemyTypeKey`, copy an
   entry in `TYPES` under it and tune its numbers. Its `weapon` value decides how it fights:
   `rifle`, `pistol`, `shotgun`, `sniper`, `blade` (melee), or `bomb` (runs up
   and explodes).
2. In `src/game/core/i18n.ts`, add the enemy's name to both `ZH`
   and `EN`, and point the entry's `name` at it with `t('yourKey')`.
3. In `src/game/config.ts`, add it to `ROSTER` with `from` (the
   first wave it can appear in) and `w` (how often it spawns compared with the
   others).

### Add or change text

Every string lives in `src/game/core/i18n.ts` and is read with `t('key')`.
Keys come from `EN` and `ZH` must match it, so a missing or misspelled key is a
type error.

## Commands

```bash
pnpm install
pnpm dev
pnpm check-types
pnpm build
```

Changes under `src/game/` hot-reload in `pnpm dev`. `pnpm build` runs the type check and then the
production build.

The project still contains the Layerwise starter's sign-in pages, dashboard,
Better Auth setup, and D1 database (`src/routes/`, `src/lib/auth.ts`,
`src/db/`). The game doesn't use them.
