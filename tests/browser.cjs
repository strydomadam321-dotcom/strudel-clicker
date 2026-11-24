const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
fs.mkdirSync("test-results", { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 950 },
  });
  const errors = [],
    bad = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(r.status() + " " + r.url());
  });
  await page.goto("http://127.0.0.1:3000");
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "test-results/strudel-desktop.png",
    fullPage: true,
  });
  for (let i = 0; i < 20; i++) await page.locator("#big-strudel").click();
  if (
    (await page.locator(".float:not([hidden])").last().textContent()) !== "+1"
  )
    throw Error("Base clicks are not exactly +1");
  if (
    await page
      .locator(".sitebar")
      .textContent()
      .then((t) => t.includes("dough goes"))
  )
    throw Error("Old tagline remains");
  await page.locator('[data-building="0"]').click();
  await page.waitForFunction(() => {
    const row = document.querySelector('[data-scene="0"]');
    return (
      row &&
      !row.classList.contains("scene-pending") &&
      row.querySelector("img")?.complete
    );
  });
  if ((await page.locator('[data-scene="0"] .scene-unit').count()) !== 1)
    throw Error("First purchase must show exactly one object");
  if (!(await page.locator('[data-building="0"] .owned').textContent()))
    throw Error("Building purchase failed");
  await page.locator('[data-page="options"]').click();
  await page.locator("#save").click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("strudel-clicker-save-v1")),
  );
  if (saved.clicks !== 20 || saved.owned[0] !== 1)
    throw Error("Save incorrect");
  await page.reload();
  await page.waitForTimeout(500);
  if (!(await page.locator('[data-building="0"] .owned').textContent()))
    throw Error("Reload lost building");
  await page.locator('[data-page="options"]').click();
  await page.locator("#export").click();
  const code = await page.locator("#save-code").inputValue();
  await page.locator("#save-code").fill(code);
  await page.locator("#import").click();
  if (
    !(await page
      .locator("#toasts")
      .textContent()
      .then((t) => t.includes("imported")))
  )
    throw Error("Import failed");
  // Seed a valid late-game save to exercise UI paths that would otherwise take days.
  const richCode = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("strudel-clicker-save-v1"));
    s.balance = 1e16;
    s.total = 1e16;
    s.runTotal = 1e16;
    s.clicks = 1000;
    s.owned = Array(13).fill(5);
    s.savedAt = Date.now();
    return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  });
  await page.locator("#save-code").fill(richCode);
  await page.locator("#import").click();
  await page.locator("#close-page").click();
  await page.waitForTimeout(500);
  if ((await page.locator('[data-scene="1"] .scene-unit').count()) !== 5)
    throw Error("Five grandmas must show five sprites");
  await page.locator('[data-building="1"]').click();
  if ((await page.locator('[data-scene="1"] .scene-unit').count()) !== 6)
    throw Error("One purchase must add one grandma");
  const backgrounds = await page
    .locator(".scene")
    .evaluateAll((rows) =>
      rows.map((row) => getComputedStyle(row).backgroundImage),
    );
  if (new Set(backgrounds).size !== 13)
    throw Error("Building backgrounds must be distinct");
  await page.screenshot({
    path: "test-results/strudel-scenes.png",
    fullPage: true,
  });
  await page.locator('[data-quantity="10"]').click();
  await page.locator('[data-building="0"]').click();
  if (
    (await page.locator('[data-scene="0"]').getAttribute("data-owned")) !== "15"
  )
    throw Error("Bulk scene count incorrect");
  const collection = page.locator('[data-scene="0"] .scene-objects');
  await collection.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.waitForFunction(
    () => !!document.querySelector('[data-scene="0"] [data-instance="15"]'),
  );
  await page.locator('[data-mode="sell"]').click();
  await page.locator('[data-building="0"]').click();
  await page.locator('[data-mode="buy"]').click();
  await page.locator('[data-quantity="1"]').click();
  await page.locator("[data-upgrade]").first().click();
  await page.locator('[data-page="stats"]').click();
  await page.screenshot({
    path: "test-results/strudel-stats.png",
    fullPage: true,
  });
  await page.locator('[data-page="legacy"]').click();
  await page.locator("#ascend").click();
  await page.locator("#confirm-ascend").click();
  await page.locator('[data-legacy="recipe"]').click();
  await page.locator('[data-page="options"]').click();
  await page.locator("#save").click();
  const ascended = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("strudel-clicker-save-v1")),
  );
  if (
    ascended.ascensions !== 1 ||
    !ascended.legacy.includes("recipe") ||
    ascended.owned.some((x) => x)
  )
    throw Error("Ascension incorrect");
  await page.locator("#close-page").click();
  await page.screenshot({
    path: "test-results/strudel-ascended.png",
    fullPage: true,
  });
  const broken = await page
    .locator("img")
    .evaluateAll((imgs) =>
      imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src),
    );
  if (broken.length) throw Error("Broken images " + broken);
  await page.clock.install();
  await page.clock.fastForward(190000);
  await page.waitForTimeout(100);
  if (await page.locator("#lucky").isHidden())
    throw Error("Lucky strudel did not spawn");
  await page.locator("#lucky").click({ force: true });
  await page.clock.fastForward(61000);
  const goldenSave = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("strudel-clicker-save-v1")),
  );
  if (goldenSave.goldenClicks < 1)
    throw Error("Golden click was not autosaved");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/strudel-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw Error("Mobile horizontal overflow");
  if (errors.length || bad.length) throw Error(JSON.stringify({ errors, bad }));

  // Hold a cold background request: the trim must not precede the artwork.
  const cold = await browser.newPage();
  let releaseBackground;
  const heldBackground = new Promise((resolve) => {
    releaseBackground = resolve;
  });
  await cold.route("**/assets/scene-rolling-pin.png", async (route) => {
    await heldBackground;
    await route.continue();
  });
  await cold.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 15; i++) await cold.locator("#big-strudel").click();
  await cold.locator('[data-building="0"]').click();
  if (
    !(await cold
      .locator('[data-scene="0"]')
      .evaluate((el) => getComputedStyle(el).visibility === "hidden"))
  )
    throw Error("Scene trim appeared before its artwork");
  releaseBackground();
  await cold.waitForFunction(() => {
    const row = document.querySelector('[data-scene="0"]');
    return row && getComputedStyle(row).visibility === "visible";
  });
  if ((await cold.locator('[data-scene="0"] .scene-unit').count()) !== 1)
    throw Error("Cold-load scene has the wrong object count");
  await cold.close();
  console.log(
    JSON.stringify({
      result: "PASS",
      clicks: saved.clicks,
      buildings: saved.owned[0],
      ascensions: ascended.ascensions,
      legacy: ascended.legacy,
      consoleErrors: errors,
      failedRequests: bad,
      brokenImages: broken,
      mobileOverflow: overflow,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
