import test from "node:test";
import assert from "node:assert/strict";
import { advanceLucky } from "../lucky.js";
import { clearSiteData } from "../save.js";
const bounds = { left: 8, top: 38, right: 900, bottom: 600, size: 96 };
test("lucky strudels accelerate away from a nearby mouse", () => {
  let state = { x: 400, y: 300, vx: 0, vy: 0 };
  const pointer = { x: 360, y: 348 };
  const before = Math.hypot(state.x + 48 - pointer.x, state.y + 48 - pointer.y);
  for (let i = 0; i < 30; i++)
    state = advanceLucky(state, bounds, pointer, 1 / 60);
  assert.ok(
    Math.hypot(state.x + 48 - pointer.x, state.y + 48 - pointer.y) >
      before + 25,
  );
});
test("evasion and drift stay within each viewport edge", () => {
  for (const [x, y] of [
    [8, 38],
    [900, 38],
    [8, 600],
    [900, 600],
  ]) {
    let state = {
      x,
      y,
      vx: Math.sign(x - 400) * 500,
      vy: Math.sign(y - 300) * 500,
    };
    for (let i = 0; i < 100; i++) {
      state = advanceLucky(state, bounds, { x: x + 48, y: y + 48 }, 1 / 60);
      assert.ok(
        state.x >= 8 && state.x <= 900 && state.y >= 38 && state.y <= 600,
      );
    }
  }
});
test("site reset clears storage, caches, databases, workers and cookies", async () => {
  const calls = [];
  const scope = {
    localStorage: { clear: () => calls.push("local") },
    sessionStorage: { clear: () => calls.push("session") },
    caches: {
      keys: async () => ["cache-a"],
      delete: async (name) => calls.push(name),
    },
    indexedDB: {
      databases: async () => [{ name: "bakery" }],
      deleteDatabase: (name) => {
        calls.push(name);
        const request = {};
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    },
    navigator: {
      serviceWorker: {
        getRegistrations: async () => [
          { unregister: async () => calls.push("worker") },
        ],
      },
    },
    document: { cookie: "test=1" },
    location: { pathname: "/", hostname: "example.test" },
  };
  await clearSiteData(scope);
  assert.deepEqual(
    calls.sort(),
    ["bakery", "cache-a", "local", "session", "worker"].sort(),
  );
  assert.match(scope.document.cookie, /Max-Age=0/);
});
