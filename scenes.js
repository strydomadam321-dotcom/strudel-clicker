import { grandmaProfile } from "./grandmas.js";
import { buildings } from "./data/buildings.js";

// Decode before the first purchase so scenery and sprites arrive together.
const artwork = new Map();
function preload(src) {
  const image = new Image();
  image.src = src;
  const ready = image.decode().then(
    () => true,
    () => false,
  );
  return { image, ready };
}
for (const b of buildings) {
  const background = preload(`assets/scene-${b.art}.png`);
  const sprite = preload(`assets/${b.art}.png`);
  const entry = { loaded: false, ready: null };
  entry.ready = Promise.all([background.ready, sprite.ready]).then(
    (results) => {
      entry.loaded = results.every(Boolean);
      return entry.loaded;
    },
  );
  artwork.set(b.id, entry);
}

export class SceneRenderer {
  constructor(format) {
    this.format = format;
    this.rows = new Map();
    this.observer = new ResizeObserver(() => {
      for (const row of this.rows.values()) this.drawUnits(row);
    });
  }
  drawUnits(row) {
    const { body, track, building: b, count } = row;
    const step = 42,
      spriteWidth = 54,
      spriteHeight = 68,
      rowStep = 54;
    const columns = Math.max(
      1,
      Math.floor((body.clientWidth - 24 - spriteWidth) / step) + 1,
    );
    const rows = Math.ceil(count / columns);
    const baseY =
      rows === 1 ? Math.max(28, body.clientHeight - spriteHeight - 8) : 28;
    const height = Math.max(
      body.clientHeight,
      baseY + (rows - 1) * rowStep + spriteHeight + 8,
    );
    track.style.width = "100%";
    track.style.height = height + "px";
    // Wrap within the panel and virtualize only vertically offscreen rows.
    const firstRow = Math.max(
      0,
      Math.floor((body.scrollTop - baseY - spriteHeight) / rowStep),
    );
    const lastRow = Math.min(
      rows,
      Math.ceil((body.scrollTop + body.clientHeight - baseY) / rowStep) + 1,
    );
    const first = firstRow * columns,
      last = Math.min(count, lastRow * columns);
    const signature = `${first}:${last}:${columns}:${baseY}:${this.seed}`;
    if (row.signature === signature) return;
    row.signature = signature;
    track.replaceChildren();
    for (let i = first; i < last; i++) {
      const image = document.createElement("img");
      image.src = `assets/${b.art}.png`;
      image.alt = `${b.name} ${i + 1}`;
      image.className = "scene-unit";
      image.dataset.instance = i + 1;
      if (b.id === 1) {
        const profile = grandmaProfile(i, this.seed);
        image.dataset.tip = `grandma:${i + 1}`;
        image.tabIndex = 0;
        image.alt = `${profile.name}, ${profile.age}`;
      }
      image.draggable = false;
      image.style.left = `${12 + (i % columns) * step}px`;
      image.style.top = `${baseY + Math.floor(i / columns) * rowStep + (i % 3) * 2}px`;
      track.append(image);
    }
  }
  update(game) {
    this.seed = game.s.started + game.s.ascensions;
    const container = document.querySelector("#scenes");
    if (!container) return;
    for (const [id, row] of this.rows) {
      if (!row.el.isConnected || !game.s.owned[id]) {
        this.observer.unobserve(row.body);
        row.el.remove();
        this.rows.delete(id);
      }
    }
    for (const b of buildings) {
      const count = game.s.owned[b.id];
      if (!count) continue;
      let row = this.rows.get(b.id);
      if (!row) {
        const el = document.createElement("div");
        el.className = "scene";
        el.dataset.scene = b.id;
        el.style.backgroundImage = `url('assets/scene-${b.art}.png')`;
        const label = document.createElement("span");
        label.className = "scene-label";
        const body = document.createElement("div");
        body.className = "scene-objects";
        body.tabIndex = 0;
        body.setAttribute(
          "aria-label",
          `${b.name} collection; scroll to see more`,
        );
        const track = document.createElement("div");
        track.className = "scene-track";
        body.append(track);
        el.append(label, body);
        row = { el, label, body, track, building: b, count, signature: "" };
        this.rows.set(b.id, row);
        body.addEventListener("scroll", () => this.drawUnits(row), {
          passive: true,
        });
        const art = artwork.get(b.id);
        if (!art.loaded) {
          el.classList.add("scene-pending");
          art.ready.then(() => el.classList.remove("scene-pending"));
        }
        const next = [...container.children].find(
          (child) => Number(child.dataset.scene) > b.id,
        );
        container.insertBefore(el, next || null);
        this.observer.observe(body);
      }
      const purchased = count > row.count;
      row.count = count;
      row.el.dataset.owned = count;
      row.label.textContent = `${b.name} · ${count} · ${this.format(game.buildingCps(b.id))}/s`;
      this.drawUnits(row);
      if (purchased && row.body.scrollHeight > row.body.clientHeight) {
        row.body.scrollTop = row.body.scrollHeight;
        this.drawUnits(row);
      }
    }
  }
}
