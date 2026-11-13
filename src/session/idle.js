export const IDLE_LIMIT_MS = 5 * 60 * 1000;

export function createIdleWatch({
  limitMs = IDLE_LIMIT_MS,
  onIdle,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let last = now();
  let timer = null;
  let stopped = true;

  function check() {
    if (stopped) return;
    if (now() - last >= limitMs) {
      stopped = true;
      timer = null;
      onIdle();
      return;
    }
    timer = setTimer(check, 1000);
  }

  return {
    poke() {
      last = now();
    },
    start() {
      stopped = false;
      last = now();
      if (timer) clearTimer(timer);
      check();
    },
    stop() {
      stopped = true;
      if (timer) clearTimer(timer);
      timer = null;
    },
    checkNow() {
      if (stopped) return;
      if (timer) clearTimer(timer);
      timer = null;
      check();
    },
  };
}
