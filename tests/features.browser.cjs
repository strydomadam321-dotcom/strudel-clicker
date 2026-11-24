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
  const page = await browser.newPage({
      viewport: { width: 1600, height: 950 },
    }),
    errors = [],
    failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await page.goto("http://127.0.0.1:3000");
  assert.ok(await page.locator("#setup-dialog").isVisible());
  await page.locator("#player-name").fill("Lena");
  await page.locator("#setup-language").selectOption("de");
  assert.equal(
    await page.locator("#setup-title").textContent(),
    "Willkommen in deiner Bäckerei",
  );
  await page.locator("#start-baking").click();
  assert.equal(await page.locator("html").getAttribute("lang"), "de");
  assert.equal(
    await page.locator("#bakery-name").textContent(),
    "Lenas Bäckerei",
  );
  assert.equal(await page.locator(".store>h1").textContent(), "Laden");
  await page.locator('[data-page="options"]').click();
  assert.equal(await page.locator("#save").textContent(), "Jetzt speichern");
  const code = await page.evaluate(async () => {
    const { initial, encode } = await import("/save.js");
    const s = initial();
    s.playerName = "Lena";
    s.onboarded = true;
    s.settings.language = "de";
    s.balance = 50000;
    s.total = 50000;
    s.runTotal = 50000;
    s.clicks = 100;
    s.owned = [6, 15, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    return encode(s);
  });
  await page.locator("#save-code").fill(code);
  await page.locator("#import").click();
  await page.locator("#close-page").click();
  assert.equal(
    await page.locator("#pin-orbit").getAttribute("data-owned"),
    "6",
  );
  assert.equal(await page.locator('[data-scene="0"]').count(), 0);
  assert.ok(
    await page.locator("#pin-orbit").evaluate((canvas) => {
      const c = canvas.getContext("2d");
      return c
        .getImageData(0, 0, 500, 500)
        .data.some((n, i) => i % 4 === 3 && n > 0);
    }),
  );
  assert.equal(await page.locator('[data-scene="1"] .scene-unit').count(), 15);
  const costs = await page
    .locator("[data-upgrade]")
    .evaluateAll(async (nodes) => {
      const { upgrades } = await import("/data/upgrades.js");
      return nodes.map(
        (n) => upgrades.find((u) => u.id === n.dataset.upgrade).cost,
      );
    });
  assert.ok(costs.length > 5);
  assert.deepEqual(
    costs,
    [...costs].sort((a, b) => a - b),
  );
  await page.locator('[data-scene="1"] [data-instance="1"]').hover();
  const grandma = await page.locator("#tooltip").textContent();
  const age = Number(grandma.match(/Alter: (\d+)/)?.[1]);
  assert.ok(age >= 81 && age <= 120);
  assert.ok(grandma.length > 15);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  const changes = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const results = [];
        let previous = Number(
            document.querySelector("#balance").textContent.replace(/\D/g, ""),
          ),
          last = performance.now(),
          start = last;
        function sample(now) {
          const n = Number(
            document.querySelector("#balance").textContent.replace(/\D/g, ""),
          );
          if (n !== previous) {
            results.push({ step: n - previous, ms: now - last });
            last = now;
            previous = n;
          }
          if (now - start < 1400) requestAnimationFrame(sample);
          else resolve(results);
        }
        requestAnimationFrame(sample);
      }),
  );
  assert.ok(changes.length >= 12, JSON.stringify(changes));
  assert.ok(
    changes.filter((c) => c.step === 1).length / changes.length >= 0.75,
    JSON.stringify(changes),
  );
  const intervals = changes.map((c) => c.ms).sort((a, b) => a - b);
  assert.ok(intervals[Math.floor(intervals.length / 2)] < 130);
  const resources = await page
    .locator("#balance,#production,.building .price,.scene-label")
    .allTextContents();
  assert.ok(
    resources.every((s) => !/\d[.,]\d{1,2}(?!\d)/.test(s)),
    JSON.stringify(resources),
  );
  await page.locator('[data-page="options"]').click();
  await page.locator("#save").click();
  await page.reload();
  assert.ok(!(await page.locator("#setup-dialog").isVisible()));
  assert.equal(
    await page.locator("#bakery-name").textContent(),
    "Lenas Bäckerei",
  );
  await page.locator('[data-scene="1"] [data-instance="1"]').hover();
  assert.equal(await page.locator("#tooltip").textContent(), grandma);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(5500);
  await page.screenshot({
    path: "test-results/strudel-german.png",
    fullPage: true,
  });
  await page.locator('[data-page="stats"]').click();
  assert.equal(
    await page.locator("#page-content h2").textContent(),
    "Statistik",
  );
  assert.match(
    await page.locator("#stats-data").textContent(),
    /Strudel auf Vorrat/,
  );
  await page.locator('[data-page="info"]').click();
  assert.match(
    await page.locator("#page-content").textContent(),
    /Beginne mit einem Apfelstrudel/,
  );
  await page.locator('[data-page="legacy"]').click();
  assert.match(
    await page.locator("#page-content").textContent(),
    /Verfügbare Wien-Punkte/,
  );
  await page.locator('[data-page="options"]').click();
  await page.locator("#language").selectOption("en");
  assert.equal(await page.locator("#save").textContent(), "Save now");
  assert.equal(await page.locator(".store>h1").textContent(), "Store");
  assert.equal(
    await page.locator("#bakery-name").textContent(),
    "Lena’s bakery",
  );
  await page.locator("#close-page").click();
  await page.mouse.move(10, 10);
  await page.screenshot({
    path: "test-results/strudel-english.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    Math.random = () => 0.1;
  });
  await page.clock.install();
  await page.clock.fastForward(190000);
  await page.locator("#lucky").click({ force: true });
  assert.match(
    await page.locator("#buffs").textContent(),
    /Warm ovens ×7.*1[12]s/,
  );
  await page.clock.fastForward(13000);
  assert.equal(await page.locator("#buffs").textContent(), "");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
  );
  await page.screenshot({
    path: "test-results/strudel-orbit-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(
    JSON.stringify({
      result: "PASS",
      languages: ["en", "de"],
      grandma,
      upgradeCostsSorted: true,
      counterChanges: changes.length,
      oneDigitSteps: changes.filter((c) => c.step === 1).length,
      medianCounterIntervalMs: intervals[Math.floor(intervals.length / 2)],
      warmOvensExpires: true,
      errors,
      failed,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
