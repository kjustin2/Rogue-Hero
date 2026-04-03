export class RoomManager {
  constructor(canvasWidth, canvasHeight) {
    this.w = canvasWidth;
    this.h = canvasHeight;
    this.WALL = 64;
    this.FLOOR_X1 = this.WALL;
    this.FLOOR_Y1 = this.WALL;
    this.FLOOR_X2 = this.w - this.WALL;
    this.FLOOR_Y2 = this.h - this.WALL;
  }

  clamp(x, y, r) {
    let nx = Math.max(this.FLOOR_X1 + r, Math.min(this.FLOOR_X2 - r, x));
    let ny = Math.max(this.FLOOR_Y1 + r, Math.min(this.FLOOR_Y2 - r, y));
    return { x: nx, y: ny };
  }

  draw(ctx) {
    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(0, 0, this.w, this.h);

    const fw = this.FLOOR_X2 - this.FLOOR_X1;
    const fh = this.FLOOR_Y2 - this.FLOOR_Y1;
    const cx = this.FLOOR_X1 + fw / 2;
    const cy = this.FLOOR_Y1 + fh / 2;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(fw, fh) * 0.7);
    grad.addColorStop(0, '#1a1a24');
    grad.addColorStop(1, '#0e0e14');

    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 30;
    ctx.fillRect(this.FLOOR_X1, this.FLOOR_Y1, fw, fh);
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const CELL_SIZE = 64;
    for (let x = this.FLOOR_X1; x <= this.FLOOR_X2; x += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, this.FLOOR_Y1); ctx.lineTo(x, this.FLOOR_Y2); ctx.stroke();
    }
    for (let y = this.FLOOR_Y1; y <= this.FLOOR_Y2; y += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(this.FLOOR_X1, y); ctx.lineTo(this.FLOOR_X2, y); ctx.stroke();
    }
  }
}
