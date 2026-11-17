const WORKER = `let id = 0; onmessage = (e) => { clearInterval(id); if (e.data > 0) id = setInterval(() => postMessage(0), e.data); };`;

/**
 * Fixed-step clock for the host simulation. Timers in a worker keep running
 * when the host's tab is in the background, where page timers get throttled.
 */
export function startTicker(step: number, onStep: () => void): () => void {
  let last = performance.now();
  let acc = 0;
  const run = () => {
    const now = performance.now();
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    let n = 0;
    while (acc >= step && n < 15) {
      acc -= step;
      n++;
      onStep();
    }
  };
  let worker: Worker | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  try {
    const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = run;
    worker.postMessage(Math.floor(step * 1000 * 0.5));
  } catch {
    interval = setInterval(run, Math.floor(step * 1000 * 0.5));
  }
  return () => {
    worker?.terminate();
    if (interval) clearInterval(interval);
  };
}
