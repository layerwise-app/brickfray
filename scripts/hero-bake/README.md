# Showroom bakes (Blender)

The character-select figures get extras that are made offline in Blender and loaded from
`public/models/hero/` by `src/brickfray/characters/hero-assets.ts`:

- `<id>.ao` — ambient occlusion per vertex of the posed figure, multiplied into its colours.
- `<name>.bin` — cloth draped over the posed body by simulation: Moss's cloak, Vega's scarf tails
  (stopped mid-swing, streaming out), Clack's tabard panels. Each is defined in `drape.py`.

All of it is tied to the exact showroom model, stance and primary weapon. After changing any of
those, bake again; a figure whose vertex count no longer matches skips its occlusion and logs a
warning, and a drape made for another stance will hang wrong.

Needs Blender 5.x, Chrome and the dev server on :5390 (`posed.mjs` imports playwright-core; fix its
import path for your machine).

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
H=public/models/hero
node scripts/hero-bake/posed.mjs /tmp/bare bare moss vega clack        # bodies without any draped cloth
for n in moss-cloak vega-scarf clack-tabard; do $B -b --python scripts/hero-bake/drape.py -- /tmp/bare $H $n; done
python3 scripts/hero-bake/manifest.py $H                               # add `--preview <dir>` above for renders
node scripts/hero-bake/posed.mjs /tmp/posed unshaded                   # every figure, wearing its drapes
for id in rivet vega clack coral moss nova; do $B -b --python scripts/hero-bake/bake_ao.py -- /tmp/posed $id $H 128 0.16; done
python3 scripts/hero-bake/manifest.py $H
```

A new drape needs a stub first (`<name>.drape.json` listing its groups with 0 indices, an empty
`<name>.bin`, then `manifest.py`), so the bare export knows to leave the procedural piece off.
