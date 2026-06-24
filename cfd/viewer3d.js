// 3D WebGL viewer — orbit camera, textured flow plane, extruded obstacle
// Reads from LBM viz texture and renders full 3D scene

// ── Minimal math helpers ─────────────────────────────────────────────
function mat4Identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for(let r=0;r<4;r++) for(let c=0;c<4;c++) {
    let s=0; for(let k=0;k<4;k++) s+=a[r+k*4]*b[k+c*4];
    o[r+c*4]=s;
  }
  return o;
}
function mat4Perspective(fovY, aspect, near, far) {
  const f = 1/Math.tan(fovY*0.5);
  const nf = 1/(near-far);
  return new Float32Array([
    f/aspect,0,0,0,
    0,f,0,0,
    0,0,(far+near)*nf,-1,
    0,0,2*far*near*nf,0
  ]);
}
function mat4LookAt(eye, ctr, up) {
  const f=norm(sub(ctr,eye));
  const r=norm(cross(f,up));
  const u=cross(r,f);
  return new Float32Array([
    r[0],u[0],-f[0],0,
    r[1],u[1],-f[1],0,
    r[2],u[2],-f[2],0,
    -dot(r,eye),-dot(u,eye),dot(f,eye),1
  ]);
}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function norm(v){const l=Math.sqrt(dot(v,v));return[v[0]/l,v[1]/l,v[2]/l];}

// ── Shaders ───────────────────────────────────────────────────────────
const VS3D = `#version 300 es
in vec3 a_pos;
in vec2 a_uv;
in vec3 a_normal;
uniform mat4 u_mvp;
uniform mat4 u_model;
out vec2 v_uv;
out vec3 v_normal;
out vec3 v_worldPos;
void main(){
  vec4 wp = u_model * vec4(a_pos,1.0);
  v_worldPos = wp.xyz;
  v_uv = a_uv;
  v_normal = mat3(u_model) * a_normal;
  gl_Position = u_mvp * vec4(a_pos,1.0);
}`;

const FS_GROUND = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_worldPos;
uniform sampler2D u_flow;
uniform float u_alpha;
out vec4 fragColor;
void main(){
  vec3 c = texture(u_flow, v_uv).rgb;
  // Subtle grid overlay
  float gx = mod(v_uv.x*32.0, 1.0);
  float gy = mod(v_uv.y*16.0, 1.0);
  float grid = step(0.97, gx) + step(0.97, gy);
  c = mix(c, vec3(0.12,0.12,0.18), grid*0.3);
  fragColor = vec4(c, u_alpha);
}`;

const FS_OBSTACLE = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_worldPos;
uniform vec3 u_color;
uniform vec3 u_lightDir;
out vec4 fragColor;
void main(){
  vec3 n = normalize(v_normal);
  float diff = max(dot(n, normalize(u_lightDir)), 0.0);
  float amb = 0.25;
  vec3 col = u_color * (amb + diff*0.75);
  // Edge highlight
  float edge = 1.0 - abs(dot(n, vec3(0.0,1.0,0.0)));
  col = mix(col, col*1.4, edge*0.3);
  fragColor = vec4(col, 1.0);
}`;

const FS_GRID = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
void main(){
  fragColor = vec4(0.15,0.15,0.22, 0.7);
}`;

const VS_LINE = `#version 300 es
in vec3 a_pos;
in vec3 a_color;
uniform mat4 u_mvp;
out vec3 v_color;
void main(){ v_color=a_color; gl_Position=u_mvp*vec4(a_pos,1.0); }`;
const FS_LINE = `#version 300 es
precision highp float;
in vec3 v_color;
out vec4 fragColor;
void main(){ fragColor=vec4(v_color,1.0); }`;

// ── Viewer3D class ────────────────────────────────────────────────────
export class Viewer3D {
  constructor(gl, solver, canvas) {
    this.gl = gl;
    this.solver = solver;
    this.canvas = canvas;

    // Camera: spherical coords
    this.theta = -0.4;   // azimuth
    this.phi   =  0.65;  // elevation
    this.r     =  1.8;   // distance
    this.target = [0.5, 0.0, 0.15];

    // Mouse state
    this._drag = false;
    this._pan  = false;
    this._lastX = 0; this._lastY = 0;

    // World dimensions (normalized)
    this.W3 = 1.0;
    this.H3 = 0.5;
    this.D3 = 0.12; // extrusion depth

    // Offscreen viz texture + FBO (created once)
    this.vizTex = null;
    this.vizFBO = null;

    this._initGL();
    this._buildGroundMesh();
    this._buildGridMesh();
    this._bindMouse();
  }

  _compile(type, src) {
    const s = this.gl.createShader(type);
    this.gl.shaderSource(s, src);
    this.gl.compileShader(s);
    if(!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS))
      throw new Error('Shader: ' + this.gl.getShaderInfoLog(s));
    return s;
  }

  _prog(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this._compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this._compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('Link: ' + gl.getProgramInfoLog(p));
    return p;
  }

  _initGL() {
    const gl = this.gl;
    this.prog3D     = this._prog(VS3D, FS_GROUND);
    this.progObs    = this._prog(VS3D, FS_OBSTACLE);
    this.progGrid   = this._prog(VS3D, FS_GRID);
    this.progLine   = this._prog(VS_LINE, FS_LINE);

    // Create offscreen viz texture (RGBA8 is fine for display)
    const W = this.solver.W, H = this.solver.H;
    this.vizTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.vizTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

    this.vizFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.vizFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.vizTex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Streamline VAO
    this.streamBuf = gl.createBuffer();
    this.streamVAO = gl.createVertexArray();
  }

  _buildGroundMesh() {
    const gl = this.gl;
    const W = this.W3, H = this.H3;
    // 32x16 subdivided ground plane for nice perspective
    const nx=32, ny=16;
    const verts=[], uvs=[], norms=[], idx=[];
    for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++){
      verts.push(i/nx*W, 0, j/ny*H);
      uvs.push(i/nx, j/ny);
      norms.push(0,1,0);
    }
    for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
      const a=(j*(nx+1)+i), b=a+1, c=a+(nx+1), d=c+1;
      idx.push(a,b,d, a,d,c);
    }
    this.groundVAO = this._makeVAO(this.prog3D, verts, uvs, norms, idx);
    this.groundIndexCount = idx.length;
  }

  _buildGridMesh() {
    const gl = this.gl;
    // Background wall and floor grid lines
    const verts=[], uvs=[], norms=[], idx=[];
    // Just a back wall quad
    const W=this.W3, H=this.H3, D=this.D3*3;
    // back wall (behind the flow, at z=H)
    verts.push(0,0,H, W,0,H, W,D*2,H, 0,D*2,H);
    uvs.push(0,0, 1,0, 1,1, 0,1);
    norms.push(0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1);
    idx.push(0,1,2, 0,2,3);
    this.wallVAO = this._makeVAO(this.progGrid, verts, uvs, norms, idx);
    this.wallIndexCount = idx.length;
  }

  _makeVAO(prog, verts, uvs, norms, idx) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const setAttr = (name, data, size) => {
      const loc = gl.getAttribLocation(prog, name);
      if(loc < 0) return;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    setAttr('a_pos',    verts, 3);
    setAttr('a_uv',     uvs,   2);
    setAttr('a_normal', norms, 3);

    const ibuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    return vao;
  }

  // Build extruded obstacle mesh from CPU obstacle array
  buildObstacleMesh() {
    const gl = this.gl;
    const s = this.solver;
    const W = s.W, H = s.H;
    const W3 = this.W3, H3 = this.H3, D3 = this.D3;

    const verts=[], norms=[], idx=[];
    let vi=0;

    const addQuad = (p0,p1,p2,p3, nx,ny,nz) => {
      const base=vi;
      for(const p of [p0,p1,p2,p3]){
        verts.push(p[0],p[1],p[2]);
        norms.push(nx,ny,nz);
      }
      idx.push(base,base+1,base+2, base,base+2,base+3);
      vi+=4;
    };

    // Scan obstacle cells and build faces
    const toX = x => (x/W)*W3;
    const toZ = y => (y/H)*H3;

    for(let y=1;y<H-1;y++){
      for(let x=1;x<W-1;x++){
        if(!s.obsCPU[y*W+x]) continue;
        const x0=toX(x), x1=toX(x+1);
        const z0=toZ(y), z1=toZ(y+1);
        const top=D3;

        // Top face (Y+)
        if(!s.obsCPU[(y+1)*W+x])
          addQuad([x0,top,z0],[x1,top,z0],[x1,top,z1],[x0,top,z1], 0,1,0);
        // Front face (Z-)
        if(y>0 && !s.obsCPU[(y-1)*W+x])
          addQuad([x0,0,z0],[x1,0,z0],[x1,top,z0],[x0,top,z0], 0,0,-1);
        // Back face (Z+)
        if(y<H-1 && !s.obsCPU[(y+1)*W+x] && s.obsCPU[(y+1)*W+x]===0)
          addQuad([x1,0,z1],[x0,0,z1],[x0,top,z1],[x1,top,z1], 0,0,1);
        // Left face (X-)
        if(x>0 && !s.obsCPU[y*W+(x-1)])
          addQuad([x0,0,z1],[x0,0,z0],[x0,top,z0],[x0,top,z1], -1,0,0);
        // Right face (X+)
        if(x<W-1 && !s.obsCPU[y*W+(x+1)])
          addQuad([x1,0,z0],[x1,0,z1],[x1,top,z1],[x1,top,z0], 1,0,0);
      }
    }

    if(verts.length === 0) { this.obsVAO=null; this.obsIndexCount=0; return; }

    this.obsVAO = this._makeVAO(this.progObs, verts, [], norms, idx);
    this.obsIndexCount = idx.length;
    this._obsMeshDirty = false;
  }

  // Update streamline positions from streamlines system
  updateStreamlines(particles, W3, H3, solverW, solverH) {
    const gl = this.gl;
    const pts=[], cols=[];
    for(const p of particles){
      const x=(p.x/solverW)*W3;
      const z=(p.y/solverH)*H3;
      const y=0.002;
      pts.push(x,y,z);
      const t=Math.min((p.spd||0.08)*8,1);
      const r=t, g=0.7+0.3*(1-t), b=1-t;
      cols.push(r,g,b);
    }
    gl.bindVertexArray(this.streamVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.streamBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...pts,...cols]), gl.DYNAMIC_DRAW);
    const stride=0;
    const posLoc=gl.getAttribLocation(this.progLine,'a_pos');
    const colLoc=gl.getAttribLocation(this.progLine,'a_color');
    if(posLoc>=0){
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0);
    }
    if(colLoc>=0){
      const offset=pts.length*4;
      const colBuf=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,colBuf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cols),gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(colLoc);
      gl.vertexAttribPointer(colLoc,3,gl.FLOAT,false,0,0);
    }
    gl.bindVertexArray(null);
    this.streamCount=pts.length/3;
  }

  // Camera matrix
  _viewProj() {
    const eye = [
      this.target[0] + this.r*Math.cos(this.phi)*Math.sin(this.theta),
      this.target[1] + this.r*Math.sin(this.phi),
      this.target[2] + this.r*Math.cos(this.phi)*Math.cos(this.theta),
    ];
    const view = mat4LookAt(eye, this.target, [0,1,0]);
    const W = this.canvas.width, H = this.canvas.height;
    const proj = mat4Perspective(Math.PI/4, W/H, 0.01, 100);
    return { vp: mat4Mul(proj, view), eye };
  }

  // Run LBM viz pass → offscreen texture
  captureVizTexture() {
    const gl = this.gl;
    const s = this.solver;
    const W = s.W, H = s.H;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.vizFBO);
    gl.viewport(0,0,W,H);

    // Use solver's viz program
    s.render(W, H);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  render(streamParticles) {
    const gl = this.gl;
    const CW = this.canvas.width, CH = this.canvas.height;

    // Capture viz to texture first
    this.captureVizTexture();

    // Rebuild obstacle mesh if dirty
    if(this._obsMeshDirty !== false) this.buildObstacleMesh();

    gl.viewport(0,0,CW,CH);
    gl.clearColor(0.05,0.05,0.09,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);

    const {vp, eye} = this._viewProj();
    const model = mat4Identity();
    const mvp = mat4Mul(vp, model);

    // ── Ground plane (flow field) ──────────────────────────
    gl.useProgram(this.prog3D);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.prog3D,'u_mvp'),false,mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.prog3D,'u_model'),false,model);
    gl.uniform1f(gl.getUniformLocation(this.prog3D,'u_alpha'),1.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.vizTex);
    gl.uniform1i(gl.getUniformLocation(this.prog3D,'u_flow'),0);
    gl.bindVertexArray(this.groundVAO);
    gl.drawElements(gl.TRIANGLES, this.groundIndexCount, gl.UNSIGNED_INT, 0);

    // ── Wall backdrop ──────────────────────────────────────
    gl.useProgram(this.progGrid);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progGrid,'u_mvp'),false,mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progGrid,'u_model'),false,model);
    gl.bindVertexArray(this.wallVAO);
    gl.drawElements(gl.TRIANGLES, this.wallIndexCount, gl.UNSIGNED_INT, 0);

    // ── Obstacle (extruded car) ────────────────────────────
    if(this.obsVAO && this.obsIndexCount > 0) {
      gl.useProgram(this.progObs);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.progObs,'u_mvp'),false,mvp);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.progObs,'u_model'),false,model);
      gl.uniform3fv(gl.getUniformLocation(this.progObs,'u_color'),new Float32Array([0.75,0.80,0.90]));
      gl.uniform3fv(gl.getUniformLocation(this.progObs,'u_lightDir'),new Float32Array([1,2,1]));
      gl.bindVertexArray(this.obsVAO);
      gl.drawElements(gl.TRIANGLES, this.obsIndexCount, gl.UNSIGNED_INT, 0);
    }

    // ── Streamlines as points ──────────────────────────────
    if(streamParticles && streamParticles.length > 0) {
      this._drawStreamPoints(streamParticles, mvp);
    }

    // ── Axis indicator (bottom-left) ───────────────────────
    this._drawAxes(vp);

    gl.disable(gl.DEPTH_TEST);
  }

  _drawStreamPoints(particles, mvp) {
    const gl = this.gl;
    const s = this.solver;
    const pts=[], cols=[];

    for(const p of particles){
      const x=(p.x/s.W)*this.W3;
      const z=(p.y/s.H)*this.H3;
      pts.push(x,0.003,z);
      const spd = Math.min(Math.sqrt((p.vx||0)**2+(p.vy||0)**2)/s.u0,1);
      // Speed → cyan-to-yellow
      cols.push(spd, 0.6+0.4*spd, 1-spd);
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW);
    const posLoc=gl.getAttribLocation(this.progLine,'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0);

    const cbuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cbuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols), gl.DYNAMIC_DRAW);
    const colLoc=gl.getAttribLocation(this.progLine,'a_color');
    gl.enableVertexAttribArray(colLoc);
    gl.vertexAttribPointer(colLoc,3,gl.FLOAT,false,0,0);

    gl.useProgram(this.progLine);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progLine,'u_mvp'),false,mvp);
    gl.enable(gl.PROGRAM_POINT_SIZE);
    gl.drawArrays(gl.POINTS, 0, pts.length/3);

    gl.bindVertexArray(null);
    gl.deleteVertexArray(vao);
    gl.deleteBuffer(buf);
    gl.deleteBuffer(cbuf);
  }

  _drawAxes(vp) {
    const gl = this.gl;
    // Small axes in bottom-left corner
    const s=0.06;
    const ox=this.target[0], oy=this.target[1], oz=this.target[2];
    const lines=[
      ox,oy,oz, ox+s,oy,oz,  1,0.2,0.2,  // X red
      ox,oy,oz, ox,oy+s,oz,  0.2,1,0.2,  // Y green
      ox,oy,oz, ox,oy,oz+s,  0.2,0.5,1,  // Z blue
    ];
    // flatten into pos+col buffers
    const pos=[],col=[];
    for(let i=0;i<lines.length;i+=9){
      pos.push(lines[i],lines[i+1],lines[i+2]);
      col.push(lines[i+6],lines[i+7],lines[i+8]);
      pos.push(lines[i+3],lines[i+4],lines[i+5]);
      col.push(lines[i+6],lines[i+7],lines[i+8]);
    }
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    const pb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,pb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.DYNAMIC_DRAW);
    const pl=gl.getAttribLocation(this.progLine,'a_pos');
    gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl,3,gl.FLOAT,false,0,0);
    const cb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,cb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(col),gl.DYNAMIC_DRAW);
    const cl=gl.getAttribLocation(this.progLine,'a_color');
    gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl,3,gl.FLOAT,false,0,0);
    gl.useProgram(this.progLine);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.progLine,'u_mvp'),false,mat4Mul(mat4Perspective(Math.PI/4,this.canvas.width/this.canvas.height,0.01,100),mat4LookAt([this.target[0]+this.r*Math.cos(this.phi)*Math.sin(this.theta),this.target[1]+this.r*Math.sin(this.phi),this.target[2]+this.r*Math.cos(this.phi)*Math.cos(this.theta)],this.target,[0,1,0])));
    gl.drawArrays(gl.LINES,0,pos.length/3);
    gl.bindVertexArray(null); gl.deleteVertexArray(vao); gl.deleteBuffer(pb); gl.deleteBuffer(cb);
  }

  // ── Mouse orbit ──────────────────────────────────────────────────────
  _bindMouse() {
    const c = this.canvas;
    c.addEventListener('mousedown', e => {
      if(e.button===0) this._drag=true;
      if(e.button===2||e.button===1) this._pan=true;
      this._lastX=e.clientX; this._lastY=e.clientY;
      e.preventDefault();
    });
    window.addEventListener('mouseup', () => { this._drag=false; this._pan=false; });
    window.addEventListener('mousemove', e => {
      const dx=e.clientX-this._lastX, dy=e.clientY-this._lastY;
      this._lastX=e.clientX; this._lastY=e.clientY;
      if(this._drag){
        this.theta -= dx*0.005;
        this.phi   = Math.max(0.08, Math.min(Math.PI/2-0.05, this.phi-dy*0.005));
      }
      if(this._pan){
        const sc=0.001*this.r;
        const right=[Math.cos(this.theta),0,-Math.sin(this.theta)];
        this.target[0]-=right[0]*dx*sc;
        this.target[2]-=right[2]*dx*sc;
        this.target[1]+=dy*sc;
      }
    });
    c.addEventListener('wheel', e => {
      this.r = Math.max(0.3, Math.min(5, this.r+e.deltaY*0.002));
      e.preventDefault();
    }, {passive:false});
    c.addEventListener('contextmenu', e=>e.preventDefault());

    // Touch support
    let lastTouches=[];
    c.addEventListener('touchstart', e=>{
      lastTouches=[...e.touches]; e.preventDefault();
    },{passive:false});
    c.addEventListener('touchmove', e=>{
      if(e.touches.length===1 && lastTouches.length===1){
        const dx=e.touches[0].clientX-lastTouches[0].clientX;
        const dy=e.touches[0].clientY-lastTouches[0].clientY;
        this.theta-=dx*0.006;
        this.phi=Math.max(0.08,Math.min(Math.PI/2-0.05,this.phi-dy*0.006));
      } else if(e.touches.length===2 && lastTouches.length===2){
        const d0=Math.hypot(lastTouches[0].clientX-lastTouches[1].clientX,lastTouches[0].clientY-lastTouches[1].clientY);
        const d1=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        this.r=Math.max(0.3,Math.min(5,this.r-(d1-d0)*0.005));
      }
      lastTouches=[...e.touches]; e.preventDefault();
    },{passive:false});
  }

  markObstacleDirty() { this._obsMeshDirty = true; }

  resetCamera() {
    this.theta=-0.4; this.phi=0.65; this.r=1.8;
    this.target=[0.5,0.0,0.15];
  }

  topView()  { this.phi=Math.PI/2-0.01; this.r=1.5; }
  sideView() { this.phi=0.05; this.theta=Math.PI/2; this.r=1.5; }
  frontView(){ this.phi=0.2;  this.theta=0; this.r=1.5; }
}
