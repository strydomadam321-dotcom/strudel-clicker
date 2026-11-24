import test from "node:test";
import assert from "node:assert/strict";
import { formatNumber } from "../numbers.js";
import { grandmaProfile } from "../grandmas.js";
import { upgrades } from "../data/upgrades.js";
import { t, setLanguage, bakeryName } from "../i18n.js";
test("all displays floor whole and abbreviated numbers, in both languages", () => {
  assert.equal(formatNumber(1.99), "1");
  assert.equal(formatNumber(999.99), "999");
  assert.equal(formatNumber(0.99), "0");
  assert.equal(formatNumber(1_999_999), "1 million");
  assert.equal(formatNumber(1_999_999, { format: "full" }), "1,999,999");
  assert.equal(formatNumber(9_999_999, { format: "scientific" }), "9e6");
  assert.equal(formatNumber(12345.99, { language: "de" }), "12.345");
  assert.equal(formatNumber(1_999_999, { language: "de" }), "1 Million");
});
test("grandma ages are stable and cover the inclusive 81–120 range", () => {
  const ages = new Set();
  for (let i = 0; i < 1000; i++) {
    const p = grandmaProfile(i, 1700000000000);
    assert.ok(p.age >= 81 && p.age <= 120);
    assert.ok(p.name.length > 0);
    assert.deepEqual(p, grandmaProfile(i, 1700000000000));
    ages.add(p.age);
  }
  assert.equal(ages.size, 40);
});
test("expanded upgrades have unique IDs and keep existing milestone costs", () => {
  assert.equal(upgrades.length, 174);
  assert.equal(new Set(upgrades.map((u) => u.id)).size, 174);
  assert.equal(upgrades.find((u) => u.id === "b0-25").cost, 7500);
});
test("German UI text and bakery names translate; English switches back", () => {
  setLanguage("de");
  assert.equal(t("Grandma’s Hands"), "Omas Hände");
  assert.equal(t("per second: 12"), "pro Sekunde: 12");
  assert.equal(t("15 strudels"), "15 Strudel");
  assert.equal(bakeryName("Lena"), "Lenas Bäckerei");
  assert.equal(
    t("Warm ovens! Production ×7 for 12 seconds."),
    "Warme Öfen! Produktion ×7 für 12 Sekunden.",
  );
  setLanguage("en");
  assert.equal(t("Store"), "Store");
  assert.equal(bakeryName("Alex"), "Alex’s bakery");
});
