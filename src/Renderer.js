export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Camera shake
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeElapsed = 0;
  }

  updateShake(dt) {
    if (this.shakeElapsed < this.shakeDuration) {
      this.shakeElapsed += dt;
      const decay = 1 - this.shakeElapsed / this.shakeDuration;
      this.shakeOffsetX = (Math.random() * 2 - 1) * this.shakeIntensity * decay * 14;
      this.shakeOffsetY = (Math.random() * 2 - 1) * this.shakeIntensity * decay * 14;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  beginShakeScope() {
    this.ctx.save();
    this.ctx.translate(this.shakeOffsetX, this.shakeOffsetY);
  }
  
  endShakeScope() {
    this.ctx.restore();
  }
}
