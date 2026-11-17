import type { Action, Settings } from "./config";
import type { Body, Command, V3 } from "./types";
import { aimDir, eye, traceWorld, type Arena } from "./world";
export class Controls {
  keys = new Set<string>();
  pressed = new Set<string>();
  released = new Set<string>();
  mouse: V3 = [0, 0, 0];
  yaw = 0;
  pitch = 0;
  aimToggle = false;
  pad = false;
  board = false;
  locked = false;
  active = false;
  private warned = false;
  private safeCrouch = false;
  private abort = new AbortController();
  private previousButtons: boolean[] = [];
  private jumpEdge = false;
  onAction: (action: Action, down: boolean) => void = () => {};
  onPause: () => void = () => {};
  onHint: (s: string) => void = () => {};
  onWheel: (dir: number) => void = () => {};
  constructor(
    private canvas: HTMLCanvasElement,
    private settings: Settings,
  ) {
    const opt = { signal: this.abort.signal };
    const change = (code: string, down: boolean) => {
      if (down) {
        if (this.keys.has(code)) return;
        this.keys.add(code);
        this.pressed.add(code);
      } else {
        this.keys.delete(code);
        this.released.add(code);
      }
      for (const [action, binding] of Object.entries(settings.binds)) {
        if (binding === code) {
          if (action === "aim" && down && settings.toggleAim)
            this.aimToggle = !this.aimToggle;
          if (action === "scoreboard") this.board = down;
          if (action === "jump" && down) this.jumpEdge = true;
          this.onAction(action as Action, down);
        }
      }
    };
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          !this.active ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        )
          return;
        if (Object.values(settings.binds).includes(e.code)) {
          e.preventDefault();
          change(e.code, true);
        }
        if (
          !document.fullscreenElement &&
          ((e.ctrlKey && e.code === "KeyW") ||
            (e.code === "ControlLeft" && this.keys.has("KeyW"))) &&
          !this.warned
        ) {
          this.warned = true;
          this.safeCrouch = true;
          this.keys.delete("ControlLeft");
          this.onHint("ctrl");
        }
        if (e.code === settings.binds.menu) this.onPause();
      },
      opt,
    );
    window.addEventListener(
      "keyup",
      (e) => {
        change(e.code, false);
      },
      opt,
    );
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.active) return;
        e.preventDefault();
        if (!this.locked) {
          void this.lock();
        }
        change("Mouse" + e.button, true);
      },
      opt,
    );
    window.addEventListener(
      "pointerup",
      (e) => change("Mouse" + e.button, false),
      opt,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opt);
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.active) {
          e.preventDefault();
          this.onWheel(e.deltaY > 0 ? 1 : -1);
        }
      },
      { ...opt, passive: false },
    );
    document.addEventListener(
      "mousemove",
      (e) => {
        if (!this.active || !this.locked) return;
        const aim = settings.toggleAim ? this.aimToggle : this.down("aim");
        const fovScale = this.currentFov / settings.fov;
        const k =
          0.002 *
          settings.sensitivity *
          (aim ? settings.adsSensitivity * fovScale : 1);
        this.yaw -= e.movementX * k;
        this.pitch = Math.max(
          -1.5,
          Math.min(
            1.5,
            this.pitch - e.movementY * k * (settings.invertY ? -1 : 1),
          ),
        );
        this.mouse[0] += e.movementX;
        this.mouse[1] += e.movementY;
      },
      opt,
    );
    document.addEventListener(
      "pointerlockchange",
      () => {
        const was = this.locked;
        this.locked = document.pointerLockElement === canvas;
        if (was && !this.locked && this.active) this.onPause();
      },
      opt,
    );
    window.addEventListener("blur", () => this.reset(), opt);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          this.reset();
          if (this.active) this.onPause();
        }
      },
      opt,
    );
  }
  currentFov = 95;
  down(a: Action) {
    return this.keys.has(this.settings.binds[a]);
  }
  reset() {
    this.keys.clear();
    this.pressed.clear();
    this.released.clear();
    this.aimToggle = false;
    this.board = false;
    this.jumpEdge = false;
  }
  async lock() {
    try {
      await this.canvas.requestPointerLock({
        unadjustedMovement: true,
      } as PointerLockOptions);
    } catch {
      try {
        await this.canvas.requestPointerLock();
      } catch {
        this.onHint("lock");
      }
    }
  }
  async fullscreen() {
    try {
      if (!document.fullscreenElement)
        await this.canvas.parentElement!.requestFullscreen();
      else await document.exitFullscreen();
      const keyboard = (
        navigator as Navigator & {
          keyboard?: { lock(keys?: string[]): Promise<void>; unlock(): void };
        }
      ).keyboard;
      if (document.fullscreenElement)
        await keyboard?.lock(
          Object.values(this.settings.binds).filter(
            (v) => !v.startsWith("Mouse") && v !== "Escape",
          ),
        );
      else keyboard?.unlock();
    } catch {
      this.onHint("fullscreen");
    }
  }
  poll(dt: number, body: Body, targets: Body[], arena: Arena) {
    const gp = navigator.getGamepads?.()?.find((g) => g?.connected);
    if (!gp) {
      this.pad = false;
      return;
    }
    this.pad = true;
    const dz = (n: number) =>
      Math.abs(n) < 0.14
        ? 0
        : Math.sign(n) * ((Math.abs(n) - 0.14) / 0.86) ** 1.5;
    const rx = dz(gp.axes[2] || 0),
      ry = dz(gp.axes[3] || 0);
    let slowdown = 1,
      magnetX = 0,
      magnetY = 0;
    if (this.down("aim")) {
      const from = eye(body);
      let best = 0.12;
      for (const t of targets) {
        if (t.id === body.id || t.hp <= 0) continue;
        const to = eye(t),
          dx = to[0] - from[0],
          dy = to[1] - from[1],
          dz = to[2] - from[2],
          dist = Math.hypot(dx, dy, dz);
        let err = Math.atan2(-dx, -dz) - this.yaw;
        err = Math.atan2(Math.sin(err), Math.cos(err));
        const ep = Math.atan2(dy, Math.hypot(dx, dz)) - this.pitch;
        const error = Math.hypot(err, ep);
        if (
          error < best &&
          traceWorld(arena, from, aimDir(this.yaw + err, this.pitch + ep), dist)
            .dist >=
            dist - 0.4
        ) {
          best = error;
          slowdown = 1 - this.settings.aimAssist * 0.65;
          if (Math.hypot(rx, ry) > 0.02) {
            magnetX = err * this.settings.aimAssist * dt * 2;
            magnetY = ep * this.settings.aimAssist * dt * 2;
          }
        }
      }
    }
    const scale = this.currentFov / this.settings.fov;
    this.yaw -= rx * dt * 2.5 * slowdown * scale;
    this.pitch -=
      ry * dt * 2.1 * slowdown * scale * (this.settings.invertY ? -1 : 1);
    this.yaw += magnetX;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + magnetY));
    this.padX = dz(gp.axes[0] || 0);
    this.padZ = -dz(gp.axes[1] || 0);
    const mapping: Record<number, Action> = {
      0: "jump",
      1: "crouchAlt",
      2: "reload",
      3: "weapon2",
      5: "grenade",
      6: "aim",
      7: "fire",
      9: "menu",
      10: "sprint",
      11: "melee",
    };
    for (const [index, a] of Object.entries(mapping)) {
      const i = Number(index),
        down = gp.buttons[i]?.pressed || false;
      if (down !== !!this.previousButtons[i]) {
        if (a === "weapon2") {
          if (down) this.onWheel(1);
        } else if (a === "menu") {
          if (down) this.onPause();
        } else {
          const key = this.settings.binds[a];
          if (down) {
            this.keys.add(key);
            if (a === "jump") this.jumpEdge = true;
            if (a === "aim" && this.settings.toggleAim)
              this.aimToggle = !this.aimToggle;
          } else this.keys.delete(key);
          this.onAction(a, down);
        }
        this.previousButtons[i] = down;
      }
    }
  }
  padX = 0;
  padZ = 0;
  command(seq: number): Command {
    const c = {
      seq,
      x:
        (this.down("right") ? 1 : 0) -
        (this.down("left") ? 1 : 0) +
        (this.pad ? this.padX : 0),
      z:
        (this.down("forward") ? 1 : 0) -
        (this.down("backward") ? 1 : 0) +
        (this.pad ? this.padZ : 0),
      yaw: this.yaw,
      pitch: this.pitch,
      jump: this.jumpEdge,
      crouch:
        this.down("crouchAlt") ||
        (this.down("crouch") &&
          (!!document.fullscreenElement ||
            (!this.safeCrouch && !this.down("forward")))),
      sprint: this.down("sprint"),
      aim: this.settings.toggleAim ? this.aimToggle : this.down("aim"),
    };
    this.jumpEdge = false;
    return c;
  }
  rumble() {
    const pad = navigator.getGamepads?.()?.find((g) => g?.connected);
    const actuator = pad?.vibrationActuator;
    void actuator
      ?.playEffect("dual-rumble", {
        duration: 55,
        strongMagnitude: 0.3,
        weakMagnitude: 0.4,
      })
      .catch(() => {});
  }
  dispose() {
    this.abort.abort();
    if (this.locked) document.exitPointerLock();
    (
      navigator as Navigator & { keyboard?: { unlock(): void } }
    ).keyboard?.unlock();
  }
}
