// A hidden host must continue simulating even when requestAnimationFrame stops.
let timer: ReturnType<typeof setInterval> | undefined;
self.addEventListener("message", (event: MessageEvent<boolean>) => {
  if (timer) clearInterval(timer);
  timer = event.data
    ? setInterval(() => self.postMessage(0), 1000 / 60)
    : undefined;
});
