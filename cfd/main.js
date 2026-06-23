import { LBMSolver } from './lbm.js';
import { DrawingTool } from './drawing.js';
import { Streamlines } from './streamlines.js';

// ── Grid dimensions ──────────────────────────────────────────────────
const GRID_W = 512;
const GRID_H = 256;

// ── DOM refs ─────────────────────────────────────────────────────────
const simCanvas    = document.getElementById('sim-canvas');
const streamCanvas = document.getElementById('stream-canvas');
const handleCanvas = document.getElementById('handle-canvas');
const drawCanvas   = document.getElementById('draw-canvas');
// draw-canvas sits on top and receives pointer events; sim-canvas is WebGL output
const tooltip      = document.getElementById('tooltip');
const canvasWrap   = document.querySelector('.canvas-wrap');

const elFPS    = document.getElementById('fps');
const elStep   = document.getElementById('step');
const elRe     = document.getElementById('re');
const elOmega  = document.getElementById('val-omega');
const elU0     = document.getElementById('val-u0');
const elBrush  = document.getElementById('val-brush');
const elSmooth = document.getElementById('val-smooth');
const elAngle  = document.getElementById('val-angle');
const elScale  = document.getElementById('val-scale');

// ── WebGL2 setup ─────────────────────────────────────────────────────
const gl = simCanvas.getContext('webgl2', {
  antialias: false,
  preserveDrawingBuffer: true
});
if(!gl) { alert('WebGL2 not supported'); throw new Error(); }

// ── Solver init ──────────────────────────────────────────────────────
let solver;
try {
  solver = new LBMSolver(gl, GRID_W, GRID_H);
} catch(e) {
  document.body.innerHTML = `<div style="color:#f7768e;padding:32px;font-family:monospace">
    <b>WebGL2 Error:</b><br>${e.message}</div>`;
  throw e;
}

// ── Drawing tool ─────────────────────────────────────────────────────
// Bind drawing to the top overlay canvas so it receives pointer events
const draw = new DrawingTool(solver, drawCanvas, handleCanvas, tooltip);

// ── Streamlines ──────────────────────────────────────────────────────
let streamlines;

// ── Layout / resize ──────────────────────────────────────────────────
function resize() {
  const ww = canvasWrap.clientWidth;
  const wh = canvasWrap.clientHeight;
  // Maintain aspect ratio of grid
  const aspect = GRID_W / GRID_H;
  let cw = ww, ch = Math.floor(ww / aspect);
  if(ch > wh) { ch = wh; cw = Math.floor(wh * aspect); }

  for(const c of [simCanvas, streamCanvas, handleCanvas, drawCanvas]) {
    c.width  = cw;
    c.height = ch;
    c.style.width  = cw + 'px';
    c.style.height = ch + 'px';
  }
  simCanvas.style.position = 'absolute';
  simCanvas.style.left = Math.floor((ww-cw)/2)+'px';
  simCanvas.style.top  = Math.floor((wh-ch)/2)+'px';
  for(const c of [streamCanvas, handleCanvas, drawCanvas]) {
    c.style.position = 'absolute';
    c.style.left = simCanvas.style.left;
    c.style.top  = simCanvas.style.top;
  }

  if(streamlines) streamlines.resize(cw, ch);
}
window.addEventListener('resize', resize);
resize();

// Init streamlines after resize sets canvas size
streamlines = new Streamlines(solver, gl, streamCanvas);

// ── Preset car shape: simple coupe silhouette ─────────────────────────
function drawCarPreset() {
  const W = GRID_W, H = GRID_H;
  const cx = W*0.42, cy = H*0.42;
  const carW = W*0.30, carH = H*0.16;
  const r = 3;

  // Roof (arch via ellipse top half)
  const roofW = carW*0.52, roofH = carH*0.65;
  const roofCx = cx + carW*0.04, roofCy = cy + carH*0.18;
  const steps = 40;
  let prev = null;
  for(let i=0;i<=steps;i++){
    const t = Math.PI + Math.PI*(i/steps); // top half
    const x = roofCx + roofW*Math.cos(t);
    const y = roofCy + roofH*Math.sin(t);
    if(prev) solver.paintLine(prev.x,prev.y,x,y,r,true);
    prev={x,y};
  }

  // Bottom (flat floor)
  const floorY = cy - carH*0.45;
  const bodyL = cx - carW*0.48;
  const bodyR = cx + carW*0.48;
  solver.paintLine(bodyL, floorY, bodyR, floorY, r, true);

  // Front nose (angled)
  solver.paintLine(bodyR, floorY, bodyR - carW*0.06, cy + carH*0.1, r, true);
  // Front hood
  solver.paintLine(bodyR - carW*0.06, cy + carH*0.1, roofCx+roofW, roofCy, r, true);

  // Rear
  solver.paintLine(bodyL, floorY, bodyL + carW*0.02, cy + carH*0.05, r, true);
  solver.paintLine(bodyL + carW*0.02, cy + carH*0.05, roofCx-roofW, roofCy, r, true);

  // Wheels (filled circles)
  const wheelR = carH*0.22;
  solver.paintObstacle(bodyL + carW*0.14, floorY - wheelR*0.1, wheelR, true);
  solver.paintObstacle(bodyR - carW*0.14, floorY - wheelR*0.1, wheelR, true);

  // Spoiler
  const spoilerX = bodyL + carW*0.04;
  solver.paintLine(spoilerX, floorY+carH*0.04, spoilerX - carW*0.04, floorY+carH*0.28, r+1, true);
}

// ── Tool button clicks ────────────────────────────────────────────────
const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    toolBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.dataset.tool;
    draw.setMode(t);
    canvasWrap.className = 'canvas-wrap';
    if(t==='freehand'||t==='line'||t==='rect'||t==='ellipse'||t==='bezier') canvasWrap.classList.add('drawing');
    if(t==='erase') canvasWrap.classList.add('erasing');
  });
});

// Bezier commit/clear
document.getElementById('btn-bez-commit')?.addEventListener('click', () => draw.commitBezier());
document.getElementById('btn-bez-clear')?.addEventListener('click',  () => draw.clearBezier());

// ── Viz mode buttons ──────────────────────────────────────────────────
const vizBtns = document.querySelectorAll('.viz-btn[data-viz]');
vizBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    vizBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    solver.vizMode = parseInt(btn.dataset.viz);
    updateLegend(solver.vizMode);
  });
});

// ── Action buttons ────────────────────────────────────────────────────
document.getElementById('btn-reset').addEventListener('click', () => {
  solver.reset();
  streamlines._spawnAll();
  streamlines.clear();
});

document.getElementById('btn-clear-obs').addEventListener('click', () => {
  solver.clearObstacles();
  solver.reset();
  streamlines._spawnAll();
  streamlines.clear();
});

document.getElementById('btn-preset-car').addEventListener('click', () => {
  solver.clearObstacles();
  solver.reset();
  drawCarPreset();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const url = simCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href=url; a.download='cfd-frame.png'; a.click();
});

// ── Sliders ───────────────────────────────────────────────────────────
document.getElementById('sl-omega').addEventListener('input', function(){
  solver.omega = parseFloat(this.value);
  elOmega.textContent = solver.omega.toFixed(2);
  updateRe();
});

document.getElementById('sl-u0').addEventListener('input', function(){
  solver.u0 = parseFloat(this.value);
  elU0.textContent = solver.u0.toFixed(3);
  updateRe();
});

document.getElementById('sl-brush').addEventListener('input', function(){
  draw.brushRadius = parseInt(this.value);
  elBrush.textContent = draw.brushRadius;
});

document.getElementById('sl-smooth').addEventListener('input', function(){
  draw.smoothing = parseFloat(this.value);
  elSmooth.textContent = draw.smoothing.toFixed(1);
});

document.getElementById('sl-angle').addEventListener('input', function(){
  solver.angle = parseFloat(this.value) * Math.PI/180;
  elAngle.textContent = this.value + '°';
  solver.reset();
  drawAngleIndicator(parseFloat(this.value));
});

document.getElementById('sl-scale').addEventListener('input', function(){
  solver.vizScale = parseFloat(this.value);
  elScale.textContent = parseFloat(this.value).toFixed(2);
});

document.getElementById('sl-particles').addEventListener('input', function(){
  streamlines.numParticles = parseInt(this.value);
  streamlines._spawnAll();
});

document.getElementById('chk-streamlines').addEventListener('change', function(){
  streamlines.enabled = this.checked;
  if(!this.checked) streamlines.clear();
});

function updateRe() {
  const tau = 1/solver.omega;
  const nu  = (tau - 0.5) / 3;
  const Re  = Math.round(solver.u0 * GRID_H / nu);
  elRe.textContent = Re;
}
updateRe();

// ── Angle indicator ────────────────────────────────────────────────────
const angleCtx = document.getElementById('angle-canvas').getContext('2d');
function drawAngleIndicator(deg) {
  const c = angleCtx;
  const r = 28;
  c.clearRect(0,0,60,60);
  c.strokeStyle = '#1e1e2e';
  c.lineWidth = 2;
  c.beginPath(); c.arc(30,30,r,0,2*Math.PI); c.stroke();
  const a = -deg * Math.PI/180;
  c.strokeStyle = '#7aa2f7';
  c.lineWidth = 2;
  c.beginPath(); c.moveTo(30,30);
  c.lineTo(30 + r*Math.cos(a), 30 + r*Math.sin(a)); c.stroke();
  // label
  c.fillStyle='#7aa2f7';
  c.font='8px monospace';
  c.textAlign='center';
  c.fillText(deg+'°', 30, 30+r+10);
}
drawAngleIndicator(0);

// ── Legend ────────────────────────────────────────────────────────────
function updateLegend(mode) {
  const bar = document.getElementById('legend-bar');
  const minL = document.getElementById('legend-min');
  const maxL = document.getElementById('legend-max');
  const modeL = document.getElementById('legend-mode');
  const maps = {
    0: { label:'Speed',    min:'0', max:'u_max', grad:'linear-gradient(to right,#050384,#c03d74,#f0f421)' },
    1: { label:'Pressure', min:'low', max:'high', grad:'linear-gradient(to right,#042db6,#ddd,#c21904)' },
    2: { label:'Vorticity',min:'−',  max:'+',   grad:'linear-gradient(to right,#042db6,#ddd,#c21904)' },
    3: { label:'Ux',       min:'0', max:'u_max', grad:'linear-gradient(to right,#270c52,#1e8f82,#faed24)' },
  };
  const m = maps[mode];
  bar.style.background = m.grad;
  minL.textContent = m.min;
  maxL.textContent = m.max;
  modeL.textContent = m.label;
}
updateLegend(0);

// ── Main loop ─────────────────────────────────────────────────────────
let frameCount=0, lastFPS=performance.now(), fps=0;
let paused=false;
document.getElementById('btn-pause').addEventListener('click', function(){
  paused=!paused;
  this.textContent = paused ? '▶ Resume' : '⏸ Pause';
});

function loop() {
  requestAnimationFrame(loop);
  if(!paused){
    solver.simulate(4);
    solver.render(simCanvas.width, simCanvas.height);
    streamlines.update(frameCount);
    streamlines.draw();
  }

  frameCount++;
  const now = performance.now();
  if(now-lastFPS > 500){
    fps = Math.round(frameCount*1000/(now-lastFPS));
    frameCount=0; lastFPS=now;
    elFPS.textContent  = fps;
    elStep.textContent = solver.step;
  }
}

// Hide tooltip when mouse leaves canvas area
simCanvas.addEventListener('mouseleave', () => { tooltip.style.display='none'; });

// Load preset on start
drawCarPreset();
loop();
