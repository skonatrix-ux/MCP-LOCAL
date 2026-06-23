// Streamline particle system drawn on 2D overlay canvas
// Reads velocity from GPU via readPixels on a downsampled copy

export class Streamlines {
  constructor(solver, gl, overlayCanvas) {
    this.solver = solver;
    this.gl = gl;
    this.canvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext('2d');
    this.enabled = true;

    this.numParticles = 300;
    this.fadeAlpha = 0.03;
    this.particleSpeed = 1.2;

    this._particles = [];
    this._velCache = null;
    this._lastRead = 0;
    this._readInterval = 3; // read GPU every N frames

    this._readFBO = null;
    this._readTex = null;
    this._frame = 0;

    this._setupReadback();
    this._spawnAll();
  }

  _setupReadback() {
    // We'll readPixels directly from texC of the LBM solver via a small FBO
    // Use a downsampled buffer for speed
    this.readW = Math.floor(this.solver.W / 2);
    this.readH = Math.floor(this.solver.H / 2);
    this._velCache = new Float32Array(this.readW * this.readH * 4);
  }

  _spawnParticle() {
    const margin = 0.05;
    return {
      x: Math.random() * this.solver.W * (1-margin),
      y: (margin + Math.random()*(1-2*margin)) * this.solver.H,
      age: 0,
      maxAge: 60 + Math.random()*120
    };
  }

  _spawnAll() {
    this._particles = [];
    for(let i=0;i<this.numParticles;i++)
      this._particles.push(this._spawnParticle());
  }

  _readVelocities() {
    const gl = this.gl;
    const s = this.solver;
    // Read from the current texC ping
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,s.texC[s.ping],0);

    const buf = new Float32Array(s.W * s.H * 4);
    gl.readPixels(0,0,s.W,s.H,gl.RGBA,gl.FLOAT, buf);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);

    this._velFull = buf;
    this._velW = s.W;
    this._velH = s.H;
  }

  _sampleVel(gx, gy) {
    if(!this._velFull) return {vx:this.solver.u0, vy:0};
    const x = Math.floor(gx), y = Math.floor(gy);
    const W = this._velW, H = this._velH;
    if(x<0||x>=W||y<0||y>=H) return {vx:0,vy:0};
    const i = (y*W+x)*4;
    return { vx: this._velFull[i+2], vy: this._velFull[i+3] };
  }

  update(frame) {
    if(!this.enabled) return;
    this._frame = frame;

    // Read GPU every N frames
    if(frame % this._readInterval === 0) {
      try { this._readVelocities(); } catch(e) {}
    }

    const s = this.solver;
    for(let p of this._particles) {
      const v = this._sampleVel(p.x, p.y);
      // Check if solid
      const ix = Math.floor(p.x), iy = Math.floor(p.y);
      const isSolid = ix>=0&&ix<s.W&&iy>=0&&iy<s.H
                      && s.obsCPU[iy*s.W+ix]>0;

      p.x += v.vx * this.particleSpeed * s.W / 512;
      p.y += v.vy * this.particleSpeed * s.H / 256;
      p.age++;

      if(p.age > p.maxAge || p.x > s.W || p.x < 0
         || p.y < 0 || p.y > s.H || isSolid) {
        Object.assign(p, this._spawnParticle());
      }
    }
  }

  draw() {
    if(!this.enabled) return;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const s = this.solver;

    // Fade trails
    ctx.fillStyle = `rgba(13,13,20,${this.fadeAlpha})`;
    ctx.fillRect(0,0,W,H);

    // Draw particles as dots
    for(const p of this._particles) {
      const cx = (p.x / s.W) * W;
      const cy = (1 - p.y / s.H) * H;

      const v = this._sampleVel(p.x, p.y);
      const speed = Math.sqrt(v.vx*v.vx+v.vy*v.vy);
      const t = Math.min(speed / (s.u0 * 2), 1);

      // Color by speed (cyan → yellow)
      const r = Math.floor(t * 255);
      const g2 = Math.floor(180 + t*75);
      const b = Math.floor(255*(1-t));
      const alpha = 0.4 + 0.5*(p.age/p.maxAge > 0.8 ? 1-(p.age/p.maxAge-0.8)/0.2 : 1);

      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, 2*Math.PI);
      ctx.fillStyle = `rgba(${r},${g2},${b},${alpha})`;
      ctx.fill();
    }
  }

  clear() {
    const ctx = this.ctx;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  }

  resize(W, H) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.clear();
  }
}
