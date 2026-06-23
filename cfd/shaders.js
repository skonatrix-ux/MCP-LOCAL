// D2Q9 Lattice Boltzmann shaders

// D2Q9 velocity directions and weights:
// i:  0       1       2       3       4       5       6       7       8
// ex: 0       1       0      -1       0       1      -1      -1       1
// ey: 0       0       1       0      -1       1       1      -1      -1
// w:  4/9    1/9     1/9     1/9     1/9    1/36   1/36    1/36    1/36

// Textures layout:
//   texA (RGBA32F): f0, f1, f2, f3
//   texB (RGBA32F): f4, f5, f6, f7
//   texC (RGBA32F): f8, rho, ux, uy
//   texObstacle (R8): 1=solid, 0=fluid

export const VS_QUAD = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// -------------------------------------------------------------------
// COMBINED STREAMING + COLLISION (pull scheme, BGK)
// -------------------------------------------------------------------
export const FS_LBM = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D u_texA; // f0..f3
uniform sampler2D u_texB; // f4..f7
uniform sampler2D u_texC; // f8, rho, ux, uy
uniform sampler2D u_obs;  // obstacle mask
uniform vec2  u_grid;     // grid dimensions
uniform float u_omega;    // relaxation (1/tau)
uniform float u_u0;       // inlet velocity
uniform float u_angle;    // flow angle in radians

layout(location=0) out vec4 outA;
layout(location=1) out vec4 outB;
layout(location=2) out vec4 outC;

in vec2 v_uv;

// D2Q9 directions (ex, ey)
const vec2 E[9] = vec2[9](
  vec2( 0, 0), vec2( 1, 0), vec2( 0, 1),
  vec2(-1, 0), vec2( 0,-1), vec2( 1, 1),
  vec2(-1, 1), vec2(-1,-1), vec2( 1,-1)
);
const float W[9] = float[9](
  4.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0,
  1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0
);
// Opposite directions for bounce-back
const int OPP[9] = int[9](0,3,4,1,2,7,8,5,6);

float getF(int i, vec2 uv) {
  if(i < 4) return texture(u_texA, uv)[i];
  if(i < 8) return texture(u_texB, uv)[i-4];
  return texture(u_texC, uv).r;
}

float feq(int i, float rho, vec2 u) {
  float eu = dot(E[i], u);
  float usq = dot(u, u);
  return W[i] * rho * (1.0 + 3.0*eu + 4.5*eu*eu - 1.5*usq);
}

void main(){
  vec2 cell = floor(v_uv * u_grid);
  vec2 texel = 1.0 / u_grid;

  int x = int(cell.x);
  int y = int(cell.y);
  int W_ = int(u_grid.x);
  int H  = int(u_grid.y);

  // ---- Inlet BC (left wall) ----
  if(x == 0) {
    vec2 u0 = vec2(u_u0 * cos(u_angle), u_u0 * sin(u_angle));
    float rho0 = 1.0;
    outA = vec4(feq(0,rho0,u0), feq(1,rho0,u0), feq(2,rho0,u0), feq(3,rho0,u0));
    outB = vec4(feq(4,rho0,u0), feq(5,rho0,u0), feq(6,rho0,u0), feq(7,rho0,u0));
    outC = vec4(feq(8,rho0,u0), rho0, u0.x, u0.y);
    return;
  }

  // ---- Outlet BC (right wall) — copy from left neighbor ----
  if(x == W_-1) {
    vec2 nb = (cell + vec2(-1,0) + 0.5) / u_grid;
    outA = texture(u_texA, nb);
    outB = texture(u_texB, nb);
    outC = texture(u_texC, nb);
    return;
  }

  // ---- Pull streaming: for direction i, read from cell - E[i] ----
  float f[9];
  bool isSolid = texture(u_obs, v_uv).r > 0.5;

  for(int i = 0; i < 9; i++){
    vec2 src = cell - E[i];
    // Clamp to valid range
    src = clamp(src, vec2(0.0), u_grid - 1.0);
    vec2 srcUV = (src + 0.5) / u_grid;

    bool srcSolid = texture(u_obs, srcUV).r > 0.5;

    if(isSolid) {
      // Bounce-back: reflect
      f[i] = getF(OPP[i], v_uv);
    } else if(srcSolid) {
      // Neighbor is solid → bounce-back
      f[i] = getF(OPP[i], v_uv);
    } else {
      // Top/bottom walls: bounce-back
      if(int(src.y) < 0 || int(src.y) >= H){
        f[i] = getF(OPP[i], v_uv);
      } else {
        f[i] = getF(i, srcUV);
      }
    }
  }

  // ---- Macroscopic quantities ----
  float rho = 0.0;
  vec2  u   = vec2(0.0);
  for(int i=0;i<9;i++){
    rho += f[i];
    u   += E[i] * f[i];
  }
  if(rho > 0.0) u /= rho;

  // ---- BGK Collision ----
  float fout[9];
  for(int i=0;i<9;i++){
    fout[i] = f[i] - u_omega * (f[i] - feq(i, rho, u));
  }

  outA = vec4(fout[0], fout[1], fout[2], fout[3]);
  outB = vec4(fout[4], fout[5], fout[6], fout[7]);
  outC = vec4(fout[8], rho, u.x, u.y);
}`;

// -------------------------------------------------------------------
// VISUALIZATION — velocity magnitude / pressure / vorticity / streamlines
// -------------------------------------------------------------------
export const FS_VIZ = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D u_texC;  // f8, rho, ux, uy
uniform sampler2D u_obs;
uniform vec2      u_grid;
uniform int       u_mode;  // 0=speed, 1=pressure, 2=vorticity, 3=ux
uniform float     u_scale;

in  vec2 v_uv;
out vec4 fragColor;

// Colormaps
vec3 plasma(float t) {
  t = clamp(t,0.0,1.0);
  vec3 c0 = vec3(0.050383,0.029803,0.527975);
  vec3 c1 = vec3(0.798216,0.280197,0.469538);
  vec3 c2 = vec3(0.940015,0.975158,0.131326);
  if(t<0.5) return mix(c0,c1,t*2.0);
  return mix(c1,c2,(t-0.5)*2.0);
}

vec3 coolwarm(float t) {
  t = clamp(t,0.0,1.0);
  return mix(vec3(0.017,0.180,0.780), vec3(0.780,0.100,0.017), t);
}

vec3 viridis(float t){
  t = clamp(t,0.0,1.0);
  vec3 c0 = vec3(0.267,0.005,0.329);
  vec3 c1 = vec3(0.128,0.563,0.551);
  vec3 c2 = vec3(0.993,0.906,0.144);
  if(t<0.5) return mix(c0,c1,t*2.0);
  return mix(c1,c2,(t-0.5)*2.0);
}

void main(){
  bool solid = texture(u_obs, v_uv).r > 0.5;
  vec4 C = texture(u_texC, v_uv);
  float rho = C.g;
  vec2  vel = C.ba;

  if(solid){
    fragColor = vec4(0.08,0.09,0.12,1.0);
    return;
  }

  float val = 0.0;
  vec3  col = vec3(0.0);

  if(u_mode == 0){
    // Speed
    val = length(vel) / u_scale;
    col = plasma(val);
  } else if(u_mode == 1){
    // Pressure ~ rho/3 (isothermal LBM)
    val = (rho - 1.0) / u_scale + 0.5;
    col = coolwarm(val);
  } else if(u_mode == 2){
    // Vorticity — central difference
    vec2 texel = 1.0/u_grid;
    float uy_right = texture(u_texC, v_uv+vec2(texel.x,0)).a;
    float uy_left  = texture(u_texC, v_uv-vec2(texel.x,0)).a;
    float ux_up    = texture(u_texC, v_uv+vec2(0,texel.y)).b;
    float ux_down  = texture(u_texC, v_uv-vec2(0,texel.y)).b;
    float vort = ((uy_right-uy_left) - (ux_up-ux_down)) * 0.5;
    val = vort / u_scale + 0.5;
    col = coolwarm(val);
  } else {
    // ux component
    val = (vel.x / u_scale) * 0.5 + 0.5;
    col = viridis(val);
  }

  fragColor = vec4(col, 1.0);
}`;

// Streamline / particle advection — drawn on CPU overlay canvas
