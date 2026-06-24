import { LBMSolver }      from './lbm.js';
import { DrawingTool }     from './drawing.js';
import { Streamlines }     from './streamlines.js';
import { ForceCalculator } from './forces.js';
import { PRESETS, formatRe, lbmRe } from './presets.js';
import { importFile, drawShape } from './obj-import.js';

const GRID_W = 512, GRID_H = 256;

// ── DOM ──────────────────────────────────────────────────────────────
const simCanvas    = document.getElementById('sim-canvas');
const streamCanvas = document.getElementById('stream-canvas');
const handleCanvas = document.getElementById('handle-canvas');
const drawCanvas   = document.getElementById('draw-canvas');
const canvasWrap   = document.getElementById('canvas-wrap');
const tooltip      = document.getElementById('tooltip');

// ── WebGL2 ───────────────────────────────────────────────────────────
const gl = simCanvas.getContext('webgl2', { antialias:false, preserveDrawingBuffer:true });
if(!gl) { alert('WebGL2 not supported — please use Chrome, Firefox or Edge'); throw new Error(); }

// ── Solver ───────────────────────────────────────────────────────────
let solver;
try {
  solver = new LBMSolver(gl, GRID_W, GRID_H);
} catch(e) {
  document.body.innerHTML = `<div style="color:#f7768e;padding:32px;font-family:Arial">
    <b>WebGL2 init failed:</b><br>${e.message}</div>`;
  throw e;
}

// ── Drawing + Forces + Streamlines ───────────────────────────────────
const draw   = new DrawingTool(solver, canvasWrap, handleCanvas, tooltip);
const forces = new ForceCalculator(solver, gl);
let streamlines;

// ── Layout ───────────────────────────────────────────────────────────
function resize() {
  const ww = canvasWrap.clientWidth, wh = canvasWrap.clientHeight;
  const aspect = GRID_W / GRID_H;
  let cw = ww, ch = Math.floor(ww / aspect);
  if(ch > wh) { ch = wh; cw = Math.floor(wh * aspect); }

  const lx = Math.floor((ww-cw)/2), ly = Math.floor((wh-ch)/2);

  for(const c of [simCanvas, streamCanvas, handleCanvas, drawCanvas]) {
    c.width = cw; c.height = ch;
    c.style.width = cw+'px'; c.style.height = ch+'px';
    c.style.left = lx+'px'; c.style.top = ly+'px';
  }
  if(streamlines) streamlines.resize(cw, ch);
}
window.addEventListener('resize', resize);
resize();

streamlines = new Streamlines(solver, gl, streamCanvas);

// ── Presets ───────────────────────────────────────────────────────────
let currentPreset = 'custom';

function applyPreset(key) {
  const p = PRESETS[key];
  if(!p) return;
  currentPreset = key;

  // Update solver params
  solver.u0    = p.u0;
  solver.omega = p.omega;
  solver.angle = p.angle * Math.PI/180;

  // Update sliders
  document.getElementById('sl-u0').value    = p.u0;
  document.getElementById('sl-omega').value = p.omega;
  document.getElementById('sl-angle').value = p.angle;
  document.getElementById('val-u0').textContent    = p.u0.toFixed(3);
  document.getElementById('val-omega').textContent = p.omega.toFixed(2);
  document.getElementById('val-angle').textContent = p.angle + '°';

  // Update preset buttons
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-preset="${key}"]`)?.classList.add('active');

  // Update badge + notes
  document.getElementById('badge-preset').textContent = p.label.toUpperCase();
  document.getElementById('preset-notes').textContent = p.notes;

  // Draw the shape
  solver.clearObstacles();
  if(p.shape) drawShape(p.shape, solver);
  solver.reset();
  forces.reset();
  streamlines._spawnAll();
  streamlines.clear();

  drawAngleIndicator(p.angle);
  updateRe();
  updateRealRe(p);
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

function updateRealRe(p) {
  const el = document.getElementById('real-re');
  el.textContent = p.realRe ? formatRe(p.realRe) : '—';
}

// ── Tool buttons ──────────────────────────────────────────────────────
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    draw.setMode(btn.dataset.tool);
  });
});

document.getElementById('btn-bez-commit')?.addEventListener('click', () => draw.commitBezier());
document.getElementById('btn-bez-clear')?.addEventListener('click',  () => draw.clearBezier());

// ── Viz buttons ───────────────────────────────────────────────────────
document.querySelectorAll('.viz-btn[data-viz]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    solver.vizMode = parseInt(btn.dataset.viz);
    updateLegend(solver.vizMode);
  });
});

// ── File import ───────────────────────────────────────────────────────
const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const importStatus = document.getElementById('import-status');
let importAxis = 'xz';

document.querySelectorAll('.axis-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.axis-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    importAxis = btn.dataset.axis;
  });
});

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  if(!file) return;
  importStatus.className = 'import-status';
  importStatus.textContent = `Loading ${file.name}…`;
  try {
    solver.clearObstacles();
    solver.reset();
    const count = await importFile(file, solver, importAxis);
    importStatus.textContent = `✓ Imported ${count} triangles`;
    forces.reset();
    streamlines._spawnAll();
    streamlines.clear();
    applyPreset('custom');
  } catch(e) {
    importStatus.className = 'import-status error';
    importStatus.textContent = `✗ ${e.message}`;
  }
}

// ── Sliders ───────────────────────────────────────────────────────────
document.getElementById('sl-omega').addEventListener('input', function(){
  solver.omega = parseFloat(this.value);
  document.getElementById('val-omega').textContent = solver.omega.toFixed(2);
  updateRe();
});

document.getElementById('sl-u0').addEventListener('input', function(){
  solver.u0 = parseFloat(this.value);
  document.getElementById('val-u0').textContent = solver.u0.toFixed(3);
  updateRe();
});

document.getElementById('sl-brush').addEventListener('input', function(){
  draw.brushRadius = parseInt(this.value);
  document.getElementById('val-brush').textContent = draw.brushRadius;
});

document.getElementById('sl-smooth').addEventListener('input', function(){
  draw.smoothing = parseFloat(this.value);
  document.getElementById('val-smooth').textContent = draw.smoothing.toFixed(1);
});

document.getElementById('sl-angle').addEventListener('input', function(){
  solver.angle = parseFloat(this.value) * Math.PI/180;
  document.getElementById('val-angle').textContent = this.value+'°';
  solver.reset();
  drawAngleIndicator(parseFloat(this.value));
});

document.getElementById('sl-scale').addEventListener('input', function(){
  solver.vizScale = parseFloat(this.value);
  document.getElementById('val-scale').textContent = parseFloat(this.value).toFixed(2);
});

document.getElementById('sl-particles').addEventListener('input', function(){
  streamlines.numParticles = parseInt(this.value);
  streamlines._spawnAll();
});

document.getElementById('chk-streamlines').addEventListener('change', function(){
  streamlines.enabled = this.checked;
  if(!this.checked) streamlines.clear();
});

// ── Action buttons ────────────────────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', () => {
  applyPreset(currentPreset);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  solver.reset(); forces.reset();
  streamlines._spawnAll(); streamlines.clear();
});

document.getElementById('btn-clear-obs').addEventListener('click', () => {
  solver.clearObstacles(); solver.reset(); forces.reset();
  streamlines._spawnAll(); streamlines.clear();
});

let paused = false;
document.getElementById('btn-pause').addEventListener('click', function(){
  paused = !paused;
  this.textContent = paused ? '▶ Resume' : '⏸ Pause';
});

document.getElementById('btn-export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = simCanvas.toDataURL('image/png');
  a.download = `cfd-${currentPreset}-step${solver.step}.png`;
  a.click();
});

// ── Stats helpers ─────────────────────────────────────────────────────
function updateRe() {
  const re = lbmRe(solver.u0, solver.omega, 80);
  document.getElementById('re').textContent = re;
}
updateRe();

function updateLegend(mode) {
  const maps = {
    0: { label:'Speed |u|',  min:'0',    max:'fast', grad:'linear-gradient(to right,#050384,#c03d74,#f0f421)' },
    1: { label:'Pressure',   min:'low',  max:'high', grad:'linear-gradient(to right,#042db6,#ddd,#c21904)' },
    2: { label:'Vorticity',  min:'−',    max:'+',    grad:'linear-gradient(to right,#042db6,#ddd,#c21904)' },
    3: { label:'Ux stream',  min:'0',    max:'fast', grad:'linear-gradient(to right,#270c52,#1e8f82,#faed24)' },
  };
  const m = maps[mode];
  document.getElementById('legend-bar').style.background = m.grad;
  document.getElementById('legend-min').textContent  = m.min;
  document.getElementById('legend-max').textContent  = m.max;
  document.getElementById('legend-mode').textContent = m.label;
}
updateLegend(0);

function updateForceDisplay() {
  const cdEl = document.getElementById('val-cd');
  const clEl = document.getElementById('val-cl');
  const barD = document.getElementById('bar-drag');
  const barL = document.getElementById('bar-lift');

  const cd = forces.Cd, cl = forces.Cl;
  cdEl.textContent = isFinite(cd) ? Math.abs(cd).toFixed(2) : '—';
  clEl.textContent = isFinite(cl) ? cl.toFixed(2) : '—';
  clEl.style.color = cl < 0 ? '#f7768e' : '#7aa2f7'; // red=downforce, blue=uplift

  barD.style.width = Math.min(100, Math.abs(cd)*40) + '%';
  barL.style.width = Math.min(100, Math.abs(cl)*30) + '%';
}

// ── Angle indicator ───────────────────────────────────────────────────
const angleCtx = document.getElementById('angle-canvas').getContext('2d');
function drawAngleIndicator(deg) {
  angleCtx.clearRect(0,0,60,60);
  angleCtx.strokeStyle = '#1e1e2e'; angleCtx.lineWidth = 2;
  angleCtx.beginPath(); angleCtx.arc(30,30,26,0,2*Math.PI); angleCtx.stroke();
  const a = -deg * Math.PI/180;
  angleCtx.strokeStyle = '#7aa2f7'; angleCtx.lineWidth = 2;
  angleCtx.beginPath(); angleCtx.moveTo(30,30);
  angleCtx.lineTo(30+26*Math.cos(a), 30+26*Math.sin(a)); angleCtx.stroke();
  angleCtx.fillStyle='#7aa2f7'; angleCtx.font='8px Arial';
  angleCtx.textAlign='center'; angleCtx.fillText(deg+'°',30,54);
}
drawAngleIndicator(0);

// ── Main loop ─────────────────────────────────────────────────────────
let frameCount=0, lastFPS=performance.now();
simCanvas.addEventListener('mouseleave', () => { tooltip.style.display='none'; });

// Load GT3 preset on start
applyPreset('gt3');

function loop() {
  requestAnimationFrame(loop);
  if(!paused) {
    solver.simulate(4);
    solver.render(simCanvas.width, simCanvas.height);
    forces.update(frameCount);
    streamlines.update(frameCount);
    streamlines.draw();
  }

  frameCount++;
  const now = performance.now();
  if(now - lastFPS > 500) {
    const fps = Math.round(frameCount*1000/(now-lastFPS));
    frameCount = 0; lastFPS = now;
    document.getElementById('fps').textContent  = fps;
    document.getElementById('step').textContent = solver.step;
    updateForceDisplay();
  }
}
loop();
