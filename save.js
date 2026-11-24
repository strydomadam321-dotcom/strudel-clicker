export const KEY = "strudel-clicker-save-v1";
export function initial() {
  return {
    version: 1,
    balance: 0,
    fraction: 0,
    total: 0,
    runTotal: 0,
    clicks: 0,
    owned: Array(13).fill(0),
    upgrades: [],
    achievements: [],
    goldenClicks: 0,
    points: 0,
    earnedPoints: 0,
    legacy: [],
    ascensions: 0,
    played: 0,
    started: Date.now(),
    savedAt: Date.now(),
    bakery: "Grandma’s little bakery",
    playerName: "",
    onboarded: false,
    settings: {
      volume: 0.25,
      particles: true,
      format: "short",
      language: "en",
    },
    buffs: [],
  };
}
export function validate(raw) {
  const d = initial();
  if (!raw || raw.version !== 1)
    throw Error("This is not a Strudel Clicker save.");
  for (const k of [
    "balance",
    "total",
    "runTotal",
    "clicks",
    "goldenClicks",
    "points",
    "earnedPoints",
    "ascensions",
    "played",
  ])
    if (!Number.isFinite(raw[k]) || raw[k] < 0)
      throw Error("Invalid save: " + k);
  if (
    !Array.isArray(raw.owned) ||
    raw.owned.length !== 13 ||
    raw.owned.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 100000)
  )
    throw Error("Invalid building counts.");
  for (const k of ["upgrades", "achievements", "legacy"])
    if (!Array.isArray(raw[k]) || raw[k].some((x) => typeof x !== "string"))
      throw Error("Invalid save collection.");
  return {
    ...d,
    ...raw,
    balance: Math.floor(raw.balance),
    total: Math.floor(raw.total),
    runTotal: Math.floor(raw.runTotal),
    fraction:
      Number.isFinite(raw.fraction) && raw.fraction >= 0 && raw.fraction < 1
        ? raw.fraction
        : raw.balance % 1,
    playerName:
      typeof raw.playerName === "string"
        ? raw.playerName.trim().slice(0, 40)
        : "",
    onboarded:
      raw.onboarded === true &&
      typeof raw.playerName === "string" &&
      raw.playerName.trim().length > 0,
    bakery: String(raw.bakery || d.bakery).slice(0, 60),
    settings: {
      volume: Math.min(1, Math.max(0, Number(raw.settings?.volume) || 0)),
      particles: raw.settings?.particles !== false,
      language: raw.settings?.language === "de" ? "de" : "en",
      format: raw.settings?.format === "scientific" ? "scientific" : "short",
    },
    buffs: Array.isArray(raw.buffs)
      ? raw.buffs.filter(
          (b) => ["frenzy", "click"].includes(b.type) && Number.isFinite(b.end),
        )
      : [],
    savedAt: Number.isFinite(raw.savedAt) ? raw.savedAt : Date.now(),
  };
}
export function save(s) {
  s.savedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(s));
}
export function load() {
  const raw = localStorage.getItem(KEY);
  return raw ? validate(JSON.parse(raw)) : initial();
}
export function encode(s) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}
export function decode(text) {
  return validate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))));
}
