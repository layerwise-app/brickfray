import { DECAL, GROUND } from './blocks';
import type { Plan } from './plan';
import { EDGE } from './plaza-layout';
import { CANAL, HALL, SQUARE, TOWER } from './plaza-middle';
import { STATION } from './plaza-north';
import { SITE } from './plaza-south';

const ROAD = '#7d7a75';
type Rect = [number, number, number, number];

/** Ground slabs round the canal arm, then paving that tells the districts apart. */
export function plazaGround(p: Plan) {
  const X = EDGE.x + 0.4;
  const Z = EDGE.z + 0.4;
  const z = CANAL.z;
  for (const [x0, z0, x1, z1] of [[-X, -Z, X, -z], [-X, z, X, Z], [-X, -z, CANAL.foot[0], z]] as const) {
    p.add(GROUND, { x0, z0, x1, z1, y: 0, color: ROAD, surface: 'stone', smooth: true, matte: true });
  }
  const paint = (r: Rect, color: string, smooth = false, y = 0.004) => p.add(DECAL, { x0: r[0], z0: r[1], x1: r[2], z1: r[3], y, color, surface: 'stone', smooth });
  const checker = (r: Rect, a: string, b: string, cell: number, y = 0.004) => {
    for (let i = 0, x = r[0]; x < r[2] - 0.01; i++, x += cell) {
      for (let j = 0, zz = r[1]; zz < r[3] - 0.01; j++, zz += cell) paint([x, zz, Math.min(r[2], x + cell), Math.min(r[3], zz + cell)], (i + j) % 2 ? a : b, false, y);
    }
  };
  // Clock Square: pale stone in big squares with a terracotta border.
  paint([SQUARE.x0, SQUARE.z0, SQUARE.x1, SQUARE.z1], '#c4553a');
  checker([SQUARE.x0 + 0.8, SQUARE.z0 + 0.8, SQUARE.x1 - 0.8, SQUARE.z1 - 0.8], '#ebe1cb', '#dccfb3', 3.2, 0.008);
  // Market hall, town hall and station floors.
  checker([HALL.x0 + 0.8, HALL.z0 + 0.8, HALL.x1 - 0.8, HALL.z1 - 0.8], '#c4553a', '#e3d6bc', 1.6);
  checker([TOWER.x0 + 0.8, -TOWER.hall + 0.8, TOWER.x1 - 0.8, TOWER.hall - 0.8], '#2f363d', '#efe5cf', 1.6);
  checker([STATION.x0 + 0.8, STATION.z0 + 0.8, STATION.x1 - 0.8, STATION.z1 - 0.8], '#c9b48a', '#efe5cf', 1.6);
  // Quay along the canal and the canal-head quays: light stone.
  for (const r of [[30.4, -EDGE.z, EDGE.x, -z], [30.4, z, EDGE.x, EDGE.z]] as Rect[]) paint(r, '#c9c6bd');
  for (const r of [[TOWER.x1, -TOWER.hall, 30.4, -z], [TOWER.x1, z, 30.4, TOWER.hall]] as Rect[]) paint(r, '#c9c6bd');
  // Terminus: tram rails along both wings and the forecourt in front of the station.
  for (const zr of [-35.2, -34.4]) paint([-EDGE.x, zr - 0.06, EDGE.x, zr + 0.06], '#5f656b', true, 0.008);
  paint([-21.6, STATION.z1, 20.8, -22.4], '#d9d2c1');
  // Park: lawns and gravel paths; the pavilion and pond sit on the lawn.
  paint([-32.8, 22.4, 20.8, EDGE.z], '#e0c890');
  for (const r of [[-27.2, 27.2, -8.8, 38.4], [1.6, 27.2, 16.0, 38.4]] as Rect[]) paint(r, '#5aa83f', false, 0.008);
  // Building site: packed earth in the yard, concrete in the frame.
  paint([20.8, 10.4, 30.4, SITE.z1], '#a8855a');
  paint([SITE.x0 + 0.8, SITE.z0 + 0.8, SITE.x1 - 0.8, SITE.z1 - 0.8], '#b9aa92', false, 0.008);
  // Cobbled lanes: Bakery Lane, Laundry Alley, Gate Street and Café Steps.
  for (const r of [[-EDGE.x, -EDGE.z, -32.8, HALL.z0], [-EDGE.x, HALL.z1, -32.8, EDGE.z], [-18.4, -22.4, -8.8, -16.0], [2.4, 16.0, 12.0, 22.4]] as Rect[]) paint(r, '#9a8f80');
  // Interiors: bakery boards, laundrette tiles, boatyard concrete.
  paint([-32.0, -21.6, -22.4, -16.8], '#b98a5a');
  checker([-32.0, 16.8, -22.4, 21.6], '#f2f2ee', '#7fc8e8', 0.8);
  paint([21.6, -28.0, 29.6, -16.8], '#a9aaa5');
}
