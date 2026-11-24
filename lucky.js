// Drift gently until a nearby mouse sends the pastry flying in the other direction.
export function advanceLucky(state, bounds, pointer, seconds) {
  const dt = Math.min(0.05, Math.max(0, seconds));
  let { x, y, vx, vy } = state;
  if (pointer) {
    const dx = x + bounds.size / 2 - pointer.x,
      dy = y + bounds.size / 2 - pointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 155) {
      let ax = distance > 0.01 ? dx / distance : 1,
        ay = distance > 0.01 ? dy / distance : 0.5;
      // Turn along the edge instead of getting trapped against it.
      if (
        (x < bounds.left + 15 && ax < 0) ||
        (x > bounds.right - 15 && ax > 0)
      ) {
        ax = 0;
        ay = dy >= 0 ? 1 : -1;
      }
      if (
        (y < bounds.top + 15 && ay < 0) ||
        (y > bounds.bottom - 15 && ay > 0)
      ) {
        ay = 0;
        ax = dx >= 0 ? 1 : -1;
      }
      const speed = 100 + 120 * (1 - distance / 155),
        mix = Math.min(1, dt * 12);
      vx += (ax * speed - vx) * mix;
      vy += (ay * speed - vy) * mix;
    } else {
      const drag = Math.exp(-dt * 1.1);
      vx *= drag;
      vy *= drag;
    }
  }
  x += vx * dt;
  y += vy * dt;
  if (x < bounds.left) {
    x = bounds.left;
    vx = Math.abs(vx);
  }
  if (x > bounds.right) {
    x = bounds.right;
    vx = -Math.abs(vx);
  }
  if (y < bounds.top) {
    y = bounds.top;
    vy = Math.abs(vy);
  }
  if (y > bounds.bottom) {
    y = bounds.bottom;
    vy = -Math.abs(vy);
  }
  return { x, y, vx, vy };
}
export class LuckyStrudel {
  constructor(element) {
    this.el = element;
    this.pointer = null;
    this.state = null;
    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen")
          this.pointer = { x: event.clientX, y: event.clientY };
      },
      { passive: true },
    );
    document.documentElement.addEventListener(
      "pointerleave",
      () => (this.pointer = null),
    );
  }
  bounds() {
    const size = this.el.offsetWidth || 96;
    return {
      size,
      left: 8,
      top: 38,
      right: Math.max(8, innerWidth - size - 8),
      bottom: Math.max(38, innerHeight - size - 8),
    };
  }
  spawn() {
    this.el.hidden = false;
    const b = this.bounds();
    this.state = {
      x: b.left + Math.random() * (b.right - b.left),
      y: b.top + Math.random() * (b.bottom - b.top),
      vx: (Math.random() - 0.5) * 38,
      vy: (Math.random() - 0.5) * 20,
    };
    this.paint();
  }
  paint() {
    this.el.style.left = this.state.x + "px";
    this.el.style.top = this.state.y + "px";
  }
  update(seconds) {
    if (this.el.hidden || !this.state) return;
    // Keyboard users can focus and catch it; touch users can tap without mouse evasion.
    this.state = advanceLucky(
      this.state,
      this.bounds(),
      this.el.matches(":focus-visible") ? null : this.pointer,
      this.el.matches(":focus-visible") ? 0 : seconds,
    );
    this.paint();
  }
}
