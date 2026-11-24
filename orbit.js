export class PinOrbit {
  constructor(canvas) {
    this.canvas = canvas;
    this.image = new Image();
    this.image.src = "assets/rolling-pin.png";
    this.count = 0;
    this.image.decode().then(
      () => this.draw(),
      () => {},
    );
  }
  update(count) {
    if (this.count === count) return;
    this.count = count;
    this.canvas.dataset.owned = count;
    this.canvas.hidden = count === 0;
    this.draw();
  }
  draw() {
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, 500, 500);
    if (!this.image.complete || !this.image.naturalWidth) return;
    ctx.imageSmoothingEnabled = false;
    // Paint once per purchase; CSS rotates the entire ring without frame-by-frame work.
    for (let i = 0; i < this.count; i++) {
      const ring = Math.floor(i / 45),
        angle = Math.PI / 2 + ((i % 45) * Math.PI * 2) / 45 + ring * 0.035;
      const radius = 190 + (ring % 4) * 11;
      ctx.save();
      ctx.translate(
        250 + Math.cos(angle) * radius,
        250 + Math.sin(angle) * radius,
      );
      ctx.rotate(angle - Math.PI / 4);
      ctx.drawImage(this.image, -17, -17, 34, 34);
      ctx.restore();
    }
  }
}
