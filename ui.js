import { Game } from "./game.js";
import { buildings } from "./data/buildings.js";
import { upgrades, legacyUpgrades } from "./data/upgrades.js";
import { achievements } from "./data/achievements.js";
import { load, save, encode, decode, KEY } from "./save.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let audio,
  mode = "buy",
  quantity = 1,
  page = "bakery",
  lastRender = 0,
  lastAutosave = Date.now(),
  lastTime = performance.now(),
  goldenUntil = 0,
  nextGolden = Date.now() + 60000 + Math.random() * 60000;
const tones = {
  click: [330, 0.025],
  purchase: [523, 0.1],
  achievement: [784, 0.2],
  golden: [1047, 0.25],
};
function sound(kind) {
  if (!game.s.settings.volume) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const [freq, length] = tones[kind] || tones.click;
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.55,
      audio.currentTime + length,
    );
    g.gain.setValueAtTime(game.s.settings.volume * 0.12, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + length);
  } catch {
    /* Audio is optional on browsers without Web Audio. */
  }
}
function notify(title, message, kind) {
  const el = document.createElement("div");
  el.className = "toast";
  if (kind === "achievement") {
    const img = document.createElement("img");
    img.src = "assets/medal.png";
    img.alt = "";
    el.append(img);
    sound("achievement");
  }
  const h = document.createElement("strong");
  h.textContent = title;
  const p = document.createElement("span");
  p.textContent = message;
  el.append(h, p);
  $("#toasts").append(el);
  while ($("#toasts").children.length > 4) $("#toasts").firstChild.remove();
  setTimeout(() => el.remove(), 5500);
}
let state;
try {
  state = load();
} catch {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) localStorage.setItem(KEY + "-recovery", raw);
  } catch {}
  notify(
    "Save could not be loaded",
    "A fresh bakery has opened. Import a valid backup in Options.",
  );
}
const game = new Game(state, notify);
const offline = game.offline();
if (offline.amount > 1 && offline.seconds > 60)
  setTimeout(
    () =>
      notify(
        "Welcome back",
        `Your ovens baked ${fmt(offline.amount)} strudels while you were away (up to 24 hours).`,
      ),
    500,
  );
export function fmt(n, precision = 1) {
  if (!Number.isFinite(n)) return "a rather large amount";
  if (game?.s.settings.format === "scientific" && n >= 1e6)
    return n.toExponential(2);
  const units = [
    "",
    "million",
    "billion",
    "trillion",
    "quadrillion",
    "quintillion",
    "sextillion",
    "septillion",
    "octillion",
    "nonillion",
    "decillion",
  ];
  if (n < 1e6)
    return n.toLocaleString("en-US", {
      maximumFractionDigits: n < 100 ? precision : 0,
    });
  const group = Math.floor(Math.log10(n) / 3);
  return group - 1 < units.length
    ? (n / 1000 ** group).toFixed(2) + " " + units[group - 1]
    : n.toExponential(2);
}
const duration = (s) =>
  s < 60
    ? `${Math.floor(s)} seconds`
    : s < 3600
      ? `${Math.floor(s / 60)} minutes`
      : `${Math.floor(s / 3600)} hours, ${Math.floor((s % 3600) / 60)} minutes`;
function persist(silent = false) {
  try {
    save(game.s);
    lastAutosave = Date.now();
    $("#save-status").textContent = "• saved";
    if (!silent)
      notify(
        "Freshly preserved",
        "Your bakery has been saved in this browser.",
      );
    return true;
  } catch {
    notify(
      "Could not save",
      "Browser storage is unavailable or full. Export a backup in Options.",
    );
    return false;
  }
}
function perform(ok) {
  if (ok) {
    sound("purchase");
    render(true);
  } else notify("Not enough dough", "Keep baking a little longer.");
}
const floatPool = Array.from({ length: 24 }, () => {
  const el = document.createElement("span");
  el.className = "float";
  el.hidden = true;
  $("#effects").append(el);
  return el;
});
let floatIndex = 0;
function effects(x, y, n) {
  const el = floatPool[floatIndex++ % floatPool.length];
  el.hidden = false;
  el.textContent = "+" + fmt(n);
  el.style.left = x - 15 + "px";
  el.style.top = y - 20 + "px";
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => (el.hidden = true), 1000);
  if (
    game.s.settings.particles &&
    $("#effects").querySelectorAll(".crumb").length < 30
  )
    for (let i = 0; i < 2; i++) {
      const c = document.createElement("span");
      c.className = "crumb";
      c.style.left = x + "px";
      c.style.top = y + "px";
      c.style.setProperty("--dx", Math.random() * 140 - 70 + "px");
      $("#effects").append(c);
      setTimeout(() => c.remove(), 1250);
    }
}
$("#big-strudel").addEventListener("click", (e) => {
  const n = game.click();
  sound("click");
  const r = e.currentTarget.getBoundingClientRect();
  effects(e.clientX || r.x + r.width / 2, e.clientY || r.y + r.height / 2, n);
  render();
});
$("#bakery-name").onclick = () => {
  const name = prompt("What shall we call your bakery?", game.s.bakery);
  if (name?.trim()) {
    game.s.bakery = name.trim().slice(0, 60);
    persist(true);
    render();
  }
};
$("#mute").onclick = () => {
  game.s.settings.volume = game.s.settings.volume ? 0 : 0.25;
  persist(true);
  render(true);
  if (page === "options") showPage("options");
};
$$("[data-page]").forEach(
  (b) =>
    (b.onclick = () =>
      showPage(page === b.dataset.page ? "bakery" : b.dataset.page)),
);
$$("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.mode;
      render(true);
    }),
);
$$("[data-quantity]").forEach(
  (b) =>
    (b.onclick = () => {
      quantity = Number(b.dataset.quantity);
      render(true);
    }),
);
$("#buildings").innerHTML = buildings
  .map(
    (b) =>
      `<button class="building locked" data-building="${b.id}" data-tip="building:${b.id}"><img src="assets/${b.art}.png" alt=""><span class="building-copy"><span class="building-name">???</span><span class="price"></span></span><span class="owned"></span></button>`,
  )
  .join("");
$$("[data-building]").forEach(
  (b) =>
    (b.onclick = () =>
      perform(
        mode === "buy"
          ? game.buy(Number(b.dataset.building), quantity)
          : game.sell(Number(b.dataset.building), quantity),
      )),
);
let lastUpgradeKey = "",
  lastSceneKey = "";
function render(force = false) {
  const s = game.s;
  $("#balance").textContent = fmt(s.balance) + " strudels";
  $("#production").textContent = "per second: " + fmt(game.cps());
  $("#bakery-name").textContent = s.bakery;
  document.title = fmt(s.balance) + " strudels - Strudel Clicker";
  $("#mute").textContent = "Sound: " + (s.settings.volume ? "on" : "off");
  $$("[data-mode]").forEach((b) =>
    b.classList.toggle("selected", b.dataset.mode === mode),
  );
  $$("[data-quantity]").forEach((b) =>
    b.classList.toggle("selected", Number(b.dataset.quantity) === quantity),
  );
  for (const b of buildings) {
    const el = $(`[data-building="${b.id}"]`),
      price =
        mode === "buy"
          ? game.cost(b.id, quantity)
          : game.refund(b.id, quantity),
      known = s.owned[b.id] > 0 || s.total >= b.cost;
    const image = el.querySelector("img"),
      src = `assets/${b.art}${known ? "" : "-silhouette"}.png`;
    if (image.getAttribute("src") !== src) image.src = src;
    el.classList.toggle("locked", !known);
    el.classList.toggle(
      "affordable",
      mode === "buy" ? s.balance >= price : s.owned[b.id] > 0,
    );
    el.querySelector(".building-name").textContent = known ? b.name : "???";
    el.querySelector(".price").textContent =
      (mode === "sell" ? "+" : "") + fmt(price);
    el.querySelector(".owned").textContent = s.owned[b.id] || "";
    el.setAttribute(
      "aria-label",
      `${mode} ${quantity} ${known ? b.name : "unknown building"} for ${fmt(price)} strudels`,
    );
  }
  const available = upgrades.filter((u) => game.available(u)),
    key = available.map((u) => u.id + ":" + (s.balance >= u.cost)).join(",");
  if (key !== lastUpgradeKey || force) {
    lastUpgradeKey = key;
    $("#upgrade-count").textContent = available.length + " available";
    $("#upgrades").innerHTML = available.length
      ? available
          .map(
            (u) =>
              `<button class="upgrade ${s.balance < u.cost ? "unaffordable" : ""}" data-upgrade="${u.id}" data-tip="upgrade:${u.id}" aria-label="Buy ${escape(u.name)} for ${fmt(u.cost)} strudels"><img src="assets/${u.art}.png" alt=""></button>`,
          )
          .join("")
      : '<span class="empty-upgrades">Good things take a little dough.</span>';
    $$("[data-upgrade]").forEach(
      (b) =>
        (b.onclick = () => {
          const u = upgrades.find((u) => u.id === b.dataset.upgrade);
          if (game.upgrade(u.id)) {
            sound("purchase");
            notify("Recipe improved", u.name);
            render(true);
          } else perform(false);
        }),
    );
  }
  $("#buffs").innerHTML = s.buffs
    .map(
      (b) =>
        `<div class="buff">${b.type === "frenzy" ? "Warm ovens ×7" : "Click frenzy ×77"} · ${Math.max(0, Math.ceil((b.end - Date.now()) / 1000))}s</div>`,
    )
    .join("");
  if (page === "bakery") {
    const sceneKey = s.owned.join(",");
    if (sceneKey !== lastSceneKey || force) {
      lastSceneKey = sceneKey;
      $("#welcome").hidden = s.owned.some((n) => n > 0);
      $("#scenes").innerHTML = buildings
        .filter((b) => s.owned[b.id] > 0)
        .map(
          (b) =>
            `<div class="scene" style="background-image:url('assets/scene-${b.art}.png')"><span class="scene-label">${escape(b.name)} · ${s.owned[b.id]} · ${fmt(game.buildingCps(b.id))}/s</span><div class="scene-objects">${Array.from({ length: Math.min(14, s.owned[b.id]) }, () => `<img src="assets/${b.art}.png" alt="">`).join("")}</div></div>`,
        )
        .join("");
    } else
      $$(".scene-label").forEach((el, i) => {
        const b = buildings.filter((b) => s.owned[b.id] > 0)[i];
        el.textContent = `${b.name} · ${s.owned[b.id]} · ${fmt(game.buildingCps(b.id))}/s`;
      });
  } else if (page === "stats" && Date.now() % 1000 < 300) renderStats();
}
const pageHeader = (title) =>
  `<button class="page-close" id="close-page">Back to bakery</button><h2>${title}</h2>`;
function showPage(name) {
  page = name;
  $("#tooltip").hidden = true;
  if (name === "bakery") {
    $("#main-panel").innerHTML =
      '<div id="welcome"><h1>The art of the fold.</h1><p>A rolling pin. A few apples.<br>A wildly unreasonable ambition.</p><span>Click the strudel to begin.</span><div class="flourish">❦</div></div><div id="scenes"></div>';
    render(true);
    return;
  }
  const el = $("#main-panel");
  el.innerHTML = '<div class="page" id="page-content"></div>';
  const p = $("#page-content");
  if (name === "options") {
    p.innerHTML =
      pageHeader("Options") +
      '<h3>A well-kept recipe</h3><p>Your bakery autosaves every 60 seconds. Saves stay in this browser. Export a backup before clearing browser data.</p><button class="wood-button" id="save">Save now</button><button class="wood-button" id="load">Load last save</button><button class="wood-button" id="export">Export save</button><button class="wood-button" id="import">Import save</button><textarea id="save-code" aria-label="Save code" placeholder="Export your bakery here, or paste a save to import."></textarea><label>Sound volume <input id="volume" type="range" min="0" max="1" step=".05" value="' +
      game.s.settings.volume +
      '"></label><label><input id="particles" type="checkbox" ' +
      (game.s.settings.particles ? "checked" : "") +
      '> Crumbs and particles</label><label>Number format <select id="number-format"><option value="short">Named (million, billion…)</option><option value="scientific">Scientific</option></select></label><p>Sound is synthesized locally. No ads, tracking, or cloud accounts. Offline production is capped at 24 hours.</p>';
    $("#save").onclick = () => persist();
    $("#load").onclick = () => {
      try {
        const fresh = load();
        game.s = fresh;
        game.offline();
        notify("Recipe restored", "Loaded your last browser save.");
        render(true);
        showPage("options");
      } catch (e) {
        notify("Load failed", e.message);
      }
    };
    $("#export").onclick = () => {
      $("#save-code").value = encode(game.s);
      $("#save-code").select();
      notify("Backup ready", "Copy the selected save code somewhere safe.");
    };
    $("#import").onclick = () => {
      try {
        const candidate = decode($("#save-code").value);
        game.s = candidate;
        game.offline();
        persist(true);
        render(true);
        showPage("options");
        notify("Welcome home", "Your bakery was imported.");
      } catch (e) {
        notify("Import failed", e.message);
      }
    };
    $("#volume").oninput = (e) => {
      game.s.settings.volume = Number(e.target.value);
      sound("click");
    };
    $("#volume").onchange = () => persist(true);
    $("#particles").onchange = (e) => {
      game.s.settings.particles = e.target.checked;
      persist(true);
    };
    $("#number-format").value = game.s.settings.format;
    $("#number-format").onchange = (e) => {
      game.s.settings.format = e.target.value;
      persist(true);
      render(true);
    };
  }
  if (name === "stats") {
    p.innerHTML =
      pageHeader("Statistics") +
      '<div id="stats-data"></div><h3>Achievements <span id="achievement-total"></span></h3><p>Each achievement adds 1% Butter to all production and clicks.</p><div class="achievement-grid">' +
      achievements
        .map(
          (a) =>
            `<div class="achievement ${game.s.achievements.includes(a.id) ? "" : "locked"}" data-tip="achievement:${a.id}" tabindex="0" aria-label="${escape(a.name)}: ${game.s.achievements.includes(a.id) ? "unlocked" : "locked"}"><img src="assets/medal.png" alt=""></div>`,
        )
        .join("") +
      "</div>";
    renderStats();
  }
  if (name === "info") {
    p.innerHTML =
      pageHeader("A note from the kitchen") +
      "<h3>Strudel Clicker</h3><p>Begin with a single apple strudel. Click to bake, buy helpful hands, and let your ovens do the work. The store reveals each building when you have baked enough to discover it.</p><p>Buy buildings in batches of 1, 10, or 100. Each costs 15% more than the last. Selling returns 25% of the current purchase value. Recipes appear as you reach building and clicking milestones.</p><p>Catch the winged golden strudel for a lucky delivery, 77 seconds of ×7 production, or 13 seconds of ×77 clicking. Your next lucky strudel arrives in roughly 1–3 minutes.</p><p>At one billion lifetime strudels, Legacy becomes available. Ascension trades your current bakery for Vienna Points and permanent recipes. You keep achievements, settings, and all-time statistics.</p><h3>A little dough goes a long way.</h3><p>An independent browser game inspired by the classic idle genre. Original generated game art. No affiliation with Cookie Clicker or its creators.</p><p>Version 1.0.0 · Made with apples, JavaScript, and unreasonable ambition.</p>";
  }
  if (name === "legacy") renderLegacy();
  $("#close-page").onclick = () => showPage("bakery");
}
function renderStats() {
  const s = game.s;
  if (!$("#stats-data")) return;
  const rows = [
    ["Strudels in the bank", fmt(s.balance)],
    ["Baked this ascension", fmt(s.runTotal)],
    ["Baked all time", fmt(s.total)],
    ["Production per second", fmt(game.cps())],
    ["Strudels per click", fmt(game.clickPower())],
    ["Handmade clicks", fmt(s.clicks, 0)],
    ["Buildings owned", s.owned.reduce((a, b) => a + b, 0)],
    ["Recipes purchased", s.upgrades.length + " / " + upgrades.length],
    [
      "Butter bonus",
      s.achievements.length * (s.legacy.includes("butter") ? 2 : 1) + "%",
    ],
    ["Time spent baking", duration(s.played)],
    ["Golden strudels caught", s.goldenClicks],
    ["Ascensions", s.ascensions],
    ["Vienna Points earned", s.earnedPoints],
  ];
  $("#stats-data").innerHTML = rows
    .map(([a, b]) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`)
    .join("");
  $$(".achievement[data-tip]").forEach((el) =>
    el.classList.toggle(
      "locked",
      !s.achievements.includes(el.dataset.tip.split(":")[1]),
    ),
  );
  $("#achievement-total").textContent =
    `${s.achievements.length} / ${achievements.length}`;
}
function renderLegacy() {
  const gain = game.prestigeGain();
  $("#page-content").innerHTML =
    pageHeader("Legacy") +
    `<p>Every great bakery begins again. Earn Vienna Points from your lifetime baking: ⌊√(total / 1 billion)⌋. Points already earned are deducted.</p><div class="stat-row"><span>Vienna Points available</span><b>${game.s.points}</b></div><div class="stat-row"><span>Points from ascending now</span><b>${gain}</b></div><button class="wood-button" id="ascend" ${gain < 1 ? "disabled" : ""}>Ascend for ${gain} Vienna Point${gain === 1 ? "" : "s"}</button><p>Your next point arrives at ${fmt((game.s.earnedPoints + gain + 1) ** 2 * 1e9)} lifetime strudels.</p><h3>The family recipe book</h3>` +
    legacyUpgrades
      .map(
        (u) =>
          `<div class="legacy-card"><h3>${u.name}</h3><p>${u.description}</p><button class="wood-button" data-legacy="${u.id}" ${game.s.legacy.includes(u.id) ? "disabled" : ""}>${game.s.legacy.includes(u.id) ? "Permanently learned" : `${u.cost} Vienna Point${u.cost === 1 ? "" : "s"}`}</button></div>`,
      )
      .join("");
  $("#ascend").onclick = () => $("#confirm-dialog").showModal();
  $$("[data-legacy]").forEach(
    (b) =>
      (b.onclick = () => {
        perform(game.buyLegacy(b.dataset.legacy));
        persist(true);
        renderLegacy();
        $("#close-page").onclick = () => showPage("bakery");
      }),
  );
  $("#close-page").onclick = () => showPage("bakery");
}
$("#cancel-ascend").onclick = () => $("#confirm-dialog").close();
$("#confirm-ascend").onclick = () => {
  $("#confirm-dialog").close();
  if (game.ascend()) {
    persist(true);
    sound("golden");
    notify("A new chapter", "Your Vienna Points are ready in Legacy.");
    showPage("legacy");
    render(true);
  } else
    notify(
      "Not quite ready",
      "Bake one billion lifetime strudels to begin your legacy.",
    );
};
function tipText(key) {
  const [type, id] = key.split(":");
  if (type === "building") {
    const b = buildings[Number(id)];
    return `<strong>${escape(b.name)}</strong><b>${mode === "sell" ? "Sell value" : "Cost"}: ${fmt(mode === "sell" ? game.refund(b.id, quantity) : game.cost(b.id, quantity))} strudels</b><br>Each makes ${fmt(b.cps * upgrades.filter((u) => u.building === b.id && game.s.upgrades.includes(u.id)).reduce((a, u) => a * u.multiplier, 1) * game.multiplier())} / second<br>Owned: ${game.s.owned[b.id]}<br>Total contribution: ${fmt(game.buildingCps(b.id))} / second<em>“${b.description}”</em>`;
  }
  if (type === "upgrade") {
    const u = upgrades.find((u) => u.id === id);
    return `<strong>${escape(u.name)}</strong><b>${fmt(u.cost)} strudels</b><p>${u.description}</p>`;
  }
  const a = achievements.find((a) => a.id === id);
  return `<strong>${escape(a.name)}</strong>${a.description}<em>${game.s.achievements.includes(id) ? "Unlocked · +1% Butter" : "Still in the oven"}</em>`;
}
function showTip(e) {
  const target = e.target.closest("[data-tip]");
  if (!target) return;
  const t = $("#tooltip");
  t.innerHTML = tipText(target.dataset.tip);
  t.hidden = false;
  const r = target.getBoundingClientRect(),
    w = t.offsetWidth,
    h = t.offsetHeight;
  const x = e.clientX || r.left,
    y = e.clientY || r.top;
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w - 15)) + "px";
  t.style.top = Math.max(8, Math.min(innerHeight - h - 8, y + 15)) + "px";
}
document.addEventListener("pointerover", showTip);
document.addEventListener("focusin", showTip);
document.addEventListener("pointerout", (e) => {
  if (e.target.closest("[data-tip]")) $("#tooltip").hidden = true;
});
document.addEventListener("focusout", () => ($("#tooltip").hidden = true));
document.addEventListener("click", () => ($("#tooltip").hidden = true));
$("#lucky").onclick = () => {
  if (!goldenUntil) return;
  goldenUntil = 0;
  $("#lucky").hidden = true;
  notify("A golden opportunity", game.golden());
  sound("golden");
  render(true);
};
function scheduleGolden(now) {
  nextGolden =
    now +
    (60000 + Math.random() * 120000) / (game.s.legacy.includes("luck") ? 2 : 1);
}
function frame(now) {
  const seconds = Math.max(0, (now - lastTime) / 1000);
  lastTime = now;
  if (seconds > 10) {
    game.s.buffs = [];
    game.earn(game.cps(Date.now(), false) * Math.min(seconds, 86400));
    game.s.played += Math.min(seconds, 86400);
    game.check();
  } else game.tick(seconds);
  const wall = Date.now();
  if (wall >= nextGolden && !goldenUntil) {
    goldenUntil = wall + 15000;
    const el = $("#lucky");
    el.style.left = Math.max(5, Math.random() * (innerWidth - 110)) + "px";
    el.style.top = Math.max(40, Math.random() * (innerHeight - 160)) + "px";
    el.hidden = false;
    scheduleGolden(wall);
  }
  if (goldenUntil && wall > goldenUntil) {
    goldenUntil = 0;
    $("#lucky").hidden = true;
  }
  if (now - lastRender > 150) {
    render();
    lastRender = now;
  }
  if (wall - lastAutosave >= 60000) persist(true);
  requestAnimationFrame(frame);
}
const news = [
  "You feel like making strudels. But nobody wants to eat your strudels.",
  "Local baker insists “just one more fold” is a business strategy.",
  "Grandma denies using magic. Refuses to explain the seventh elbow.",
  "Scientists discover apples are just strudels with extra steps.",
  "Vienna calls. It would like its pastry back.",
  "Butter prices rise. Baker considers investing in cows.",
  "Entire town smells suspiciously of cinnamon. Nobody complains.",
  "Bank approves loan after tasting collateral.",
  "Experts recommend a balanced diet: one strudel in each hand.",
];
let newsIndex = 0;
setInterval(() => {
  $("#news").style.opacity = 0;
  setTimeout(() => {
    newsIndex = (newsIndex + 1) % news.length;
    $("#news").textContent = news[newsIndex];
    $("#news").style.opacity = 1;
  }, 400);
}, 18000);
window.addEventListener("pagehide", () => persist(true));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) persist(true);
});
render(true);
requestAnimationFrame(frame);
