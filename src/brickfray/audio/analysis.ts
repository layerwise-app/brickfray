export interface SoundStats {
  peak: number;
  peakDb: number;
  rmsDb: number;
  /** Max K-weighted loudness over 100 ms windows (LUFS-like). */
  loudness: number;
  duration: number;
  /** Magnitude-weighted spectral centroid in Hz. */
  centroid: number;
  nan: boolean;
}

export const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function highShelf(sr: number, f0: number, gainDb: number, q: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w = (2 * Math.PI * f0) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const s = 2 * Math.sqrt(A) * alpha;
  const a0 = A + 1 - (A - 1) * cos + s;
  return {
    b0: (A * (A + 1 + (A - 1) * cos + s)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos - s)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos)) / a0,
    a2: (A + 1 - (A - 1) * cos - s) / a0
  };
}

function highPass(sr: number, f0: number, q: number): Biquad {
  const w = (2 * Math.PI * f0) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  return { b0: (1 + cos) / 2 / a0, b1: -(1 + cos) / a0, b2: (1 + cos) / 2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

function filter(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const out = f.b0 * v + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = out;
    y[i] = out;
  }
  return y;
}

/** Max short-term (100 ms) loudness with ITU-R BS.1770 K-weighting. */
export function loudness(data: Float32Array, sr: number, window = 0.1): number {
  const k = filter(filter(data, highShelf(sr, 1681.97, 4, 0.7071)), highPass(sr, 38.13, 0.5003));
  const w = Math.max(1, Math.round(window * sr));
  let sum = 0;
  let best = 0;
  for (let i = 0; i < k.length; i++) {
    sum += k[i]! * k[i]!;
    if (i >= w) sum -= k[i - w]! * k[i - w]!;
    if (sum / w > best) best = sum / w;
  }
  return -0.691 + 10 * Math.log10(Math.max(best, 1e-12));
}

export function peakOf(data: Float32Array): number {
  let p = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]!);
    if (a > p) p = a;
  }
  return p;
}

/** Index just past the last sample above the threshold. */
export function audibleLength(data: Float32Array, thresholdDb = -66): number {
  const t = 10 ** (thresholdDb / 20);
  for (let i = data.length - 1; i >= 0; i--) if (Math.abs(data[i]!) > t) return i + 1;
  return 0;
}

/** In-place radix-2 FFT. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * wr - im[b]! * wi;
        const ti = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
      }
    }
  }
}

/** Magnitude spectrum of a Hann-windowed frame starting at `start`. */
export function spectrum(data: Float32Array, start: number, size: number): Float64Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const v = data[start + i] ?? 0;
    re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  fft(re, im);
  const mag = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) mag[i] = Math.hypot(re[i]!, im[i]!);
  return mag;
}

export function centroid(data: Float32Array, sr: number, size = 2048): number {
  let num = 0;
  let den = 0;
  for (let start = 0; start < data.length; start += size / 2) {
    const mag = spectrum(data, start, size);
    for (let i = 1; i < mag.length; i++) {
      num += ((i * sr) / size) * mag[i]!;
      den += mag[i]!;
    }
  }
  return den > 0 ? num / den : 0;
}

export function analyze(data: Float32Array, sr: number): SoundStats {
  let nan = false;
  let sq = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i]!;
    if (!Number.isFinite(v)) nan = true;
    sq += v * v;
  }
  const peak = peakOf(data);
  return {
    peak,
    peakDb: db(peak),
    rmsDb: 10 * Math.log10(Math.max(sq / Math.max(data.length, 1), 1e-18)),
    loudness: loudness(data, sr),
    duration: data.length / sr,
    centroid: centroid(data, sr),
    nan
  };
}
