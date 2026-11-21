import * as THREE from 'three';

/** Shadow-map texels the filter averages across: the penumbra is about this wide. */
export const SHADOW_BOX = 4;

/**
 * Box filter over bilinear depth comparisons: (SHADOW_BOX + 1)² fetches whose edge rows are weighted by the
 * sub-texel position, so the penumbra is one smooth ramp at any magnification.
 */
const SMOOTH_PCF = /* glsl */ `
			vec2 shadowTexel = shadowCoord.xy * shadowMapSize - 0.5 - float( ${SHADOW_BOX - 1} ) * 0.5;
			vec2 shadowBase = floor( shadowTexel );
			vec2 shadowFract = shadowTexel - shadowBase;
			float shadowSum = 0.0;
			for ( int sy = 0; sy <= ${SHADOW_BOX}; sy ++ ) {
				float wy = sy == 0 ? 1.0 - shadowFract.y : ( sy == ${SHADOW_BOX} ? shadowFract.y : 1.0 );
				for ( int sx = 0; sx <= ${SHADOW_BOX}; sx ++ ) {
					float wx = sx == 0 ? 1.0 - shadowFract.x : ( sx == ${SHADOW_BOX} ? shadowFract.x : 1.0 );
					shadowSum += wx * wy * texture2DCompare( shadowMap, ( shadowBase + vec2( sx, sy ) + 0.5 ) / shadowMapSize, shadowCoord.z );
				}
			}
			shadow = shadowSum / float( ${SHADOW_BOX * SHADOW_BOX} );
`;

let installed = false;

/**
 * three r170's PCF takes 17 nearest-texel taps up to `radius` texels apart, which draws shadow edges as stepped
 * bands and, where an edge crosses a curved suit, a diamond hatch. Swap in the smooth filter for every material.
 */
export function installSmoothShadows() {
  if (installed) return;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const start = chunk.indexOf('#if defined( SHADOWMAP_TYPE_PCF )');
  const end = chunk.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
  if (start < 0 || end < start) throw new Error('shadowmap_pars_fragment changed: smooth PCF not installed');
  THREE.ShaderChunk.shadowmap_pars_fragment = `${chunk.slice(0, start)}#if defined( SHADOWMAP_TYPE_PCF )\n${SMOOTH_PCF}\n\t\t${chunk.slice(end)}`;
  installed = true;
}
