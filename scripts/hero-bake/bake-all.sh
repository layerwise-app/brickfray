#!/bin/zsh
# Re-bakes the showroom extras (README.md) one step at a time, waiting while the machine is busy.
# usage: scripts/hero-bake/bake-all.sh [ids…]   (default: all six; drapes are re-made for the named figures that wear one)
set -e
cd "${0:A:h}/../.."
B=/Applications/Blender.app/Contents/MacOS/Blender
H=public/models/hero
W=${BAKE_DIR:-$HOME/tmp/hero-bake-work}
ids=($@); (( $#ids )) || ids=(rivet vega clack coral moss nova)
typeset -A DRAPES=(moss moss-cloak vega vega-scarf clack clack-tabard)

calm() {
  while true; do
    local l=$(uptime | awk -F'load averages: ' '{print $2}' | awk '{print $1}')
    local m=$(memory_pressure | tail -1 | grep -o '[0-9]*')
    (( ${l%.*} < 8 && m >= 25 )) && return
    echo "busy (load $l, free $m%); waiting"; sleep 90
  done
}

draped=()
for id in $ids; do [[ -n ${DRAPES[$id]} ]] && draped+=($id); done
rm -rf $W/bare $W/posed
if (( ${#draped} )); then
  calm; node scripts/hero-bake/posed.mjs $W/bare bare $draped
  for id in $draped; do calm; $B -b --python scripts/hero-bake/drape.py -- $W/bare $H ${DRAPES[$id]} > $W/drape-$id.log 2>&1 || { tail -20 $W/drape-$id.log; exit 1; }; grep DRAPE $W/drape-$id.log; done
  python3 scripts/hero-bake/manifest.py $H
fi
calm; node scripts/hero-bake/posed.mjs $W/posed unshaded $ids
for id in $ids; do calm; $B -b --python scripts/hero-bake/bake_ao.py -- $W/posed $id $H 128 0.16 > $W/ao-$id.log 2>&1 || { tail -20 $W/ao-$id.log; exit 1; }; tail -1 $W/ao-$id.log; done
python3 scripts/hero-bake/manifest.py $H
