// Canvas Renderer — Handles all pixel art drawing to the main canvas

const CanvasRenderer = {
  ctx: null,
  scale: 4,  // upscale factor (32px → 128px)

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;  // CRITICAL: crisp pixels
  },

  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  },

  /**
   * Draw a sprite frame to the center of the canvas.
   * @param {HTMLCanvasElement} spriteFrame - 32x32 source sprite
   * @param {number} offsetX - pixel offset from center
   * @param {number} offsetY - pixel offset from center
   */
  drawSprite(spriteFrame, offsetX = 0, offsetY = 0) {
    if (!this.ctx || !spriteFrame) return;

    const srcW = spriteFrame.width;
    const srcH = spriteFrame.height;
    const destW = srcW * this.scale;
    const destH = srcH * this.scale;

    const cx = (this.canvas.width - destW) / 2;
    const cy = (this.canvas.height - destH) / 2;

    // Disable smoothing for crisp pixel art
    this.ctx.imageSmoothingEnabled = false;

    this.ctx.drawImage(
      spriteFrame,
      0, 0, srcW, srcH,                           // source rect
      cx + offsetX * this.scale,                   // dest x
      cy + offsetY * this.scale,                   // dest y
      destW, destH                                 // dest size
    );
  },

  /**
   * Draw a "glow" circle behind the pet (when interactive).
   */
  drawGlow(intensity = 0) {
    if (!this.ctx || intensity <= 0) return;

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const r = 50;

    const gradient = this.ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    gradient.addColorStop(0, `rgba(255, 200, 120, ${0.06 * intensity})`);
    gradient.addColorStop(0.4, `rgba(255, 180, 100, ${0.03 * intensity})`);
    gradient.addColorStop(1, 'rgba(255, 180, 100, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.fill();
  },

  /**
   * Fallback: simple orange cat face when sprite generation fails.
   */
  drawFallback() {
    if (!this.ctx) return;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    this.ctx.imageSmoothingEnabled = false;
    // 鱼烧风 fallback
    this.ctx.fillStyle = '#F0982A';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    this.ctx.fill();
    // 鱼烧半耷拉眼
    this.ctx.fillStyle = '#3A2010';
    this.ctx.fillRect(cx - 24, cy - 12, 14, 8);
    this.ctx.fillRect(cx + 10, cy - 12, 14, 8);
    // 上眼皮压低（鱼烧标志）
    this.ctx.fillStyle = '#C87020';
    this.ctx.fillRect(cx - 24, cy - 14, 14, 3);
    this.ctx.fillRect(cx + 10, cy - 14, 14, 3);
    // 高光
    this.ctx.fillStyle = '#FFF';
    this.ctx.fillRect(cx - 16, cy - 10, 4, 3);
    this.ctx.fillRect(cx + 16, cy - 10, 4, 3);
    // 嫌弃嘴
    this.ctx.fillStyle = '#5A3020';
    this.ctx.fillRect(cx - 4, cy + 16, 2, 2);
    this.ctx.fillRect(cx + 2, cy + 16, 2, 2);
    // 耳朵
    this.ctx.fillStyle = '#E08820';
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 40, cy - 20);
    this.ctx.lineTo(cx - 28, cy - 48);
    this.ctx.lineTo(cx - 12, cy - 22);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.moveTo(cx + 12, cy - 22);
    this.ctx.lineTo(cx + 28, cy - 48);
    this.ctx.lineTo(cx + 40, cy - 20);
    this.ctx.fill();
  },

  /**
   * Get the canvas center coordinates.
   */
  getCenter() {
    return {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasRenderer;
}
