import type { Settings, WeaponId } from "./config";
import type { V3 } from "./types";
type Voice = {
  nodes: AudioScheduledSourceNode[];
  end: number;
  priority: number;
  gain: GainNode;
};
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ui: GainNode | null = null;
  private music: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices: Voice[] = [];
  private heart = 0;
  private musicTime = 0;
  private fragmentTime = 0;
  constructor(private settings: Settings) {}
  unlock() {
    if (!this.ctx) {
      const c = (this.ctx = new AudioContext());
      this.master = c.createGain();
      this.sfx = c.createGain();
      this.ui = c.createGain();
      this.music = c.createGain();
      this.filter = c.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 20000;
      this.sfx.connect(this.filter).connect(this.master);
      this.ui.connect(this.master);
      this.music.connect(this.filter);
      this.master.connect(c.destination);
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume();
    this.mix();
  }
  mix() {
    if (!this.ctx || !this.master || !this.sfx || !this.ui || !this.music)
      return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(
      document.hidden ? 0 : this.settings.master,
      t,
      0.025,
    );
    this.sfx.gain.setTargetAtTime(this.settings.effects, t, 0.025);
    this.ui.gain.setTargetAtTime(this.settings.ui, t, 0.025);
    this.music.gain.setTargetAtTime(this.settings.music, t, 0.05);
  }
  private play(
    freq: number,
    duration: number,
    volume: number,
    kind: OscillatorType | "noise",
    priority = 1,
    pos?: V3,
    delay = 0,
    band = "sfx",
    lowpass = 16000,
  ) {
    const c = this.ctx;
    if (!c || !this.master || !this.sfx || !this.ui || !this.music) return;
    this.voices = this.voices.filter((v) => v.end > c.currentTime);
    if (this.voices.length >= 32) {
      const low = this.voices.reduce((a, b) =>
        a.priority < b.priority ? a : b,
      );
      if (low.priority > priority) return;
      low.gain.gain.setTargetAtTime(0, c.currentTime, 0.005);
      low.nodes.forEach((n) => {
        try {
          n.stop(c.currentTime);
        } catch {}
      });
      this.voices.splice(this.voices.indexOf(low), 1);
    }
    const at = c.currentTime + delay;
    const g = c.createGain(),
      filter = c.createBiquadFilter();
    filter.type = kind === "noise" ? "bandpass" : "lowpass";
    filter.frequency.value = kind === "noise" ? freq : lowpass;
    filter.Q.value = kind === "noise" ? 0.7 : 0.1;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    filter.connect(g);
    const out =
      band === "ui" ? this.ui : band === "music" ? this.music : this.sfx;
    let panner: PannerNode | undefined;
    if (pos) {
      panner = c.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 3;
      panner.maxDistance = 100;
      panner.rolloffFactor = 1.2;
      panner.positionX.value = pos[0];
      panner.positionY.value = pos[1];
      panner.positionZ.value = pos[2];
      g.connect(panner).connect(out);
    } else g.connect(out);
    const node =
      kind === "noise" ? c.createBufferSource() : c.createOscillator();
    if (node instanceof AudioBufferSourceNode) {
      node.buffer = this.noise;
      node.playbackRate.value = 0.95 + Math.random() * 0.1;
    } else {
      node.type = kind as OscillatorType;
      node.frequency.setValueAtTime(freq, at);
      node.frequency.exponentialRampToValueAtTime(
        Math.max(30, freq * 0.45),
        at + duration,
      );
    }
    node.connect(filter);
    node.start(at);
    node.stop(at + duration);
    node.onended = () => {
      node.disconnect();
      filter.disconnect();
      g.disconnect();
      panner?.disconnect();
    };
    this.voices.push({ nodes: [node], end: at + duration, priority, gain: g });
  }
  shot(w: WeaponId, pos?: V3, dist = 0) {
    const base = [135, 80, 62, 210][w],
      delay = dist / 343,
      cut = Math.max(700, 14000 / (1 + dist * 0.09));
    this.play(1700, 0.035, 0.24, "square", 4, pos, delay, "sfx", cut);
    this.play(
      base,
      0.16,
      w === 1 ? 0.7 : 0.48,
      "sawtooth",
      4,
      pos,
      delay,
      "sfx",
      cut,
    );
    this.play(
      Math.min(cut, 650),
      0.34,
      w === 2 ? 0.5 : 0.22,
      "noise",
      3,
      pos,
      delay + 0.035,
    );
  }
  step(kind = "plate", sprint = false, crouch = false, land = false, pos?: V3) {
    this.play(
      kind === "metal" ? 2200 : kind === "tile" ? 1500 : 950,
      land ? 0.13 : 0.045,
      (land ? 0.24 : sprint ? 0.13 : 0.085) * (crouch ? 0.4 : 1),
      "noise",
      1,
      pos,
    );
    this.play(land ? 110 : 240, 0.04, land ? 0.12 : 0.045, "triangle", 1, pos);
  }
  reload(node: number, pos?: V3) {
    this.play([950, 1700, 500, 2300][node % 4], 0.055, 0.16, "square", 2, pos);
    this.play(1200, 0.055, 0.1, "noise", 2, pos);
  }
  impact(kind = "plate", pos?: V3) {
    this.play(
      kind === "metal" ? 3300 : kind === "tile" ? 2100 : 1300,
      0.045,
      0.11,
      "triangle",
      1,
      pos,
    );
  }
  fragment(pos: V3) {
    if (!this.ctx || this.ctx.currentTime - this.fragmentTime < 0.065) return;
    this.fragmentTime = this.ctx.currentTime;
    this.impact("plate", pos);
  }
  hit(head = false) {
    this.play(head ? 1650 : 1050, 0.07, 0.18, "sine", 6, undefined, 0, "ui");
    if (head) this.play(2250, 0.09, 0.14, "sine", 6, undefined, 0.025, "ui");
  }
  kill() {
    [780, 1170, 1560].forEach((f, i) =>
      this.play(f, 0.14, 0.15, "triangle", 7, undefined, i * 0.045, "ui"),
    );
  }
  explosion(pos: V3) {
    this.play(75, 0.6, 0.8, "sawtooth", 5, pos);
    this.play(420, 0.65, 0.6, "noise", 5, pos);
  }
  click() {
    this.play(700, 0.035, 0.12, "triangle", 2, undefined, 0, "ui");
  }
  melee(pos?: V3) {
    this.play(650, 0.14, 0.14, "noise", 3, pos);
  }
  update(
    pos: V3,
    yaw: number,
    pitch: number,
    hp: number,
    dt: number,
    menu: boolean,
  ) {
    if (!this.ctx || !this.filter) return;
    this.mix();
    const l = this.ctx.listener;
    [l.positionX.value, l.positionY.value, l.positionZ.value] = pos;
    l.forwardX.value = -Math.sin(yaw) * Math.cos(pitch);
    l.forwardY.value = Math.sin(pitch);
    l.forwardZ.value = -Math.cos(yaw) * Math.cos(pitch);
    l.upY.value = 1;
    this.filter.frequency.setTargetAtTime(
      hp > 0 && hp < 30 ? 1000 : 18000,
      this.ctx.currentTime,
      0.2,
    );
    this.heart -= dt;
    if (hp > 0 && hp < 30 && this.heart <= 0) {
      this.heart = 0.7;
      this.play(65, 0.16, 0.28, "sine", 5);
      this.play(55, 0.14, 0.17, "sine", 5, undefined, 0.18);
    }
    this.musicTime -= dt;
    if (menu && this.musicTime < 0) {
      this.musicTime = 0.4;
      const notes = [220, 277, 330, 440, 330, 277, 247, 330];
      this.play(
        notes[Math.floor(this.ctx.currentTime / 0.4) % 8],
        0.35,
        0.045,
        "sine",
        0,
        undefined,
        0,
        "music",
      );
    }
  }
  dispose() {
    void this.ctx?.close();
  }
}
