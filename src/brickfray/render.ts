import * as T from "three";
import { COLORS, WEAPONS, type Settings, type WeaponId } from "./config";
import { buildArena, type Arena } from "./world";
import type { Body, V3 } from "./types";
const cube = new T.BoxGeometry(1, 1, 1),
  dummy = new T.Object3D(),
  col = new T.Color();
const vert = `varying vec3 vP; varying vec3 vN; varying vec3 vW; varying vec3 vC; varying vec3 vS;
void main(){vP=position;vec4 p=vec4(position,1.);vec3 n=normal;vS=vec3(1.);vC=vec3(1.);
#ifdef USE_INSTANCING
vS=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
p=instanceMatrix*p;n=mat3(instanceMatrix)*(normal/(vS*vS));
#endif
#ifdef USE_INSTANCING_COLOR
vC=instanceColor;
#endif
vW=(modelMatrix*p).xyz;vN=normalize(mat3(modelMatrix)*n);gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`;
const frag = `uniform vec3 uColor;uniform float uBrick;uniform float uFloor;uniform float uFlash;varying vec3 vP;varying vec3 vN;varying vec3 vW;varying vec3 vC;varying vec3 vS;
void main(){vec3 n=normalize(vN);vec3 p=vP*vS;vec3 an=abs(n);vec2 uv=an.y>.6?p.xz:an.x>.6?p.zy:p.xy;
vec2 cell=an.y>.6?vec2(1.):vec2(1.5,.65);vec2 q=uv/cell;vec2 edge=min(fract(q),1.-fract(q))*cell;vec2 aa=max(fwidth(uv),vec2(.001));float fade=1.-smoothstep(.06,.3,max(aa.x,aa.y));float seam=1.-smoothstep(.008,.025+max(aa.x,aa.y),min(edge.x,edge.y));
vec3 c=uColor*vC; c*=1.-seam*.25*fade*uBrick;
// Analytic bevel follows each instance's dimensions, including rectangular bricks.
vec3 e=(vec3(.5)-abs(vP))*vS;float bevel=an.y>.6?min(e.x,e.z):an.x>.6?min(e.y,e.z):min(e.x,e.y);c*=.89+.11*smoothstep(0.,.065,bevel);
if(uFloor>.5){vec2 r=fract(vW.xz)-.5;float d=length(r);float fw=max(fwidth(d),.002);float mask=1.-smoothstep(.23-fw,.23+fw,d);float visibility=1.-smoothstep(.09,.35,fw);n=normalize(n+vec3(r.x*.9,0.,r.y*.9)*mask*visibility);c*=1.-(smoothstep(.22-fw,.22+fw,d)-smoothstep(.26-fw,.26+fw,d))*.28*visibility;c+=vec3(.05)*mask*visibility;}
vec3 l=normalize(vec3(-.45,.85,.3));vec3 v=normalize(cameraPosition-vW);float diffuse=max(dot(n,l),0.);vec3 hemi=mix(vec3(.42,.48,.51),vec3(.84,.91,1.),n.y*.5+.5);float spec=pow(max(dot(n,normalize(l+v)),0.),52.)*.48;float fres=pow(1.-max(dot(n,v),0.),3.)*.07;vec3 lit=c*(hemi*.64+diffuse*.62)+spec+fres;lit=mix(lit,vec3(1.),uFlash);float fog=smoothstep(32.,100.,distance(cameraPosition,vW));gl_FragColor=vec4(mix(lit,vec3(.75,.85,.87),fog),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function plastic(color = "#ffffff", brick = false, floor = false) {
  return new T.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uColor: { value: new T.Color(color) },
      uBrick: { value: brick ? 1 : 0 },
      uFloor: { value: floor ? 1 : 0 },
      uFlash: { value: 0 },
    },
  });
}
function put(
  mesh: T.InstancedMesh,
  index: number,
  p: V3,
  s: V3,
  color: string,
  rot?: V3,
) {
  dummy.position.set(...p);
  dummy.scale.set(...s);
  dummy.rotation.set(...(rot || [0, 0, 0]));
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
  mesh.setColorAt(index, col.set(color));
}
const hideMatrix = new T.Matrix4().makeScale(0, 0, 0);
interface Particle {
  p: T.Vector3;
  v: T.Vector3;
  rot: T.Vector3;
  spin: T.Vector3;
  size: V3;
  life: number;
  color: string;
  bounced: number;
}
export class ParticlePool {
  mesh: T.InstancedMesh;
  items: (Particle | null)[];
  cursor = 0;
  activeLimit = 320;
  constructor(
    scene: T.Scene,
    readonly capacity: number,
    geometry: T.BufferGeometry = cube,
  ) {
    this.activeLimit = capacity;
    this.mesh = new T.InstancedMesh(geometry, plastic(), capacity);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.items = Array(capacity).fill(null);
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, hideMatrix);
    scene.add(this.mesh);
  }
  spawn(p: V3, v: V3, color: string, size: V3 = [0.12, 0.12, 0.12], life = 3) {
    const i = this.cursor++ % Math.max(1, this.activeLimit);
    this.items[i] = {
      p: new T.Vector3(...p),
      v: new T.Vector3(...v),
      rot: new T.Vector3(),
      spin: new T.Vector3(
        Math.random() * 6,
        Math.random() * 6,
        Math.random() * 6,
      ),
      size,
      life,
      color,
      bounced: 0,
    };
  }
  tick(dt: number, limit = this.capacity, bounce?: (p: V3) => void) {
    this.activeLimit = Math.min(this.capacity, limit);
    for (let i = 0; i < this.capacity; i++) {
      const a = this.items[i];
      if (!a) continue;
      a.life -= dt;
      if (a.life <= 0 || i >= limit) {
        this.items[i] = null;
        this.mesh.setMatrixAt(i, hideMatrix);
        continue;
      }
      a.v.y -= 18 * dt;
      a.p.addScaledVector(a.v, dt);
      a.rot.addScaledVector(a.spin, dt);
      if (a.p.y < a.size[1] * 0.5) {
        a.p.y = a.size[1] * 0.5;
        if (a.v.y < -0.8 && a.bounced < 3) {
          a.v.y *= -0.36;
          a.v.x *= 0.6;
          a.v.z *= 0.6;
          a.bounced++;
          bounce?.(a.p.toArray() as V3);
        } else {
          a.v.set(0, 0, 0);
          a.spin.set(0, 0, 0);
        }
      }
      const fade = Math.min(1, a.life * 2);
      put(
        this.mesh,
        i,
        a.p.toArray() as V3,
        a.size.map((n) => n * fade) as V3,
        a.color,
        a.rot.toArray() as V3,
      );
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    (this.mesh.material as T.Material).dispose();
  }
}
export class Renderer {
  onFragment: (p: V3) => void = () => {};
  readonly gl: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(95, 1, 0.05, 160);
  readonly viewScene = new T.Scene();
  readonly viewCamera = new T.PerspectiveCamera(65, 1, 0.02, 10);
  arena: Arena = buildArena("plaza");
  private mapGroup = new T.Group();
  private actors = new T.InstancedMesh(cube, plastic(), 1024);
  private shadows: T.InstancedMesh;
  private propShadows: { p: V3; s: V3 }[] = [];
  private shadowMat: T.ShaderMaterial;
  readonly debris: ParticlePool;
  readonly shells: ParticlePool;
  private holes = new T.InstancedMesh(
    new T.CircleGeometry(1, 10),
    new T.MeshBasicMaterial({
      color: 0x263747,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    128,
  );
  private holeIndex = 0;
  private tracers = new T.InstancedMesh(
    cube,
    new T.MeshBasicMaterial({ color: 0xffdc96 }),
    64,
  );
  private traces: { a: T.Vector3; b: T.Vector3; life: number }[] = [];
  private bombs = new T.InstancedMesh(cube, plastic("#71895f"), 32);
  private grenadeHand = new T.Group();
  private gun = new T.Group();
  private magazine = new T.Group();
  private bolt = new T.Group();
  private support = new T.Group();
  private hammer = new T.Group();
  private flash = new T.Group();
  private weapon: WeaponId = 0;
  kick = 0;
  velocity = 0;
  rotKick = 0;
  private rollKick = 0;
  land = 0;
  sway = new T.Vector2();
  ads = 0;
  switchT = 0;
  private swapping: { to: WeaponId; elapsed: number; duration: number } | null =
    null;
  private step = 0;
  private lastGround = true;
  private poseLean = 0;
  private eyeHeight = 1.65;
  private width = 1;
  private height = 1;
  private resizeObserver: ResizeObserver;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly settings: Settings,
  ) {
    this.gl = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.gl.setClearColor("#c0d7dd");
    this.gl.outputColorSpace = T.SRGBColorSpace;
    this.gl.autoClear = false;
    this.gl.info.autoReset = false;
    this.scene.add(
      this.mapGroup,
      this.actors,
      this.holes,
      this.tracers,
      this.bombs,
    );
    this.bombs.count = 0;
    this.bombs.frustumCulled = false;
    this.actors.frustumCulled = false;
    this.tracers.frustumCulled = false;
    this.holes.frustumCulled = false;
    for (let i = 0; i < 128; i++) this.holes.setMatrixAt(i, hideMatrix);
    for (let i = 0; i < 64; i++) this.tracers.setMatrixAt(i, hideMatrix);
    this.shadowMat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 uvv;void main(){uvv=uv;vec4 p=vec4(position,1.);
#ifdef USE_INSTANCING
p=instanceMatrix*p;
#endif
gl_Position=projectionMatrix*modelViewMatrix*p;}`,
      fragmentShader: `varying vec2 uvv;void main(){float a=1.-smoothstep(.05,.5,length(uvv-.5));gl_FragColor=vec4(.12,.19,.22,a*.25);}`,
    });
    this.shadows = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      this.shadowMat,
      160,
    );
    this.shadows.frustumCulled = false;
    this.scene.add(this.shadows);
    this.debris = new ParticlePool(this.scene, 320);
    this.shells = new ParticlePool(
      this.scene,
      96,
      new T.CylinderGeometry(0.5, 0.5, 1, 8),
    );
    this.viewScene.add(this.gun, this.hammer, this.grenadeHand);
    this.mesh(this.grenadeHand, [0, 0, 0], [0.18, 0.22, 0.18], "#71895f");
    this.mesh(this.grenadeHand, [0, 0.14, 0], [0.07, 0.06, 0.07], "#e5c97b");
    this.mesh(
      this.grenadeHand,
      [-0.02, -0.12, 0.06],
      [0.17, 0.14, 0.2],
      "#ecc998",
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.setMap("plaza");
    this.buildGun(0);
    this.resize();
  }
  resize() {
    this.width = Math.max(1, this.canvas.clientWidth);
    this.height = Math.max(1, this.canvas.clientHeight);
    this.gl.setPixelRatio(
      Math.min(devicePixelRatio, 2) * this.settings.resolution,
    );
    this.gl.setSize(this.width, this.height, false);
    for (const c of [this.camera, this.viewCamera]) {
      c.aspect = this.width / this.height;
      c.updateProjectionMatrix();
    }
  }
  setMap(id: Arena["id"]) {
    this.arena = buildArena(id);
    this.mapGroup.traverse((o) => {
      if (o instanceof T.Mesh) {
        if (o.geometry !== cube) o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
        if (o instanceof T.InstancedMesh) o.dispose();
      }
    });
    this.mapGroup.clear();
    const a = this.arena;
    this.propShadows = a.bricks
      .filter(
        (b) =>
          b.p[1] - b.s[1] / 2 < 0.02 && b.s[1] < 5 && b.s[0] < 8 && b.s[2] < 8,
      )
      .slice(0, 48)
      .map((b) => ({
        p: [b.p[0], 0.012, b.p[2]],
        s: [b.s[0] * 1.5, b.s[2] * 1.5, 1],
      }));
    const bricks = new T.InstancedMesh(
      cube,
      plastic("#ffffff", true),
      a.bricks.length,
    );
    a.bricks.forEach((b, i) => put(bricks, i, b.p, b.s, b.color));
    bricks.instanceMatrix.needsUpdate = true;
    this.mapGroup.add(bricks);
    const floor = new T.Mesh(
      new T.PlaneGeometry(64, 64),
      plastic(a.ground, false, true),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    this.mapGroup.add(floor);
    const studs: { p: V3; color: string }[] = [];
    for (const b of a.bricks) {
      if (!b.studs || b.s[1] > 10) continue;
      const top = b.p[1] + b.s[1] / 2;
      for (let x = -b.s[0] / 2 + 0.5; x < b.s[0] / 2; x++)
        for (let z = -b.s[2] / 2 + 0.5; z < b.s[2] / 2; z++) {
          const px = b.p[0] + x,
            pz = b.p[2] + z;
          if (
            a.bricks.some(
              (c) =>
                c !== b &&
                c.p[1] + c.s[1] / 2 > top + 0.01 &&
                c.p[1] - c.s[1] / 2 <= top + 0.3 &&
                Math.abs(px - c.p[0]) < c.s[0] / 2 &&
                Math.abs(pz - c.p[2]) < c.s[2] / 2,
            )
          )
            continue;
          studs.push({ p: [px, top + 0.075, pz], color: b.color });
        }
    }
    const stud = new T.InstancedMesh(
      new T.CylinderGeometry(
        0.23,
        0.23,
        0.15,
        Math.max(6, Math.min(16, Math.round(this.settings.studSegments))),
      ),
      plastic(),
      studs.length,
    );
    studs.forEach((b, i) => put(stud, i, b.p, [1, 1, 1], b.color));
    this.mapGroup.add(stud);
    for (let i = 0; i < 128; i++) this.holes.setMatrixAt(i, hideMatrix);
    this.holes.instanceMatrix.needsUpdate = true;
  }
  private mesh(g: T.Group, p: V3, s: V3, c: string) {
    const m = new T.Mesh(cube, plastic(c));
    m.position.set(...p);
    m.scale.set(...s);
    g.add(m);
    return m;
  }
  buildGun(id: WeaponId) {
    this.weapon = id;
    this.gun.traverse((o) => {
      if (o instanceof T.Mesh) (o.material as T.Material).dispose();
    });
    this.gun.clear();
    this.magazine = new T.Group();
    this.bolt = new T.Group();
    this.support = new T.Group();
    this.flash = new T.Group();
    const w = WEAPONS[id],
      len = id === 2 ? 0.9 : id === 3 ? 0.25 : 0.58,
      c = w.color;
    this.mesh(this.gun, [0, 0, 0], [0.15, 0.18, len], c);
    this.mesh(
      this.gun,
      [0, 0.02, -len / 2 - 0.15],
      [0.085, 0.09, 0.35],
      "#34485b",
    );
    this.mesh(
      this.gun,
      [0, -0.035, len / 2 + 0.09],
      [0.12, 0.12, id === 3 ? 0.1 : 0.28],
      "#edf0df",
    );
    this.mesh(this.gun, [0, -0.17, 0.12], [0.09, 0.2, 0.13], "#34485b");
    this.mesh(this.gun, [0, 0.11, -0.1], [0.045, 0.045, 0.3], "#eaf1df");
    // Rectangular apertures align on the view camera centre in ADS.
    for (const x of [-0.042, 0.042])
      this.mesh(this.gun, [x, 0.15, 0.08], [0.018, 0.1, 0.025], "#34485b");
    this.mesh(this.gun, [0, 0.14, -len / 2], [0.012, 0.06, 0.02], "#ff8153");
    this.mesh(this.magazine, [0, 0, 0], [0.105, 0.25, 0.15], "#536575");
    this.magazine.position.set(0, -0.2, -0.06);
    this.gun.add(this.magazine);
    this.mesh(
      this.bolt,
      [0, 0, 0],
      [0.13, 0.055, id === 1 ? 0.25 : 0.12],
      id === 1 ? "#334b60" : "#e8e1ce",
    );
    this.bolt.position.set(0.025, -0.08, -0.26);
    this.gun.add(this.bolt);
    this.mesh(this.gun, [0.045, -0.19, 0.13], [0.14, 0.15, 0.18], "#f1ba5e");
    this.mesh(this.support, [0, 0, 0], [0.16, 0.14, 0.2], "#f1ba5e");
    this.support.position.set(-0.055, -0.11, -0.25);
    this.gun.add(this.support);
    if (id === 2) {
      this.mesh(this.gun, [0, 0.19, 0], [0.15, 0.14, 0.4], "#34485b");
      this.mesh(this.gun, [0, 0.19, 0.21], [0.12, 0.1, 0.025], "#83d4ce");
    }
    for (let i = 0; i < 3; i++) {
      const m = new T.Mesh(
        new T.PlaneGeometry(0.19, 0.32),
        new T.MeshBasicMaterial({
          color: i % 2 ? "#ffffff" : "#ffe18a",
          transparent: true,
          opacity: 0.9,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      m.rotation.z = (i * Math.PI) / 3;
      this.flash.add(m);
    }
    this.flash.position.set(0, 0.02, -len / 2 - 0.34);
    this.gun.add(this.flash);
    if (!this.hammer.children.length) {
      this.mesh(this.hammer, [0, 0, 0], [0.1, 0.65, 0.1], "#e9c66d");
      this.mesh(this.hammer, [0, 0.3, 0], [0.44, 0.22, 0.24], "#ef8552");
      this.mesh(this.hammer, [0, -0.23, 0], [0.19, 0.18, 0.2], "#f1ba5e");
    }
  }
  impact(p: V3, n: V3, color: string) {
    dummy.position.set(...p).addScaledVector(new T.Vector3(...n), 0.009);
    dummy.scale.setScalar(0.047 + Math.random() * 0.025);
    dummy.quaternion.setFromUnitVectors(
      new T.Vector3(0, 0, 1),
      new T.Vector3(...n),
    );
    dummy.updateMatrix();
    this.holes.setMatrixAt(this.holeIndex++ % 128, dummy.matrix);
    this.holes.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 5; i++)
      this.debris.spawn(
        p,
        [
          n[0] * (1 + Math.random() * 2) + (Math.random() - 0.5) * 2,
          n[1] * 2 + 1 + Math.random() * 2,
          n[2] * 2 + (Math.random() - 0.5) * 2,
        ],
        color,
        [0.065, 0.065, 0.065],
        1.5,
      );
  }
  tracer(a: V3, b: V3) {
    this.traces.push({
      a: new T.Vector3(...a),
      b: new T.Vector3(...b),
      life: 0.055,
    });
    if (this.traces.length > 64) this.traces.shift();
  }
  fire(body: Body) {
    this.velocity += WEAPONS[body.weapon].kick * 20;
    this.rotKick += 0.12;
    this.rollKick += (Math.random() - 0.5) * 0.045;
    this.eject(body);
    this.flash.visible = true;
    this.flash.rotation.z = Math.random() * Math.PI;
    this.flash.userData.until = performance.now() + 45;
  }
  eject(body: Body) {
    this.shells.spawn(
      [body.pos[0], body.pos[1] + 1.4, body.pos[2]],
      [Math.cos(body.yaw) * 2, 3, Math.sin(body.yaw) * -2],
      "#e4c675",
      [0.08, 0.12, 0.08],
      4,
    );
  }
  shatter(b: Body, dir: V3 = [0, 1, 0]) {
    const color = COLORS[b.color % 10],
      scale = b.bot === "boss" ? 1.8 : 1;
    const height = b.crouch ? 0.7 : 1;
    const parts: { p: V3; s: V3; c: string }[] = [
      { p: [0, 1.52, 0], s: [0.59, 0.48, 0.51], c: color },
      { p: [0, 0.99, 0], s: [0.64, 0.56, 0.37], c: color },
      { p: [0, 0.98, 0.26], s: [0.43, 0.4, 0.2], c: "#e0e0cd" },
      { p: [0, 1.54, -0.27], s: [0.43, 0.19, 0.025], c: "#233d50" },
      {
        p: [0, 1.82, 0],
        s:
          b.accessory === 1
            ? [0.12, 0.15, 0.35]
            : b.accessory === 2
              ? [0.1, 0.4, 0.1]
              : [0.64, 0.12, 0.55],
        c: "#e8dfc7",
      },
    ];
    for (const side of [-1, 1]) {
      parts.push(
        { p: [side * 0.45, 1.02, -0.11], s: [0.2, 0.52, 0.22], c: color },
        { p: [side * 0.19, 0.37, 0], s: [0.24, 0.62, 0.28], c: "#354c61" },
        { p: [side * 0.19, 0.1, -0.09], s: [0.28, 0.18, 0.42], c: color },
      );
    }
    for (const part of parts) {
      const p = new T.Vector3(...part.p);
      p.y *= height;
      p.multiplyScalar(scale)
        .applyAxisAngle(new T.Vector3(0, 1, 0), b.yaw)
        .add(new T.Vector3(...b.pos));
      this.debris.spawn(
        p.toArray() as V3,
        [
          (Math.random() - 0.5) * 6 + dir[0] * 3,
          2 + Math.random() * 5,
          (Math.random() - 0.5) * 6 + dir[2] * 3,
        ],
        part.c,
        part.s.map((n) => n * scale) as V3,
        7,
      );
    }
  }
  explosion(p: V3) {
    for (const a of this.debris.items) {
      if (!a) continue;
      const d = a.p.clone().sub(new T.Vector3(...p));
      if (d.length() < 5) a.v.add(d.normalize().multiplyScalar(8)).y += 4;
    }
    for (let i = 0; i < 30; i++)
      this.debris.spawn(
        p,
        [
          (Math.random() - 0.5) * 12,
          2 + Math.random() * 9,
          (Math.random() - 0.5) * 12,
        ],
        i % 2 ? "#e6b762" : "#e4d8be",
        [0.16, 0.16, 0.16],
        4,
      );
    this.land = 0.1;
  }
  drawActors(
    players: Body[],
    local: string,
    now: number,
    menu = false,
    grenades: { p: V3 }[] = [],
  ) {
    let count = 0,
      sh = 0;
    for (const prop of this.propShadows)
      put(this.shadows, sh++, prop.p, prop.s, "#ffffff", [-Math.PI / 2, 0, 0]);
    for (const g of grenades.slice(0, 32))
      put(
        this.shadows,
        sh++,
        [g.p[0], 0.015, g.p[2]],
        [0.65, 0.65, 1],
        "#ffffff",
        [-Math.PI / 2, 0, 0],
      );
    for (const b of players) {
      if (b.hp <= 0 || (!menu && b.id === local)) continue;
      const color =
          b.action === "hit" && b.actionTime > 0.06
            ? "#ffffff"
            : COLORS[b.color % 10],
        scale = b.bot === "boss" ? 1.8 : 1;
      const stride =
        Math.sin(now * (b.sprint ? 15 : 10) + b.color) *
        Math.min(1, Math.hypot(b.vel[0], b.vel[2]) / 4);
      const h = b.crouch ? 0.7 : 1;
      const root = new T.Object3D();
      root.position.set(...b.pos);
      root.rotation.y = b.yaw;
      root.scale.setScalar(scale);
      root.updateMatrix();
      const part = (p: V3, s: V3, c: string, r: V3 = [0, 0, 0]) => {
        dummy.position.set(...p);
        dummy.scale.set(...s);
        dummy.rotation.set(...r);
        dummy.updateMatrix();
        dummy.matrix.premultiply(root.matrix);
        this.actors.setMatrixAt(count, dummy.matrix);
        this.actors.setColorAt(count++, col.set(c));
      };
      const bob = b.grounded ? Math.abs(stride) * 0.045 : 0;
      part([0, 0.99 * h + bob, 0], [0.64, 0.56, 0.37], color, [
        b.pitch * 0.35,
        0,
        0,
      ]);
      part([0, 1.52 * h + bob, 0], [0.59, 0.48, 0.51], color, [
        b.pitch * 0.7,
        0,
        0,
      ]);
      part([0, 1.54 * h + bob, -0.263], [0.43, 0.19, 0.025], "#233d50", [
        b.pitch * 0.7,
        0,
        0,
      ]);
      part([-0.12, 1.56 * h + bob, -0.283], [0.075, 0.055, 0.027], "#c5f5e5");
      part([0.12, 1.56 * h + bob, -0.283], [0.075, 0.055, 0.027], "#c5f5e5");
      part([0, 0.98 * h, 0.26], [0.43, 0.4, 0.2], "#e0e0cd");
      for (const side of [-1, 1]) {
        part([side * 0.19, 0.37 * h, 0], [0.24, 0.62 * h, 0.28], "#354c61", [
          side * stride * 0.58,
          0,
          0,
        ]);
        part([side * 0.19, 0.1, -0.09], [0.28, 0.18, 0.42], color);
        const throwArm =
          b.action === "grenade" ? Math.sin(b.actionTime * 8) : 0;
        part([side * 0.45, 1.02 * h, -0.11], [0.2, 0.52, 0.22], color, [
          (b.aim ? -0.95 : b.sprint ? -0.4 + side * stride * 0.3 : -0.7) -
            b.pitch +
            (b.action === "reload" ? Math.sin(b.actionTime * 10) * 0.5 : 0) -
            throwArm,
          0,
          side * 0.1,
        ]);
        part([side * 0.45, 0.85 * h, -0.31], [0.22, 0.2, 0.23], "#e7cf9e");
      }
      part(
        [0.32, 1.02 * h, -0.52],
        [0.14, 0.16, 0.65],
        WEAPONS[b.weapon].color,
        [-b.pitch, 0, 0],
      );
      if (b.action === "shot" && b.actionTime > 0.15)
        part([0.32, 1.02 * h, -0.92], [0.23, 0.19, 0.14], "#fff2a6", [
          0,
          0,
          now * 37,
        ]);
      if (b.accessory === 1) {
        part([0, 1.82 * h, 0], [0.12, 0.15, 0.35], "#edca57");
      } else if (b.accessory === 2) {
        part([0.29, 1.83 * h, 0], [0.045, 0.38, 0.045], "#34495a");
        part([0.29, 2.03 * h, 0], [0.13, 0.1, 0.13], "#f4bd4c");
      } else {
        part([0, 1.79 * h, 0], [0.64, 0.12, 0.55], "#e8dfc7");
      }
      put(
        this.shadows,
        sh++,
        [b.pos[0], Math.max(0.015, b.pos[1] + 0.015), b.pos[2]],
        [1.8 * scale, 1.5 * scale, 1],
        "#ffffff",
        [-Math.PI / 2, 0, 0],
      );
    }
    this.actors.count = count;
    this.shadows.count = sh;
    this.actors.instanceMatrix.needsUpdate = true;
    if (this.actors.instanceColor) this.actors.instanceColor.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;
  }
  render(
    dt: number,
    body: Body,
    players: Body[],
    menu: boolean,
    correction: V3 = [0, 0, 0],
    mouse: V3 = [0, 0, 0],
    breath = 0,
    grenades: { p: V3; fuse: number }[] = [],
  ) {
    const now = performance.now() / 1000;
    this.bombs.count = Math.min(32, grenades.length);
    grenades
      .slice(0, 32)
      .forEach((g, i) =>
        put(
          this.bombs,
          i,
          g.p,
          [0.22, 0.25, 0.22],
          g.fuse < 0.6 ? "#f6b04d" : "#71895f",
          [now * 2, now * 3, 0],
        ),
      );
    this.bombs.instanceMatrix.needsUpdate = true;
    if (this.bombs.instanceColor) this.bombs.instanceColor.needsUpdate = true;
    this.debris.tick(dt, this.settings.debris, this.onFragment);
    this.shells.tick(dt, 96, this.onFragment);
    for (let i = this.traces.length - 1; i >= 0; i--)
      if ((this.traces[i].life -= dt) <= 0) this.traces.splice(i, 1);
    this.tracers.count = this.traces.length;
    this.traces.forEach((t, i) => {
      dummy.position.copy(t.a).add(t.b).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        t.b.clone().sub(t.a).normalize(),
      );
      dummy.scale.set(0.015, 0.015, t.a.distanceTo(t.b));
      dummy.updateMatrix();
      this.tracers.setMatrixAt(i, dummy.matrix);
    });
    this.tracers.instanceMatrix.needsUpdate = true;
    if (menu) {
      this.camera.position.set(18 + Math.sin(now * 0.06) * 2, 12, 23);
      this.camera.lookAt(1, 2, -1);
      this.camera.fov = 55;
    } else {
      this.ads +=
        Math.sign((body.aim ? 1 : 0) - this.ads) *
        Math.min(
          Math.abs((body.aim ? 1 : 0) - this.ads),
          dt / (WEAPONS[body.weapon].ads * this.settings.adsTime),
        );
      const fov = this.settings.fov;
      const aimed =
        (2 *
          Math.atan(
            Math.tan((fov * Math.PI) / 360) / WEAPONS[body.weapon].zoom,
          ) *
          180) /
        Math.PI;
      this.camera.fov = T.MathUtils.lerp(fov, aimed, this.ads);
      const targetHeight = body.crouch ? 1.05 : 1.65;
      this.eyeHeight = T.MathUtils.damp(this.eyeHeight, targetHeight, 18, dt);
      const h = this.eyeHeight;
      this.camera.position.set(
        body.pos[0] + correction[0],
        body.pos[1] + h + correction[1],
        body.pos[2] + correction[2],
      );
      this.camera.rotation.set(
        body.pitch +
          (body.weapon === 2 && body.aim && breath <= 0
            ? Math.sin(now * 1.5) * 0.0015
            : 0),
        body.yaw,
        0,
        "YXZ",
      );
    }
    this.camera.updateProjectionMatrix();
    this.drawActors(players, body.id, now, menu, grenades);
    this.gl.info.reset();
    this.gl.clear();
    this.gl.render(this.scene, this.camera);
    if (!menu && body.hp > 0) {
      if (this.weapon !== body.weapon && this.swapping?.to !== body.weapon)
        this.swapping = {
          to: body.weapon,
          elapsed: 0,
          duration: WEAPONS[body.weapon].draw,
        };
      if (this.swapping) {
        const swap = this.swapping;
        swap.elapsed += dt;
        const progress = Math.min(1, swap.elapsed / swap.duration);
        this.switchT = Math.sin(progress * Math.PI);
        if (progress >= 0.45 && this.weapon !== swap.to) this.buildGun(swap.to);
        if (progress === 1) {
          this.swapping = null;
          this.switchT = 0;
        }
      }
      const k = this.settings.stiffness;
      for (let left = dt; left > 0;) {
        const step = Math.min(left, 1 / 120);
        this.velocity +=
          (-k * this.kick - 2 * Math.sqrt(k) * this.velocity) * step;
        this.kick += this.velocity * step;
        left -= step;
      }
      this.rotKick *= Math.exp(-dt * 18);
      this.rollKick *= Math.exp(-dt * 18);
      this.land *= Math.exp(-dt * 12);
      if (!this.lastGround && body.grounded) this.land = 0.075;
      if (this.lastGround && !body.grounded && body.vel[1] > 0)
        this.land = 0.035;
      this.poseLean = T.MathUtils.damp(
        this.poseLean,
        body.sprint ? 0.65 : body.crouch ? -0.07 : 0,
        12,
        dt,
      );
      this.lastGround = body.grounded;
      this.sway.lerp(
        new T.Vector2(mouse[0] * -0.0004, mouse[1] * 0.0003),
        1 - Math.exp(-dt * 12),
      );
      const moving = Math.hypot(body.vel[0], body.vel[2]);
      this.step += moving * dt * 1.8;
      const bob =
        Math.sin(this.step) *
        Math.min(0.018, moving * 0.003) *
        (1 - this.ads * 0.85);
      const reload = body.reload > 0,
        rd = body.reloadEmpty
          ? WEAPONS[body.weapon].empty
          : WEAPONS[body.weapon].tactical;
      const r = reload ? 1 - body.reload / rd : 0;
      const reloadPose = reload ? Math.sin(Math.PI * r) : 0;
      this.gun.position.set(
        T.MathUtils.lerp(0.26, 0, this.ads) + this.sway.x,
        T.MathUtils.lerp(-0.24, -0.15, this.ads) +
          bob -
          this.land -
          reloadPose * 0.13 -
          this.switchT * 0.75,
        -0.48 + this.kick + reloadPose * 0.18,
      );
      this.gun.rotation.set(
        this.rotKick + this.sway.y + reloadPose * 0.3,
        0,
        this.poseLean + reloadPose * -0.45 + this.rollKick,
      );
      this.magazine.scale.setScalar(body.weapon === 1 ? 0.4 : 1);
      this.magazine.position.y =
        -0.2 -
        (reload && r < 0.7
          ? Math.sin(Math.min(1, r / 0.7) * Math.PI) * 0.42
          : 0);
      this.magazine.rotation.z = reloadPose * 0.2;
      this.bolt.position.z =
        -0.26 +
        (body.action === "shot" && body.weapon !== 0
          ? Math.sin(body.actionTime * 10) * 0.07
          : 0) +
        (reload && body.reloadEmpty && r > 0.8
          ? Math.sin((r - 0.8) * 5 * Math.PI) * 0.08
          : 0);
      this.support.position.y = -0.11 - reloadPose * 0.2;
      this.flash.visible = performance.now() < (this.flash.userData.until || 0);
      this.hammer.visible = body.action === "melee";
      this.hammer.position.set(0.3, -0.15, -0.65);
      this.hammer.rotation.z = -1.4 + Math.sin(body.actionTime * 8) * 2.1;
      this.gun.visible =
        !this.hammer.visible && !(body.weapon === 2 && this.ads > 0.8);
      this.support.position.z = -0.25 - (body.cook >= 0 ? 0.3 : 0);
      this.grenadeHand.visible = body.cook >= 0 || body.action === "grenade";
      this.grenadeHand.position.set(-0.28, -0.26, -0.5);
      if (body.action === "grenade") {
        this.grenadeHand.position.z -= Math.sin(body.actionTime * 6) * 0.45;
        this.grenadeHand.rotation.x = -body.actionTime * 2;
      } else this.grenadeHand.rotation.x = 0;
      this.gl.clearDepth();
      this.gl.render(this.viewScene, this.viewCamera);
    }
    return {
      calls: this.gl.info.render.calls,
      triangles: this.gl.info.render.triangles,
    };
  }
  dispose() {
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        if (o.geometry !== cube) o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
      }
    });
    this.viewScene.traverse((o) => {
      if (o instanceof T.Mesh) (o.material as T.Material).dispose();
    });
    this.gl.dispose();
  }
}
