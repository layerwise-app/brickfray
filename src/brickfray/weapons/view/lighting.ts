import * as THREE from 'three';
import { DataUtils } from 'three';
import type { Kit } from '../../engine/kit';
import { DEFAULT_ATMOSPHERE, plainLights, type Atmosphere } from '../../engine/renderer';

/**
 * Lights and reflections for the view layer. They live in a group that is
 * counter-rotated against the world camera, so the gun is lit from where the
 * world sun really is as the player turns.
 */
export class ViewLighting {
  readonly group = new THREE.Group();
  private readonly hemi = new THREE.HemisphereLight();
  private readonly sun = new THREE.DirectionalLight();
  private readonly fill = new THREE.DirectionalLight();
  private envTexture: THREE.DataTexture | null = null;
  private readonly inverse = new THREE.Quaternion();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly kit: Kit
  ) {
    this.group.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    scene.add(this.group);
    this.setAtmosphere(DEFAULT_ATMOSPHERE);
  }

  setAtmosphere(a: Atmosphere) {
    const pbr = this.kit.profile.pbr;
    this.sun.position.copy(a.sunDirection).multiplyScalar(5);
    if (pbr) {
      this.sun.color.set(a.sunColor);
      this.sun.intensity = a.sunIntensity * 0.95;
      this.hemi.color.set(a.horizon).lerp(new THREE.Color(a.zenith), 0.3);
      this.hemi.groundColor.set(a.ground);
      this.hemi.intensity = 0.6;
    } else {
      const l = plainLights(a);
      this.sun.color.copy(l.sun);
      this.sun.intensity = l.sunIntensity;
      this.hemi.color.copy(l.sky);
      this.hemi.groundColor.copy(l.ground);
      this.hemi.intensity = l.hemi;
    }
    // A soft camera-side fill keeps the shadowed side of the gun from going flat black.
    this.fill.color.set(a.horizon);
    this.fill.intensity = pbr ? 0.35 : 0.3;
    this.fill.position.set(-0.6, 0.3, 1).multiplyScalar(5);
    this.envTexture?.dispose();
    this.envTexture = pbr ? skyTexture(a) : null;
    this.scene.environment = this.envTexture;
  }

  /** World camera orientation; lights and reflections stay fixed in the world. */
  orient(cameraQuaternion: THREE.Quaternion) {
    this.inverse.copy(cameraQuaternion).invert();
    this.group.quaternion.copy(this.inverse);
    // three.js builds the lookup matrix from the negated Euler angles, so negate to get exactly the camera rotation.
    const e = this.scene.environmentRotation.setFromQuaternion(cameraQuaternion, 'XYZ');
    e.set(-e.x, -e.y, -e.z, 'XYZ');
  }

  dispose() {
    this.envTexture?.dispose();
    this.group.removeFromParent();
  }
}

/** Equirectangular HDR sky (gradient, sun, a soft key panel); three.js prefilters it on first use. */
function skyTexture(a: Atmosphere): THREE.DataTexture {
  const w = 128;
  const h = 64;
  const data = new Uint16Array(w * h * 4);
  const zenith = new THREE.Color(a.zenith);
  const horizon = new THREE.Color(a.horizon);
  const ground = new THREE.Color(a.ground).multiplyScalar(0.8);
  const sunColor = new THREE.Color(a.sunColor);
  const dir = new THREE.Vector3();
  const c = new THREE.Color();
  for (let y = 0; y < h; y++) {
    const lat = ((y + 0.5) / h - 0.5) * Math.PI;
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w - 0.5) * Math.PI * 2;
      dir.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      const up = dir.y;
      if (up >= 0) c.copy(horizon).lerp(zenith, Math.pow(Math.min(1, up / 0.62), 0.8));
      else c.copy(horizon).lerp(ground, Math.min(1, -up / 0.12));
      const s = Math.max(0, dir.dot(a.sunDirection));
      c.r += sunColor.r * (Math.pow(s, 400) * 40 + Math.pow(s, 12) * 0.5);
      c.g += sunColor.g * (Math.pow(s, 400) * 40 + Math.pow(s, 12) * 0.5);
      c.b += sunColor.b * (Math.pow(s, 400) * 40 + Math.pow(s, 12) * 0.5);
      const i = (y * w + x) * 4;
      data[i] = DataUtils.toHalfFloat(c.r);
      data[i + 1] = DataUtils.toHalfFloat(c.g);
      data[i + 2] = DataUtils.toHalfFloat(c.b);
      data[i + 3] = DataUtils.toHalfFloat(1);
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}
