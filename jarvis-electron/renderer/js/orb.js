/**
 * Orb — the entire visual interface for Jarvis.
 *
 * Layers (outside-in):
 *   1. Two overlapping wireframe membrane rings with organic wobble
 *   2. A fainter inner boundary ring
 *   3. A fibonacci-sphere core of glowing dots, rotating in 3D
 *   4. Ambient dust particles drifting between membrane and core
 *
 * States: idle, listening, processing, speaking — each visually distinct.
 */
class Orb {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'idle';
    this.time = 0;
    this.targetEnergy = 0;
    this.energy = 0;
    this.coreRotation = 0;
    this.corePoints = this._fibonacciSphere(120);
    this.dust = this._initDust(40);
    this.speakingAmplitude = 0;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._animate();
  }

  setState(state) {
    this.state = state;
  }

  setSpeakingAmplitude(amp) {
    this.speakingAmplitude = Math.min(1, Math.max(0, amp));
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.offsetWidth * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.w = this.canvas.offsetWidth;
    this.h = this.canvas.offsetHeight;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.baseRadius = Math.min(this.w, this.h) * 0.28;
  }

  // Generate evenly distributed points on a sphere using fibonacci spiral
  _fibonacciSphere(n) {
    const points = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      points.push({
        x: Math.cos(theta) * radiusAtY,
        y: y,
        z: Math.sin(theta) * radiusAtY
      });
    }
    return points;
  }

  _initDust(count) {
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 0.4 + Math.random() * 0.5,
        speed: 0.001 + Math.random() * 0.003,
        size: 0.5 + Math.random() * 1.5,
        opacity: 0.1 + Math.random() * 0.3,
        yOffset: (Math.random() - 0.5) * 0.6
      });
    }
    return particles;
  }

  _stateParams() {
    switch (this.state) {
      case 'listening':
        return {
          energy: 0.6,
          rotationSpeed: 0.015,
          membraneScale: 1.08,
          glowIntensity: 0.8,
          pulseSpeed: 0.04,
          color: [0, 230, 230]
        };
      case 'processing':
        return {
          energy: 0.8,
          rotationSpeed: 0.025,
          membraneScale: 1.04,
          glowIntensity: 0.9,
          pulseSpeed: 0.06,
          color: [0, 200, 255]
        };
      case 'speaking':
        return {
          energy: 1.0,
          rotationSpeed: 0.01,
          membraneScale: 1.0 + this.speakingAmplitude * 0.15,
          glowIntensity: 0.7 + this.speakingAmplitude * 0.3,
          pulseSpeed: 0.03,
          color: [0, 240, 220]
        };
      default: // idle
        return {
          energy: 0.2,
          rotationSpeed: 0.005,
          membraneScale: 1.0,
          glowIntensity: 0.4,
          pulseSpeed: 0.015,
          color: [0, 210, 210]
        };
    }
  }

  _timeOfDayColorShift(baseColor) {
    const hour = new Date().getHours();
    if (hour >= 21 || hour < 6) {
      // Night: cooler/bluer
      return [baseColor[0], baseColor[1] * 0.85, baseColor[2] * 1.1];
    } else if (hour >= 6 && hour < 10) {
      // Morning: slightly warmer
      return [baseColor[0] + 10, baseColor[1], baseColor[2] * 0.95];
    } else if (hour >= 16 && hour < 21) {
      // Evening: warm tint
      return [baseColor[0] + 15, baseColor[1] * 0.95, baseColor[2] * 0.9];
    }
    return baseColor;
  }

  _drawMembrane(radius, wobbleAmount, opacity, lineWidth) {
    const ctx = this.ctx;
    const segments = 100;

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // Organic wobble using multiple sine waves at different frequencies
      const wobble = 1
        + Math.sin(angle * 3 + this.time * 0.8) * wobbleAmount * 0.3
        + Math.sin(angle * 5 - this.time * 1.2) * wobbleAmount * 0.2
        + Math.sin(angle * 7 + this.time * 0.5) * wobbleAmount * 0.1;

      const r = radius * wobble;
      const x = this.cx + Math.cos(angle) * r;
      const y = this.cy + Math.sin(angle) * r;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${this._color[0]}, ${this._color[1]}, ${this._color[2]}, ${opacity})`;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  _drawCore(radius, intensity) {
    const ctx = this.ctx;
    const coreRadius = radius * 0.45;

    for (const pt of this.corePoints) {
      // Rotate around Y axis
      const cosR = Math.cos(this.coreRotation);
      const sinR = Math.sin(this.coreRotation);
      const rx = pt.x * cosR - pt.z * sinR;
      const rz = pt.x * sinR + pt.z * cosR;

      // Slight tilt rotation around X axis
      const tilt = 0.3;
      const cosT = Math.cos(tilt);
      const sinT = Math.sin(tilt);
      const ry = pt.y * cosT - rz * sinT;
      const rz2 = pt.y * sinT + rz * cosT;

      // Perspective projection
      const perspective = 1 / (1 - rz2 * 0.3);
      const sx = this.cx + rx * coreRadius * perspective;
      const sy = this.cy + ry * coreRadius * perspective;

      // Depth-based brightness: points closer to viewer are brighter
      const depthFactor = 0.3 + (rz2 + 1) * 0.35;
      const dotSize = (1 + rz2 * 0.5) * 2 * perspective;
      const alpha = depthFactor * intensity;

      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.5, dotSize), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this._color[0]}, ${this._color[1]}, ${this._color[2]}, ${alpha})`;
      ctx.fill();
    }
  }

  _drawDust(innerRadius, outerRadius, intensity) {
    const ctx = this.ctx;

    for (const p of this.dust) {
      p.angle += p.speed * (1 + this.energy);
      const r = innerRadius + p.radius * (outerRadius - innerRadius);
      const x = this.cx + Math.cos(p.angle) * r + Math.sin(this.time + p.angle) * 3;
      const y = this.cy + Math.sin(p.angle) * r + p.yOffset * outerRadius * 0.2;

      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this._color[0]}, ${this._color[1]}, ${this._color[2]}, ${p.opacity * intensity})`;
      ctx.fill();
    }
  }

  _drawGlow(radius, intensity) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(
      this.cx, this.cy, radius * 0.2,
      this.cx, this.cy, radius * 1.3
    );
    gradient.addColorStop(0, `rgba(${this._color[0]}, ${this._color[1]}, ${this._color[2]}, ${0.08 * intensity})`);
    gradient.addColorStop(0.5, `rgba(${this._color[0]}, ${this._color[1]}, ${this._color[2]}, ${0.03 * intensity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  _animate() {
    const params = this._stateParams();
    this.time += params.pulseSpeed;
    this.energy += (params.energy - this.energy) * 0.05;
    this.coreRotation += params.rotationSpeed;

    const baseColor = params.color;
    this._color = this._timeOfDayColorShift(baseColor);

    // Breathing pulse
    const pulse = 1 + Math.sin(this.time) * 0.03 * (1 + this.energy);
    const radius = this.baseRadius * params.membraneScale * pulse;

    // Clear
    this.ctx.clearRect(0, 0, this.w, this.h);

    // Background glow
    this._drawGlow(radius, params.glowIntensity);

    // Outer membrane ring 1
    this._drawMembrane(radius, 0.04 + this.energy * 0.03, 0.3 + this.energy * 0.3, 1.5);

    // Outer membrane ring 2 (slightly offset/rotated for overlap effect)
    this.ctx.save();
    this.ctx.translate(this.cx, this.cy);
    this.ctx.rotate(0.15);
    this.ctx.translate(-this.cx, -this.cy);
    this._drawMembrane(radius * 0.97, 0.035 + this.energy * 0.025, 0.2 + this.energy * 0.2, 1.2);
    this.ctx.restore();

    // Inner boundary ring
    this._drawMembrane(radius * 0.7, 0.02, 0.15 + this.energy * 0.1, 0.8);

    // Dust particles
    this._drawDust(radius * 0.5, radius * 0.95, params.glowIntensity);

    // Core
    this._drawCore(radius, params.glowIntensity);

    requestAnimationFrame(() => this._animate());
  }
}
