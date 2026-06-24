// Aerodynamic force calculator using momentum exchange method
// Reads velocity field from GPU via readPixels and computes Cd, Cl

export class ForceCalculator {
  constructor(solver, gl) {
    this.solver = solver;
    this.gl = gl;
    this._buf = null;
    this._frame = 0;
    this._readInterval = 10; // only read every N frames (expensive)

    // Running averages
    this.Cd = 0;
    this.Cl = 0;
    this.Fdrag = 0;
    this.Flift = 0;
    this._alpha = 0.05; // EMA smoothing

    // Reference params
    this.refLength = 80; // cells (car height as reference)
  }

  update(frame) {
    if(frame % this._readInterval !== 0) return;
    this._frame = frame;

    const s = this.solver;
    const gl = this.gl;
    const W = s.W, H = s.H;

    // Read macroscopic field (rho, ux, uy) from texC
    if(!this._buf || this._buf.length !== W*H*4)
      this._buf = new Float32Array(W*H*4);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,s.texC[s.ping],0);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,this._buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.deleteFramebuffer(fbo);

    // Momentum exchange on obstacle boundary cells
    // For each solid cell, sum the momentum carried by distributions pointing inward
    let Fx=0, Fy=0;
    const ex=[0,1,0,-1,0,1,-1,-1,1];
    const ey=[0,0,1,0,-1,1,1,-1,-1];
    const W9=[4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36];

    // Approximate: sum pressure difference across obstacle boundary
    // Using surface integral of pressure * normal
    for(let y=1;y<H-1;y++){
      for(let x=1;x<W-1;x++){
        const isSolid = s.obsCPU[y*W+x]>0;
        if(!isSolid) continue;

        // Check each neighbor — if fluid, add force contribution
        for(let i=1;i<9;i++){
          const nx=x+ex[i], ny=y+ey[i];
          if(nx<0||nx>=W||ny<0||ny>=H) continue;
          const isFluidNeighbor = s.obsCPU[ny*W+nx]===0;
          if(!isFluidNeighbor) continue;

          const idx=(ny*W+nx)*4;
          const rho=this._buf[idx+1];
          const ux=this._buf[idx+2];
          const uy=this._buf[idx+3];

          // Pressure in LBM (isothermal): p = rho * cs^2 = rho/3
          const p = rho/3;

          // Normal points from fluid into solid = -E[i] direction
          Fx += p * (-ex[i]);
          Fy += p * (-ey[i]);
        }
      }
    }

    // Normalize by dynamic pressure and reference area
    const rho0 = 1.0;
    const u0 = s.u0;
    const A = this.refLength; // 2D: reference length in cells
    const q = 0.5 * rho0 * u0 * u0 * A; // dynamic pressure * area

    if(q > 0) {
      const Cd_new = Fx / q;
      const Cl_new = Fy / q;
      // EMA smoothing
      this.Cd = this.Cd * (1-this._alpha) + Cd_new * this._alpha;
      this.Cl = this.Cl * (1-this._alpha) + Cl_new * this._alpha;
      this.Fdrag = Fx;
      this.Flift = Fy;
    }
  }

  reset() {
    this.Cd = 0; this.Cl = 0;
    this.Fdrag = 0; this.Flift = 0;
  }
}
