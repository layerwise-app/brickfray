/** One peer link: reliable JSON messages plus a fast, lossy binary lane. */
export interface Channel {
  sendReliable(message: unknown): void;
  sendFast(data: ArrayBuffer): void;
  onReliable: ((message: unknown) => void) | null;
  onFast: ((data: ArrayBuffer) => void) | null;
  onClose: (() => void) | null;
  close(): void;
}

/** Dev network conditions applied to both directions of a loopback link. */
export interface NetConditions {
  latency: number;
  jitter: number;
  loss: number;
}

export const netConditions: NetConditions = { latency: 0, jitter: 0, loss: 0 };

/** In-memory pair for solo play and the host's own player; honors `netConditions` for testing. */
export function loopbackPair(): [Channel, Channel] {
  const make = (): Channel & { peer: Channel | null; closed: boolean } => ({
    peer: null,
    closed: false,
    onReliable: null,
    onFast: null,
    onClose: null,
    sendReliable(message) {
      const peer = this.peer;
      const copy = structuredClone(message);
      deliver(() => peer?.onReliable?.(copy), false);
    },
    sendFast(data) {
      const peer = this.peer;
      deliver(() => peer?.onFast?.(data), true);
    },
    close() {
      if (this.closed) return;
      this.closed = true;
      const peer = this.peer as (Channel & { closed: boolean }) | null;
      if (peer && !peer.closed) {
        peer.closed = true;
        peer.onClose?.();
      }
    }
  });
  const a = make();
  const b = make();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

let reliableClock = 0;

function deliver(fn: () => void, lossy: boolean) {
  const { latency, jitter, loss } = netConditions;
  if (latency === 0 && jitter === 0 && loss === 0) {
    queueMicrotask(fn);
    return;
  }
  if (lossy && Math.random() < loss) return;
  const delay = latency / 2 + Math.random() * jitter;
  if (!lossy) {
    // Reliable messages stay in order even with jitter.
    reliableClock = Math.max(reliableClock, performance.now() + delay);
    setTimeout(fn, reliableClock - performance.now());
    return;
  }
  setTimeout(fn, delay);
}
