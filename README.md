# Brickfray

An original plastic-brick FPS with square-headed Snapbots, three arenas, four weapons, solo waves and browser-hosted multiplayer. All materials, models, effects and audio are procedural. No external texture or audio samples are used.

## Run and validate

Layerwise owns the development server. Use the preview and `.layerwise/dev-server.log`; do not start a second server.

```sh
pnpm run check-types
pnpm run test:brickfray
pnpm run test:online
pnpm run test:locales
pnpm run build
```

The browser game loads lazily at `/`. The authenticated account routes remain separate. Development builds also expose `/lab/plaza`, `/lab/fortress` and `/lab/docks`: stationary targets, weapon controls and actual simulation telemetry. These routes return 404 in production.

## Implementation

- `src/brickfray/config.ts`: all weapon values, recoil patterns, match rules, quality presets and default bindings.
- `simulation.ts`: shared fixed-step movement, collision, authoritative combat, spawn selection, waves and history for hitbox rewind.
- `render.ts` / `world.ts`: plastic ShaderMaterial, three arenas, instanced parts/studs and reusable effects pools. The view model has its own camera and depth pass.
- `input.ts` / `audio.ts`: raw pointer input, remapping, gamepads, procedural sound and priority-based voice limiting.
- `protocol.ts` / `network.ts`: quantized state, deltas against identified full snapshots, protocol validation, latency/jitter/loss simulation.
- `game.ts`: prediction/reconciliation, interpolation, room lifecycle, replay and integration. A dedicated worker supplies simulation ticks while the host tab is hidden.
- `src/game/net/net.ts`: preserved PeerJS room discovery/transport. The `bf` channel stamps the actual peer identity and prevents client relaying of authority messages. PeerJS's bundled TURN fallback is retained.
- `src/components/Brickfray.tsx`, `i18n.ts`, `style.css`: menus, HUD, settings and translations. Chinese and English cover all new game UI; five other language choices retain translated main menus with English fallback for some detailed labels.

The earlier game's unused modules remain in `src/game/` for history and its existing tests. They are not the playable entry point.

## Match defaults

FFA: 30 kills or 10 minutes. Team deathmatch: 50 kills or the host-selected time limit, with higher score winning at the limit. Tied matches stay tied. Ten seats, friendly damage disabled, 3-second respawn and 1.5-second protection. A reconnecting player retains the reserved seat and state for 30 seconds. A departed host ends the match.

The exact requested AR values give an ideal five-body-hit kill in 4 × 60/660 = 0.364 seconds from the first impact. A carried firing deadline preserves 660 RPM across fixed simulation ticks. Damage values are unchanged; the supplied ~0.45-second feel target is approximate.

New players start on Medium quality (85% resolution scale, 8 stud segments, 192 loose bricks). High remains available, as do individual overrides. Pixel ratio is capped at 2.

## Testing status

See [the acceptance record](docs/BRICKFRAY_ACCEPTANCE.md). As requested, localhost connectivity is excluded from multiplayer acceptance; the user will publish to an online domain for cross-browser testing. Rendering and deterministic tests do not establish target integrated-GPU performance or replace tactile/audio checks.
