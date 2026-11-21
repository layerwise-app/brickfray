export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityProfile {
  level: QualityLevel;
  /** Multiplier on devicePixelRatio, capped by maxPixelRatio. */
  resolutionScale: number;
  maxPixelRatio: number;
  /** Lambert on low; physically based plastic with environment reflections otherwise. */
  pbr: boolean;
  clearcoat: boolean;
  shadows: boolean;
  shadowMapSize: number;
  shadowRadius: number;
  ambientOcclusion: boolean;
  /** Multisampling; without it the frame renders single-sample and gets FXAA on the way to the canvas. */
  antialias: boolean;
  /** Bevel width on brick edges in meters; 0 keeps plain boxes. */
  bevel: number;
  /** Radial segments for studs; 0 drops studs on scenery. */
  studSegments: number;
  /** Extra decorative parts on props, characters and weapons. */
  detail: 0 | 1 | 2;
  maxDebris: number;
  maxDecals: number;
  drawDistance: number;
}

export const QUALITY: Record<QualityLevel, QualityProfile> = {
  low: {
    level: 'low',
    resolutionScale: 1,
    maxPixelRatio: 1,
    pbr: false,
    clearcoat: false,
    shadows: false,
    shadowMapSize: 0,
    shadowRadius: 0,
    ambientOcclusion: false,
    antialias: false,
    bevel: 0,
    studSegments: 0,
    detail: 0,
    maxDebris: 96,
    maxDecals: 48,
    drawDistance: 140
  },
  medium: {
    level: 'medium',
    resolutionScale: 1,
    maxPixelRatio: 1.5,
    pbr: true,
    clearcoat: false,
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 2,
    ambientOcclusion: false,
    antialias: true,
    bevel: 0.012,
    studSegments: 10,
    detail: 1,
    maxDebris: 220,
    maxDecals: 96,
    drawDistance: 220
  },
  high: {
    level: 'high',
    resolutionScale: 1,
    maxPixelRatio: 2,
    pbr: true,
    clearcoat: true,
    shadows: true,
    shadowMapSize: 4096,
    shadowRadius: 3,
    ambientOcclusion: true,
    antialias: true,
    bevel: 0.016,
    studSegments: 18,
    detail: 2,
    maxDebris: 420,
    maxDecals: 160,
    drawDistance: 320
  }
};
