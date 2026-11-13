import assert from "node:assert/strict";
import test from "node:test";
import { IDLE_LIMIT_MS, createIdleWatch } from "../src/session/idle.js";

test("had masa kunci ialah lima minit", () => {
  assert.equal(IDLE_LIMIT_MS, 5 * 60 * 1000);
});

function fakeWatch(onIdle) {
  let now = 0;
  let queued = null;
  const watch = createIdleWatch({
    limitMs: IDLE_LIMIT_MS,
    now: () => now,
    onIdle,
    setTimer: (fn) => {
      queued = fn;
      return 1;
    },
    clearTimer: () => {
      queued = null;
    },
  });
  return {
    watch,
    run() {
      const fn = queued;
      queued = null;
      if (!fn) throw new Error("tiada pemasa");
      fn();
    },
    advance(ms) {
      now += ms;
    },
  };
}

test("tidak kunci sebelum lima minit, kunci selepasnya", () => {
  let fired = 0;
  const env = fakeWatch(() => {
    fired += 1;
  });
  env.watch.start();
  env.advance(IDLE_LIMIT_MS - 1);
  env.run();
  assert.equal(fired, 0);
  env.advance(1);
  env.run();
  assert.equal(fired, 1);
});

test("aktiviti menetapkan semula tetingkap lima minit", () => {
  let fired = 0;
  const env = fakeWatch(() => {
    fired += 1;
  });
  env.watch.start();
  env.advance(IDLE_LIMIT_MS - 1);
  env.watch.poke();
  env.run();
  assert.equal(fired, 0);
  env.advance(IDLE_LIMIT_MS - 1);
  env.run();
  assert.equal(fired, 0);
  env.advance(1);
  env.run();
  assert.equal(fired, 1);
});

test("checkNow kunci apabila tempoh sudah cukup", () => {
  let fired = 0;
  const env = fakeWatch(() => {
    fired += 1;
  });
  env.watch.start();
  env.advance(IDLE_LIMIT_MS);
  env.watch.checkNow();
  assert.equal(fired, 1);
});
