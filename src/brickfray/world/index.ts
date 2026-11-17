import { DOCKS } from './map-docks';
import { FORTRESS } from './map-fortress';
import { PLAZA } from './map-plaza';
import type { MapDefinition, MapId } from './types';

export const MAPS: Record<MapId, MapDefinition> = { plaza: PLAZA, fortress: FORTRESS, docks: DOCKS };

export type * from './types';
export { validateLayout, type LayoutReport } from './validate';
export { defineMap, Plan, Drawer, type Element, type MapSpec } from './plan';
export { pen, Pen, frameOf, type At } from './props-kit';
export { TREE, BUSH, FLOWERS, ROCK, HEDGE } from './props-nature';
export { LAMP, BENCH, CONE, BARRIER, FENCE, BIN, HYDRANT, BOLLARD, CAFE_TABLE } from './props-street';
export { CAR, VAN, FORKLIFT } from './props-vehicles';
export { FOUNTAIN, STALL } from './props-plaza';
export { CONTAINER, CONTAINER_SIZE, CRATE, BARREL, PALLET, ROPE, PLANKS, MOORING, LIFEBUOY, crateStack } from './props-harbor';
export { BANNER, FLAGPOLE, TORCH, CART, WELL, HAY, TARGET, WEAPON_RACK } from './props-castle';
export { CRANE } from './crane';
export { BOAT_EL as BOAT } from './boat';
export { RACK, METAL_STAIRS } from './warehouse';
export { BLOCK, STAIRS, GROUND, DECAL, WATER } from './blocks';
