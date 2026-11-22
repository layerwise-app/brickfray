import { describe, expect, it } from 'vitest';
import type { WeaponId } from '../weapons/defs';
import { reloadClip } from '../weapons/view/clips-guns';
import { reloadLayers } from './reload-layers';
import { PEAK_AT } from './sync';

const ids = (weapon: WeaponId) => reloadLayers(weapon, false, 2).layers.map((l) => l.id);

describe('reloadLayers', () => {
  it('gives a rifle, a pistol-sized gun and a tool their own hand and magazine takes', () => {
    expect(ids('ar')).toEqual(['foley:gripOff', 'foley:pouch', 'foley:magScrape', 'foley:regrip']);
    expect(ids('pistol')).toEqual(['foley:gripOffSmall', 'foley:pouchSmall', 'foley:magScrapeSmall', 'foley:regripSmall']);
    expect(ids('buzzer')).toEqual(ids('pistol'));
    expect(ids('nailer')).toEqual(['foley:gripOffTool', 'foley:pouchTool', 'foley:magScrapeTool', 'foley:regripTool']);
    expect(ids('harpoon')).toEqual(['foley:regripTool']);
  });

  it('puts the sniper hand back on the grip only after the bolt is run home', () => {
    const duration = 3.2;
    const clip = reloadClip('sniper', true, duration);
    const boltHome = clip.events.find(([, e]) => e === 'boltForward')![0] * clip.duration + (PEAK_AT['foley:boltClose'] ?? 0);
    const regrip = reloadLayers('sniper', true, duration).layers.find((l) => l.id === 'foley:regrip')!;
    expect(regrip.at).toBeGreaterThan(boltHome + 0.1);
  });
});
