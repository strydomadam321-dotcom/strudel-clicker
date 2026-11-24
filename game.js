import { buildings } from "./data/buildings.js";
import { upgrades, legacyUpgrades } from "./data/upgrades.js";
import { achievements } from "./data/achievements.js";
import { initial } from "./save.js";
export class Game {
  constructor(state = initial(), notify = () => {}) {
    this.s = state;
    this.notify = notify;
  }
  multiplier(now = Date.now()) {
    return (
      (1 +
        this.s.achievements.length *
          0.01 *
          (this.s.legacy.includes("butter") ? 2 : 1)) *
      (this.s.legacy.includes("recipe") ? 1 + this.s.earnedPoints * 0.1 : 1) *
      upgrades
        .filter((u) => u.kind === "global" && this.s.upgrades.includes(u.id))
        .reduce((a, u) => a * u.multiplier, 1)
    );
  }
  buildingCps(id) {
    return (
      buildings[id].cps *
      this.s.owned[id] *
      upgrades
        .filter((u) => u.building === id && this.s.upgrades.includes(u.id))
        .reduce((a, u) => a * u.multiplier, 1) *
      this.multiplier()
    );
  }
  cps(now = Date.now(), buffs = true) {
    return (
      buildings.reduce((a, b) => a + this.buildingCps(b.id), 0) *
      (buffs && this.s.buffs.some((b) => b.type === "frenzy" && b.end > now)
        ? 7
        : 1)
    );
  }
  clickPower(now = Date.now()) {
    return (
      upgrades
        .filter((u) => u.kind === "click" && this.s.upgrades.includes(u.id))
        .reduce((a, u) => a * u.multiplier, 1) *
      (this.s.buffs.some((b) => b.type === "click" && b.end > now) ? 77 : 1)
    );
  }
  earn(n) {
    if (!Number.isFinite(n) || n < 0) return 0;
    const accumulated = n + (this.s.fraction || 0);
    const whole = Math.floor(
      accumulated + Number.EPSILON * Math.max(1, accumulated) * 4,
    );
    this.s.fraction = Math.max(0, accumulated - whole);
    this.s.balance += whole;
    this.s.total += whole;
    this.s.runTotal += whole;
    return whole;
  }
  click() {
    const n = this.clickPower();
    this.earn(n);
    this.s.clicks++;
    this.check();
    return n;
  }
  tick(seconds, now = Date.now()) {
    this.s.buffs = this.s.buffs.filter((b) => b.end > now);
    this.earn(this.cps(now) * seconds);
    this.s.played += seconds;
    this.check();
  }
  offline(now = Date.now()) {
    const seconds = Math.min(86400, Math.max(0, (now - this.s.savedAt) / 1000));
    this.s.buffs = [];
    const amount = this.cps(now, false) * seconds;
    const earned = this.earn(amount);
    this.s.savedAt = now;
    this.check();
    return { seconds, amount: earned };
  }
  cost(id, n = 1) {
    const b = buildings[id];
    return Math.ceil(
      (b.cost * 1.15 ** this.s.owned[id] * (1.15 ** n - 1)) / 0.15,
    );
  }
  refund(id, n = 1) {
    const count = Math.min(n, this.s.owned[id]);
    return count
      ? Math.floor(
          ((buildings[id].cost *
            1.15 ** (this.s.owned[id] - count) *
            (1.15 ** count - 1)) /
            0.15) *
            0.25,
        )
      : 0;
  }
  buy(id, n = 1) {
    const price = this.cost(id, n);
    if (this.s.owned[id] + n > 100000 || this.s.balance < price) return false;
    this.s.balance -= price;
    this.s.owned[id] += n;
    this.check();
    return true;
  }
  sell(id, n = 1) {
    const count = Math.min(n, this.s.owned[id]);
    if (!count) return false;
    this.s.balance += this.refund(id, count);
    this.s.owned[id] -= count;
    return true;
  }
  available(u) {
    return (
      !this.s.upgrades.includes(u.id) &&
      (u.kind === "building"
        ? this.s.owned[u.building] >= u.at
        : u.kind === "click"
          ? this.s.clicks >= u.at
          : this.s.runTotal >= u.at)
    );
  }
  upgrade(id) {
    const u = upgrades.find((u) => u.id === id);
    if (!u || !this.available(u) || this.s.balance < u.cost) return false;
    this.s.balance -= u.cost;
    this.s.upgrades.push(id);
    return true;
  }
  check() {
    for (const a of achievements)
      if (!this.s.achievements.includes(a.id) && a.test(this.s)) {
        this.s.achievements.push(a.id);
        this.notify("Achievement unlocked", a.name, "achievement");
      }
  }
  golden(random = Math.random()) {
    this.s.goldenClicks++;
    let result;
    if (random < 0.45) {
      this.s.buffs = this.s.buffs.filter((b) => b.type !== "frenzy");
      this.s.buffs.push({ type: "frenzy", end: Date.now() + 12000 });
      result = "Warm ovens! Production ×7 for 12 seconds.";
    } else if (random < 0.9) {
      const n = Math.max(
        13,
        Math.min(this.s.balance * 0.15 + 13, this.cps() * 900 + 13),
      );
      const earned = this.earn(n);
      result = `A lucky delivery: ${Math.floor(earned).toLocaleString(this.s.settings.language === "de" ? "de-DE" : "en-US")} strudels!`;
    } else {
      this.s.buffs.push({ type: "click", end: Date.now() + 13000 });
      result = "Floured frenzy! Click power ×77 for 13 seconds.";
    }
    this.check();
    return result;
  }
  prestigeGain() {
    return Math.max(
      0,
      Math.floor(Math.sqrt(this.s.total / 1e9)) - this.s.earnedPoints,
    );
  }
  ascend() {
    const gain = this.prestigeGain();
    if (gain < 1) return false;
    const old = this.s;
    this.s = {
      ...initial(),
      total: old.total,
      clicks: old.clicks,
      achievements: [...old.achievements],
      goldenClicks: old.goldenClicks,
      points: old.points + gain,
      earnedPoints: old.earnedPoints + gain,
      legacy: [...old.legacy],
      ascensions: old.ascensions + 1,
      played: old.played,
      started: old.started,
      settings: old.settings,
      bakery: old.bakery,
      playerName: old.playerName,
      onboarded: old.onboarded,
    };
    if (this.s.legacy.includes("starter")) {
      this.s.balance = 100;
      this.s.owned[0] = 1;
    }
    this.check();
    return true;
  }
  buyLegacy(id) {
    const u = legacyUpgrades.find((u) => u.id === id);
    if (!u || this.s.legacy.includes(id) || this.s.points < u.cost)
      return false;
    this.s.points -= u.cost;
    this.s.legacy.push(id);
    return true;
  }
}
