import { VS_QUAD, FS_LBM, FS_VIZ } from './shaders.js';

export class LBMSolver {
  constructor(gl, W, H) {
    this.gl = gl;
    this.W = W;
    this.H = H;
    this.omega = 1.7;   // relaxation (tau = 1/omega, nu = (1/omega - 0.5)/3)
    this.u0    = 0.08;  // inlet speed (lattice units)
    this.angle = 0.0;   // flow angle radians
    this.vizMode  = 0;
    this.vizScale = 0.15;
    this._init();
  }

  _compile(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if(!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS))
      throw new Error(this.gl.getShaderInfoLog(s));
    return s;
  }

  _prog(vs, fs) {
    const gl = this.gl;
    const p = gl.createProgram();
    gl.attachShader(p, this._compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this._compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  _makeTexFloat(w, h, data) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT, data||null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }

  _makeTexR8(w, h, data) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,w,h,0,gl.RED,gl.UNSIGNED_BYTE, data||null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }

  _makeFBO(texA, texB, texC) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texA,0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,texB,0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT2,gl.TEXTURE_2D,texC,0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(status !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error(`FBO incomplete: ${status}`);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fbo;
  }

  _initData() {
    // Equilibrium at rest, rho=1, u=(u0,0)
    const n = this.W * this.H;
    const A = new Float32Array(n * 4);
    const B = new Float32Array(n * 4);
    const C = new Float32Array(n * 4);
    const u0 = this.u0;
    const W = [4/9,1/9,1/9,1/9,1/9,1/36,1/36,1/36,1/36];
    const ex = [0,1,0,-1,0,1,-1,-1,1];
    const ey = [0,0,1,0,-1,1,1,-1,-1];

    for(let k=0;k<n;k++){
      const feqs = [];
      for(let i=0;i<9;i++){
        const eu = ex[i]*u0;
        const usq = u0*u0;
        feqs.push(W[i]*(1 + 3*eu + 4.5*eu*eu - 1.5*usq));
      }
      A[k*4+0]=feqs[0]; A[k*4+1]=feqs[1]; A[k*4+2]=feqs[2]; A[k*4+3]=feqs[3];
      B[k*4+0]=feqs[4]; B[k*4+1]=feqs[5]; B[k*4+2]=feqs[6]; B[k*4+3]=feqs[7];
      C[k*4+0]=feqs[8]; C[k*4+1]=1.0;     C[k*4+2]=u0;      C[k*4+3]=0.0;
    }
    return {A,B,C};
  }

  _init() {
    const gl = this.gl;

    // Check required extensions
    if(!gl.getExtension('EXT_color_buffer_float'))
      throw new Error('EXT_color_buffer_float not supported');

    // Programs
    this.progLBM = this._prog(VS_QUAD, FS_LBM);
    this.progViz = this._prog(VS_QUAD, FS_VIZ);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    this.quadBuf = buf;

    // Initial distributions
    const {A, B, C} = this._initData();

    // Ping-pong textures (current=0, next=1)
    this.texA = [this._makeTexFloat(this.W,this.H,A), this._makeTexFloat(this.W,this.H,A)];
    this.texB = [this._makeTexFloat(this.W,this.H,B), this._makeTexFloat(this.W,this.H,B)];
    this.texC = [this._makeTexFloat(this.W,this.H,C), this._makeTexFloat(this.W,this.H,C)];
    this.fbo  = [
      this._makeFBO(this.texA[0], this.texB[0], this.texC[0]),
      this._makeFBO(this.texA[1], this.texB[1], this.texC[1]),
    ];

    // Obstacle texture (CPU-updated)
    this.obsCPU = new Uint8Array(this.W * this.H);
    this.texObs = this._makeTexR8(this.W, this.H, this.obsCPU);

    this.ping = 0;
    this.step = 0;
  }

  // Paint a filled circle of solid cells into the obstacle map
  paintObstacle(cx, cy, radius, solid=true) {
    const r2 = radius*radius;
    const x0=Math.max(0,Math.floor(cx-radius));
    const x1=Math.min(this.W-1,Math.ceil(cx+radius));
    const y0=Math.max(0,Math.floor(cy-radius));
    const y1=Math.min(this.H-1,Math.ceil(cy+radius));
    for(let y=y0;y<=y1;y++){
      for(let x=x0;x<=x1;x++){
        if((x-cx)**2+(y-cy)**2 <= r2){
          this.obsCPU[y*this.W+x] = solid ? 255 : 0;
        }
      }
    }
    this._uploadObs();
  }

  // Paint a line segment of given half-thickness
  paintLine(x0,y0,x1,y1,radius,solid=true) {
    const dx=x1-x0, dy=y1-y0;
    const len=Math.sqrt(dx*dx+dy*dy);
    if(len<0.001){ this.paintObstacle(x0,y0,radius,solid); return; }
    const steps=Math.ceil(len*2);
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      this.paintObstacle(x0+dx*t, y0+dy*t, radius, solid);
    }
  }

  clearObstacles() {
    this.obsCPU.fill(0);
    this._uploadObs();
  }

  _uploadObs() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texObs);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,this.W,this.H,0,gl.RED,gl.UNSIGNED_BYTE,this.obsCPU);
  }

  reset() {
    const {A,B,C} = this._initData();
    const gl = this.gl;
    for(let i=0;i<2;i++){
      gl.bindTexture(gl.TEXTURE_2D, this.texA[i]); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,this.W,this.H,0,gl.RGBA,gl.FLOAT,A);
      gl.bindTexture(gl.TEXTURE_2D, this.texB[i]); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,this.W,this.H,0,gl.RGBA,gl.FLOAT,B);
      gl.bindTexture(gl.TEXTURE_2D, this.texC[i]); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,this.W,this.H,0,gl.RGBA,gl.FLOAT,C);
    }
    this.ping = 0;
    this.step = 0;
  }

  _bindQuad(prog) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  }

  simulate(stepsPerFrame=4) {
    const gl = this.gl;
    gl.useProgram(this.progLBM);
    this._bindQuad(this.progLBM);

    const p = this.progLBM;
    gl.uniform2f(gl.getUniformLocation(p,'u_grid'), this.W, this.H);
    gl.uniform1f(gl.getUniformLocation(p,'u_omega'), this.omega);
    gl.uniform1f(gl.getUniformLocation(p,'u_u0'), this.u0);
    gl.uniform1f(gl.getUniformLocation(p,'u_angle'), this.angle);

    for(let s=0;s<stepsPerFrame;s++){
      const src = this.ping;
      const dst = 1 - this.ping;

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[dst]);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
      gl.viewport(0,0,this.W,this.H);

      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texA[src]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texB[src]);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.texC[src]);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.texObs);
      gl.uniform1i(gl.getUniformLocation(p,'u_texA'),0);
      gl.uniform1i(gl.getUniformLocation(p,'u_texB'),1);
      gl.uniform1i(gl.getUniformLocation(p,'u_texC'),2);
      gl.uniform1i(gl.getUniformLocation(p,'u_obs'),3);

      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      this.ping = dst;
      this.step++;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }

  render(targetW, targetH) {
    const gl = this.gl;
    gl.useProgram(this.progViz);
    this._bindQuad(this.progViz);
    const p = this.progViz;

    gl.viewport(0,0,targetW,targetH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texC[this.ping]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texObs);
    gl.uniform1i(gl.getUniformLocation(p,'u_texC'),0);
    gl.uniform1i(gl.getUniformLocation(p,'u_obs'),1);
    gl.uniform2f(gl.getUniformLocation(p,'u_grid'), this.W, this.H);
    gl.uniform1i(gl.getUniformLocation(p,'u_mode'), this.vizMode);
    gl.uniform1f(gl.getUniformLocation(p,'u_scale'), this.vizScale);

    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }

  // Read velocity field at a grid point (for streamlines on CPU)
  getVelocityAt(gx, gy) {
    // We read from texC using readPixels — expensive, only for debug
    // Instead expose the ping index so overlay can sample via WebGL
    return null;
  }
}
