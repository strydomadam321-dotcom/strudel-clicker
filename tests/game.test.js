import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../game.js";
import { initial, validate, encode, decode } from "../save.js";
import { buildings } from "../data/buildings.js";
import { upgrades } from "../data/upgrades.js";
test("clicking bakes and awards achievements once", () => {
  const messages = [];
  const g = new Game(initial(), (...m) => messages.push(m));
  assert.equal(g.click(), 1);
  assert.equal(g.s.balance, 1);
  assert.equal(g.s.clicks, 1);
  g.check();
  assert.equal(messages.length, 1);
  assert.equal(g.clickPower(), 1);
});
test("bulk purchases equal sequential geometric costs within rounding", () => {
  const g = new Game();
  g.s.balance = 1e8;
  const bulk = g.cost(0, 10);
  let sequential = 0;
  for (let i = 0; i < 10; i++) {
    sequential += g.cost(0);
    g.s.owned[0]++;
  }
  assert.ok(Math.abs(bulk - sequential) <= 10);
  g.s.owned[0] = 0;
  assert.ok(g.buy(0, 10));
  assert.equal(g.s.owned[0], 10);
  const earned = g.s.total;
  const before = g.s.balance;
  const refund = g.refund(0, 100);
  assert.ok(g.sell(0, 100));
  assert.equal(g.s.owned[0], 0);
  assert.equal(g.s.balance, before + refund);
  assert.equal(g.s.total, earned);
  assert.equal(g.sell(0), false);
});
test("purchases and upgrade requirements cannot be bypassed", () => {
  const g = new Game();
  assert.equal(g.buy(0), false);
  g.s.balance = 1e8;
  assert.equal(g.upgrade("b0-1"), false);
  g.buy(0);
  const before = g.cps();
  assert.ok(g.upgrade("b0-1"));
  assert.equal(g.cps(), before * 2);
  assert.equal(g.upgrade("b0-1"), false);
});
test("offline production is capped and does not preserve frenzy", () => {
  const g = new Game();
  g.s.owned[0] = 10;
  g.s.buffs = [{ type: "frenzy", end: Date.now() + 1e9 }];
  g.s.savedAt = Date.now() - 172800000;
  const cps = g.cps(Date.now(), false);
  const result = g.offline();
  assert.equal(result.seconds, 86400);
  assert.equal(result.amount, cps * 86400);
  assert.deepEqual(g.s.buffs, []);
});
test("lucky rewards, production frenzy, click frenzy expire", () => {
  const g = new Game();
  g.s.owned[0] = 1;
  const base = g.cps();
  g.golden(0.1);
  assert.ok(g.cps() >= base * 7);
  g.s.buffs = [];
  const before = g.s.balance;
  g.golden(0.5);
  assert.ok(g.s.balance > before);
  g.s.buffs = [];
  const click = g.clickPower();
  g.golden(0.95);
  assert.equal(g.clickPower(), click * 77);
  g.tick(0, Date.now() + 14000);
  assert.equal(g.s.buffs.length, 0);
});
test("prestige preserves lifetime progress and permanent purchases", () => {
  const g = new Game();
  assert.equal(g.ascend(), false);
  g.earn(9e9);
  g.s.owned[0] = 10;
  g.check();
  const achieved = g.s.achievements.length;
  assert.equal(g.prestigeGain(), 3);
  assert.ok(g.ascend());
  assert.equal(g.s.points, 3);
  assert.equal(g.s.runTotal, 0);
  assert.equal(g.s.total, 9e9);
  assert.equal(g.s.owned[0], 0);
  assert.ok(g.s.achievements.length >= achieved);
  assert.ok(g.buyLegacy("recipe"));
  assert.ok(g.buyLegacy("starter"));
  assert.equal(g.s.points, 0);
  g.earn(7e9);
  assert.equal(g.prestigeGain(), 1);
  g.ascend();
  assert.equal(g.s.owned[0], 1);
  assert.equal(g.s.balance, 100);
  assert.ok(g.s.legacy.includes("recipe"));
});
test("save export round-trips Unicode and rejects corrupt data", () => {
  const s = initial();
  s.bakery = "Großmutter’s café";
  s.owned[3] = 5;
  assert.deepEqual(decode(encode(s)), s);
  assert.throws(() => validate({ ...s, balance: NaN }));
  assert.throws(() => validate({ ...s, owned: [1] }));
  assert.throws(() => decode("not a save"));
});
test("all buildings and milestone upgrades are usable", () => {
  const g = new Game();
  g.s.balance = 1e80;
  for (const b of buildings) {
    assert.ok(g.buy(b.id, 500));
    for (const u of upgrades.filter((u) => u.building === b.id))
      assert.ok(g.upgrade(u.id));
    assert.ok(g.buildingCps(b.id) > 0);
  }
  assert.equal(g.s.upgrades.length, 156);
  assert.ok(g.cps() > 1e12);
});

test("achievement Butter does not change base clicks; purchased click upgrades do", () => {
  const g = new Game();
  for (let i = 0; i < 100; i++) assert.equal(g.click(), 1);
  assert.equal(g.s.balance, 100);
  assert.ok(g.s.achievements.length > 1);
  g.s.owned[0] = 1;
  assert.ok(g.cps() > 0.1);
  assert.ok(g.upgrade("click0"));
  assert.equal(g.click(), 2);
  g.s.upgrades.push("global0");
  g.s.legacy.push("recipe");
  g.s.earnedPoints = 10;
  assert.equal(g.clickPower(), 2);
});

test("banked production stays whole without losing fractional batches", () => {
  const g = new Game();
  for (let i = 0; i < 9; i++) {
    g.earn(0.1);
    assert.equal(g.s.balance, 0);
  }
  g.earn(0.1);
  assert.equal(g.s.balance, 1);
  assert.equal(g.s.total, 1);
  g.earn(2.9);
  assert.equal(g.s.balance, 3);
  assert.ok(g.s.fraction > 0.89);
  g.earn(0.1);
  assert.equal(g.s.balance, 4);
  const migrated = validate({
    ...initial(),
    balance: 15.75,
    total: 22.75,
    runTotal: 22.75,
    fraction: undefined,
  });
  assert.equal(migrated.balance, 15);
  assert.equal(migrated.fraction, 0.75);
});
test("Warm Ovens lasts twelve seconds and repeated rewards never stack its duration", () => {
  const g = new Game();
  g.s.owned[0] = 10;
  let now = Date.now();
  g.golden(0.1);
  assert.ok(g.s.buffs[0].end - now >= 12000 && g.s.buffs[0].end - now < 12100);
  g.golden(0.1);
  assert.equal(g.s.buffs.filter((b) => b.type === "frenzy").length, 1);
  const end = g.s.buffs[0].end;
  assert.equal(g.cps(end), g.cps(end, false));
});
test("profile and language survive ascension and save migration", () => {
  const g = new Game();
  g.s.playerName = "Lena";
  g.s.onboarded = true;
  g.s.settings.language = "de";
  g.s.bakery = "Lenas Bäckerei";
  g.earn(1e9);
  g.ascend();
  const s = decode(encode(g.s));
  assert.equal(s.playerName, "Lena");
  assert.equal(s.settings.language, "de");
  assert.equal(s.onboarded, true);
  const old = { ...initial() };
  delete old.settings.language;
  delete old.onboarded;
  assert.equal(validate(old).settings.language, "en");
  assert.equal(validate(old).onboarded, false);
});
