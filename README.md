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

The game is plain JavaScript ES modules in `public/doodle-district/`, served as
static files with no build step. three.js and PeerJS are vendored under
`public/doodle-district/vendor/`. The home page, `src/routes/index.tsx`, is a
TanStack Start route that fills the screen with the game in an iframe.

| What to change | Where |
| --- | --- |
| All game text, in both languages | `public/doodle-district/src/lang.js`: the `ZH` and `EN` dictionaries, plus the HUD and controls markup |
| Menu and HUD colors and font | `public/doodle-district/style.css`: `--ink`, `--red` and `--paper` on the first line, and the font stack on `html, body` |
| 3D pen colors and paper | `public/doodle-district/src/render.js`: `INK_COLORS`, plus `uPaper` and `uLineSpacing` in the paper shader's uniforms |
| Match rules | `public/doodle-district/src/main.js`: `FFA_TARGET` (kills to win), `FFA_TIME` (seconds) and `RESPAWN` (seconds); player health is set in `resetGame()` |
| Waves | `public/doodle-district/src/main.js`: `ROSTER` (which enemies appear and from which wave), `MODIFIERS`, and `startWave()` |
| Weapon stats | `public/doodle-district/src/weapons.js`: `GUNS`, the gun stats table (magazine, reserve, damage, spread, reload time and more) |
| Enemy stats | `public/doodle-district/src/enemies.js`: `TYPES` (health, speed, damage, score) and `BOSSES` |
| The map | `public/doodle-district/src/level.js`; a second map is switched off with `MEXICO_READY = false` |
| Lobby size | `maxPlayers` in `public/doodle-district/src/net.js`; the "up to 10 players" copy is in `lang.js` |
| Sound effects and music | `public/doodle-district/src/audio.js`: everything is synthesized with the Web Audio API, so there are no audio files |
| Page title and description | `src/routes/index.tsx`, with fallbacks in `src/routes/__root.tsx` |
| Logo and icons | `public/logo.svg`, `public/logo.png`, and the favicons and `android-chrome-*` icons in `public/` |
| "Make your own game with Layerwise" | Created in `public/doodle-district/src/hud.js` and styled by `.lw-promo` in `style.css`; it shows on the start, online and lobby screens only |

### Add an enemy type

1. In `public/doodle-district/src/enemies.js`, copy an entry in `TYPES` under a
   new key and tune its numbers. Its `weapon` value decides how it fights:
   `rifle`, `pistol`, `shotgun`, `sniper`, `blade` (melee), or `bomb` (runs up
   and explodes).
2. In `public/doodle-district/src/lang.js`, add the enemy's name to both `ZH`
   and `EN`, and point the entry's `name` at it with `t('yourKey')`.
3. In `public/doodle-district/src/main.js`, add it to `ROSTER` with `from` (the
   first wave it can appear in) and `w` (how often it spawns compared with the
   others).

### Add or change text

Every string lives in `public/doodle-district/src/lang.js` and is read with
`t('key')`. Chinese is the source locale, so add new keys to both `ZH` and `EN`.

## Commands

```bash
pnpm install
pnpm dev
pnpm check-types
pnpm build
```

The game files are static, so changes under `public/doodle-district/` show up
when you reload the page. `pnpm build` runs the type check and then the
production build.

The project still contains the Layerwise starter's sign-in pages, dashboard,
Better Auth setup, and D1 database (`src/routes/`, `src/lib/auth.ts`,
`src/db/`). The game doesn't use them.
