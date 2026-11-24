const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
fs.mkdirSync("test-results", { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 },
  });
  const page = await context.newPage(),
    errors = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await page.goto("http://127.0.0.1:3000");
  await page.locator("#player-name").fill("Baker");
  await page.locator("#start-baking").click();
  await page.locator('[data-page="options"]').click();
  const code = await page.evaluate(async () => {
    const { initial, encode } = await import("/save.js");
    const s = initial();
    s.playerName = "Baker";
    s.onboarded = true;
    s.settings.language = "de";
    s.balance = 1e24;
    s.total = 1e24;
    s.runTotal = 1e24;
    s.owned = [45, 25, 20, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    return encode(s);
  });
  await page.locator("#save-code").fill(code);
  await page.locator("#import").click();
  await page.locator("#close-page").click();
  assert.equal(await page.locator("#pin-orbit").count(), 0);
  assert.equal(
    await page.locator('[data-scene="0"]').getAttribute("data-owned"),
    "45",
  );
  for (const width of [1600, 1000, 800, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForTimeout(150);
    const layout = await page.locator(".building").evaluateAll((rows) =>
      rows.map((row) => {
        const r = row.getBoundingClientRect(),
          name = row.querySelector(".building-copy").getBoundingClientRect(),
          owned = row.querySelector(".owned").getBoundingClientRect();
        return {
          inside:
            name.left >= r.left &&
            owned.right <= r.right &&
            name.right <= owned.left + 1,
          width: r.width,
        };
      }),
    );
    assert.ok(
      layout.every((r) => r.inside),
      JSON.stringify({ width, layout }),
    );
    assert.ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
      `overflow at ${width}`,
    );
    const sprites = await page.locator(".scene-unit").evaluateAll((images) =>
      images.map((image) => {
        const r = image.getBoundingClientRect(),
          body = image.closest(".scene-objects"),
          b = body.getBoundingClientRect();
        return r.left >= b.left && r.right <= b.left + body.clientWidth + 1;
      }),
    );
    assert.ok(sprites.every(Boolean), `sprite outside panel at ${width}`);
    const strips = await page.locator(".scene-objects").evaluateAll((bodies) =>
      bodies.map((body) => {
        const images = [...body.querySelectorAll(".scene-unit")];
        const capacity = Math.max(
          0,
          Math.floor((body.clientWidth - 24 - 54) / 42) + 1,
        );
        const owned = Number(body.closest(".scene").dataset.owned);
        const positions = images.map((image) => image.offsetTop);
        return {
          noScroll:
            body.scrollHeight === body.clientHeight &&
            body.scrollWidth === body.clientWidth,
          hidden: getComputedStyle(body).overflow === "hidden",
          visible: images.length,
          expected: Math.min(owned, capacity),
          singleRow:
            positions.length < 2 ||
            Math.max(...positions) - Math.min(...positions) <= 4,
        };
      }),
    );
    assert.ok(
      strips.every(
        (row) =>
          row.noScroll &&
          row.hidden &&
          row.visible === row.expected &&
          row.singleRow,
      ),
      JSON.stringify({ width, strips }),
    );
    await page.locator('[data-building="9"]').hover();
    const tip = await page.locator("#tooltip").boundingBox();
    assert.ok(
      tip.x >= 0 &&
        tip.x + tip.width <= width + 1 &&
        tip.y >= 0 &&
        tip.y + tip.height <= 950 + 1,
    );
  }
  await page.setViewportSize({ width: 1600, height: 950 });
  // Buying after a strip is full changes ownership but does not add a second row.
  await page.waitForTimeout(100);
  const beforeCount = await page
    .locator('[data-scene="0"] .scene-unit')
    .count();
  await page.locator('[data-building="0"]').click();
  assert.equal(
    await page.locator('[data-scene="0"]').getAttribute("data-owned"),
    "46",
  );
  assert.equal(
    await page.locator('[data-scene="0"] .scene-unit').count(),
    beforeCount,
  );
  await page.locator('[data-scene="0"]').scrollIntoViewIfNeeded();
  const strip = await page.locator('[data-scene="0"]').boundingBox();
  await page.mouse.move(strip.x + strip.width / 2, strip.y + 70);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(150);
  assert.ok(
    await page.locator("#main-panel").evaluate((el) => el.scrollTop > 0),
  );
  assert.ok(
    await page
      .locator(".scene-objects")
      .evaluateAll((bodies) =>
        bodies.every((body) => body.scrollTop === 0 && body.scrollLeft === 0),
      ),
  );
  await page.locator("#main-panel").evaluate((el) => (el.scrollTop = 0));
  await page.mouse.move(5, 5);
  await page.waitForTimeout(5500);
  await page.screenshot({
    path: "test-results/strudel-contained-panels.png",
    fullPage: true,
  });
  // Spawn deterministically, then approach from one side and watch it flee.
  await page.evaluate(() => {
    Math.random = () => 0.5;
  });
  await page.clock.install();
  await page.clock.fastForward(190000);
  const before = await page.locator("#lucky").boundingBox();
  const pointer = {
    x: before.x + before.width / 2 - 100,
    y: before.y + before.height / 2,
  };
  await page.mouse.move(pointer.x, pointer.y);
  await page.waitForTimeout(450);
  const after = await page.locator("#lucky").boundingBox();
  const distance = (b) =>
    Math.hypot(b.x + b.width / 2 - pointer.x, b.y + b.height / 2 - pointer.y);
  assert.ok(
    distance(after) > distance(before) + 8,
    JSON.stringify({ before, after }),
  );
  assert.ok(
    after.x >= 8 &&
      after.x + after.width <= 1600 - 7 &&
      after.y >= 38 &&
      after.y + after.height <= 950 - 7,
  );
  await page.locator("#lucky").press("Enter");
  assert.ok(await page.locator("#lucky").isHidden());
  await page.locator('[data-page="options"]').click();
  await page.locator("#save").click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("strudel-clicker-save-v1"),
  );
  await page.locator("#delete-progress").click();
  assert.ok(await page.locator("#delete-dialog").isVisible());
  assert.match(await page.locator("#delete-title").textContent(), /löschen/);
  await page.locator("#cancel-delete").click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("strudel-clicker-save-v1")),
    saved,
  );
  await page.evaluate(async () => {
    localStorage.setItem("extra-site-preference", "yes");
    sessionStorage.setItem("temporary-data", "yes");
    document.cookie = "reset-test=yes; path=/";
    const cache = await caches.open("reset-test-cache");
    await cache.put("/reset-fixture", new Response("test"));
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("reset-test-database", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("items");
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  });
  const other = await page.context().newPage();
  await other.goto("http://127.0.0.1:3000");
  await other.evaluate(() => sessionStorage.setItem("second-tab", "yes"));
  await page.locator("#delete-progress").click();
  await page.locator("#confirm-delete").click();
  await page.locator("#setup-dialog").waitFor({ state: "visible" });
  await other.locator("#setup-dialog").waitFor({ state: "visible" });
  const cleared = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    cookies: document.cookie,
    caches: await caches.keys(),
    databases: await indexedDB.databases(),
  }));
  assert.equal(cleared.local, 0);
  assert.equal(cleared.session, 0);
  assert.equal(cleared.cookies, "");
  assert.deepEqual(cleared.caches, []);
  assert.deepEqual(cleared.databases, []);
  assert.equal(await other.evaluate(() => sessionStorage.length), 0);
  assert.equal(await page.locator("#player-name").inputValue(), "");
  assert.equal(await page.locator("[data-scene]").count(), 0);
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(await page.locator("#balance").textContent(), "0 strudels");
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(
    JSON.stringify({
      result: "PASS",
      rollingPinScene: true,
      viewports: [1600, 1000, 800, 390],
      mouseEvasion: true,
      keyboardCatch: true,
      resetCancellation: true,
      cleared,
      multiTabReset: true,
      errors,
      failed,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
