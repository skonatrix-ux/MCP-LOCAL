import { LBMSolver }      from './lbm.js';
import { DrawingTool }     from './drawing.js';
import { Streamlines }     from './streamlines.js';
import { ForceCalculator } from './forces.js';
import { Viewer3D }        from './viewer3d.js';
import { PRESETS, formatRe, lbmRe } from './presets.js';
import { importFile, drawShape }     from './obj-import.js';

const GRID_W = 512, GRID_H = 256;

// ── DOM ──────────────────────────────────────────────────────────────
const mainCanvas   = document.getElementById('main-canvas');
const handleCanvas = document.getElementById('handle-canvas');
const tooltip      = document.getElementById('tooltip');
const vpWrap       = document.querySelector('.viewport-wrap');

// ── WebGL2 ───────────────────────────────────────────────────────────
const gl = mainCanvas.getContext('webgl2', { antialias:true, preserveDrawingBuffer:true });
if(!gl) { alert('WebGL2 not supported — please use Chrome, Firefox or Edge'); throw new Error(); }

// ── Solver ───────────────────────────────────────────────────────────
let solver;
try { solver = new LBMSolver(gl, GRID_W, GRID_H); }
catch(e) {
  document.body.innerHTML=`<div style="color:#f7768e;padding:32px;font-family:Arial"><b>WebGL2 error:</b><br>${e.message}</div>`;
  throw e;
}

// ── 3D viewer ─────────────────────────────────────────────────────────
let viewer3D = null;
let use3D = true;

function init3D() {
  try {
    viewer3D = new Viewer3D(gl, solver, mainCanvas);
  } catch(e) {
    console.warn('3D viewer init failed:', e);
    use3D = false;
  }
}

// ── Streamlines ───────────────────────────────────────────────────────
let streamlines;

// ── Drawing tool ──────────────────────────────────────────────────────
const draw = new DrawingTool(solver, vpWrap, handleCanvas, tooltip);

// ── Forces ────────────────────────────────────────────────────────────
const forces = new ForceCalculator(solver, gl);

// ── Layout ────────────────────────────────────────────────────────────
function resize() {
  const vp = vpWrap.getBoundingClientRect();
  const W = Math.floor(vp.width), H = Math.floor(vp.height - 28); // subtract vp-toolbar
  mainCanvas.width  = W;  mainCanvas.height  = H;
  mainCanvas.style.width  = W+'px';
  mainCanvas.style.height = H+'px';
  handleCanvas.width  = W;  handleCanvas.height  = H+28;
  handleCanvas.style.width  = W+'px'; handleCanvas.style.height = (H+28)+'px';
  if(streamlines) streamlines.resize(W, H);
}
window.addEventListener('resize', resize);

// ── Init sequence ─────────────────────────────────────────────────────
resize();
init3D();
streamlines = new Streamlines(solver, gl, document.createElement('canvas')); // offscreen — we draw particles in 3D

// ── Presets ───────────────────────────────────────────────────────────
let currentPreset = 'gt3';

function applyPreset(key) {
  const p = PRESETS[key]; if(!p) return;
  currentPreset = key;

  solver.u0    = p.u0;
  solver.omega = p.omega;
  solver.angle = p.angle * Math.PI/180;

  // Sync sliders
  setSlider('sl-u0',    p.u0,    'val-u0',    v=>v.toFixed(3));
  setSlider('sl-omega', p.omega, 'val-omega',  v=>v.toFixed(2));
  setSlider('sl-angle', p.angle, 'val-angle',  v=>v+'°');

  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector(`[data-preset="${key}"]`)?.classList.add('active');

  setText('preset-notes', p.notes);
  setText('sb-preset', p.label);
  setText('real-re', p.realRe ? formatRe(p.realRe) : '—');

  solver.clearObstacles();
  if(p.shape) drawShape(p.shape, solver);
  solver.reset();
  forces.reset();
  streamlines._spawnAll();
  if(viewer3D) viewer3D.markObstacleDirty();

  updateRe();
  drawCompass(p.angle);
  updateObsCount();
}

// ── Tool buttons (toolbar + right panel both sync) ────────────────────
function setActiveTool(tool) {
  document.querySelectorAll('[data-tool]').forEach(b=>{
    b.classList.toggle('active', b.dataset.tool===tool);
  });
  draw.setMode(tool);
  setText('sb-tool', 'Tool: '+tool.charAt(0).toUpperCase()+tool.slice(1));
}

document.querySelectorAll('[data-tool]').forEach(btn=>{
  btn.addEventListener('click', ()=>setActiveTool(btn.dataset.tool));
});

// Keyboard shortcuts
window.addEventListener('keydown', e=>{
  if(e.target.tagName==='INPUT') return;
  const map={d:'freehand',l:'line',r:'rect',e:'ellipse',b:'bezier',x:'erase',' ':'pause'};
  if(map[e.key]){
    if(map[e.key]==='pause') togglePause();
    else setActiveTool(map[e.key]);
    e.preventDefault();
  }
});

// ── Viz mode ─────────────────────────────────────────────────────────
function setVizMode(mode) {
  document.querySelectorAll('[data-viz]').forEach(b=>{
    b.classList.toggle('active', parseInt(b.dataset.viz)===mode);
  });
  solver.vizMode = mode;
  updateLegend(mode);
}
document.querySelectorAll('[data-viz]').forEach(btn=>{
  btn.addEventListener('click', ()=>setVizMode(parseInt(btn.dataset.viz)));
});

// ── Bézier ────────────────────────────────────────────────────────────
document.getElementById('btn-bez-commit')?.addEventListener('click', ()=>draw.commitBezier());
document.getElementById('btn-bez-clear')?.addEventListener('click',  ()=>draw.clearBezier());

// ── File import ───────────────────────────────────────────────────────
const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const importStatus = document.getElementById('import-status');
let importAxis = 'xz';

document.querySelectorAll('.axis-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.axis-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); importAxis=btn.dataset.axis;
  });
});

dropZone.addEventListener('click', ()=>fileInput.click());
fileInput.addEventListener('change', e=>handleFile(e.target.files[0]));
dropZone.addEventListener('dragover', e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave', ()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e=>{e.preventDefault();dropZone.classList.remove('drag-over');handleFile(e.dataTransfer.files[0]);});

async function handleFile(file) {
  if(!file) return;
  importStatus.className='import-status';
  importStatus.textContent=`Loading ${file.name}…`;
  try {
    solver.clearObstacles(); solver.reset();
    const count = await importFile(file, solver, importAxis);
    importStatus.textContent=`✓ Imported ${count} triangles`;
    forces.reset(); streamlines._spawnAll();
    if(viewer3D) viewer3D.markObstacleDirty();
    applyPreset('custom');
    updateObsCount();
  } catch(err) {
    importStatus.className='import-status error';
    importStatus.textContent=`✗ ${err.message}`;
  }
}

// ── Sliders ───────────────────────────────────────────────────────────
function setSlider(id, val, labelId, fmt) {
  const el=document.getElementById(id); if(el) el.value=val;
  const lb=document.getElementById(labelId); if(lb) lb.textContent=fmt(val);
}

document.getElementById('sl-omega').addEventListener('input',function(){
  solver.omega=parseFloat(this.value);
  document.getElementById('val-omega').textContent=solver.omega.toFixed(2);
  updateRe();
});
document.getElementById('sl-u0').addEventListener('input',function(){
  solver.u0=parseFloat(this.value);
  document.getElementById('val-u0').textContent=solver.u0.toFixed(3);
  updateRe();
});
document.getElementById('sl-brush').addEventListener('input',function(){
  draw.brushRadius=parseInt(this.value);
  document.getElementById('val-brush').textContent=draw.brushRadius;
});
document.getElementById('sl-smooth').addEventListener('input',function(){
  draw.smoothing=parseFloat(this.value);
  document.getElementById('val-smooth').textContent=parseFloat(this.value).toFixed(1);
});
document.getElementById('sl-angle').addEventListener('input',function(){
  solver.angle=parseFloat(this.value)*Math.PI/180;
  document.getElementById('val-angle').textContent=this.value+'°';
  solver.reset(); drawCompass(parseFloat(this.value));
});
document.getElementById('sl-scale').addEventListener('input',function(){
  solver.vizScale=parseFloat(this.value);
  document.getElementById('val-scale').textContent=parseFloat(this.value).toFixed(2);
});
document.getElementById('sl-spf').addEventListener('input',function(){
  stepsPerFrame=parseInt(this.value);
  document.getElementById('val-spf').textContent=stepsPerFrame;
});
document.getElementById('sl-particles').addEventListener('input',function(){
  streamlines.numParticles=parseInt(this.value);
  streamlines._spawnAll();
});

// ── Action buttons ─────────────────────────────────────────────────────
function doReset(){ solver.reset(); forces.reset(); streamlines._spawnAll(); }
function doRefresh(){ applyPreset(currentPreset); }
function doClear(){ solver.clearObstacles(); solver.reset(); forces.reset(); streamlines._spawnAll(); if(viewer3D) viewer3D.markObstacleDirty(); updateObsCount(); }

['btn-reset','btn-reset2'].forEach(id=>document.getElementById(id)?.addEventListener('click',doReset));
['btn-refresh','btn-refresh2'].forEach(id=>document.getElementById(id)?.addEventListener('click',doRefresh));
['btn-clear-obs','btn-clear-obs2'].forEach(id=>document.getElementById(id)?.addEventListener('click',doClear));

document.getElementById('btn-export')?.addEventListener('click',()=>{
  const a=document.createElement('a');
  a.href=mainCanvas.toDataURL('image/png');
  a.download=`aerosim-${currentPreset}-step${solver.step}.png`;
  a.click();
});

// ── 3D controls ────────────────────────────────────────────────────────
document.getElementById('chk-3d').addEventListener('change',function(){
  use3D=this.checked;
  document.getElementById('vp-mode-label').textContent=use3D?'3D PERSPECTIVE':'2D FLAT';
});

document.getElementById('chk-extrude').addEventListener('change',function(){
  if(viewer3D){ viewer3D.showExtrude=this.checked; }
});

document.getElementById('chk-streamlines').addEventListener('change',function(){
  streamlines.enabled=this.checked;
});

const viewBtns=[
  ['btn-view-persp','btn-view-persp2','tb-view-persp'],
  ['btn-view-top',  'btn-view-top2',  'tb-view-top'],
  ['btn-view-side', 'btn-view-side2', 'tb-view-side'],
  ['btn-view-front','btn-view-front2'],
];

['btn-view-persp','btn-view-persp2','tb-view-persp'].forEach(id=>{
  document.getElementById(id)?.addEventListener('click',()=>{ if(viewer3D) viewer3D.resetCamera(); });
});
['btn-view-top','btn-view-top2','tb-view-top'].forEach(id=>{
  document.getElementById(id)?.addEventListener('click',()=>{ if(viewer3D) viewer3D.topView(); });
});
['btn-view-side','btn-view-side2','tb-view-side'].forEach(id=>{
  document.getElementById(id)?.addEventListener('click',()=>{ if(viewer3D) viewer3D.sideView(); });
});
['btn-view-front','btn-view-front2'].forEach(id=>{
  document.getElementById(id)?.addEventListener('click',()=>{ if(viewer3D) viewer3D.frontView(); });
});

// ── Pause ─────────────────────────────────────────────────────────────
let paused=false;
function togglePause(){
  paused=!paused;
  const dot=document.getElementById('status-dot');
  const txt=document.getElementById('status-text');
  const btn=document.getElementById('btn-pause');
  dot.classList.toggle('live',!paused);
  dot.classList.toggle('paused',paused);
  txt.textContent=paused?'PAUSED':'RUNNING';
  if(btn) btn.title=paused?'Resume (Space)':'Pause (Space)';
}
document.getElementById('btn-pause')?.addEventListener('click',togglePause);
document.getElementById('btn-step')?.addEventListener('click',()=>{
  solver.simulate(1);
});

// ── Stats helpers ──────────────────────────────────────────────────────
function updateRe(){
  const re=lbmRe(solver.u0,solver.omega,80);
  setText('re',re);
}
function updateObsCount(){
  const n=solver.obsCPU.reduce((s,v)=>s+(v>0?1:0),0);
  setText('sb-obs',`Obstacles: ${n.toLocaleString()} cells`);
}
function updateLegend(mode){
  const maps={
    0:{label:'Speed |u|',  min:'0',   max:'fast', grad:'linear-gradient(to right,#050384,#c03d74,#f0f421)'},
    1:{label:'Pressure',   min:'low', max:'high', grad:'linear-gradient(to right,#042db6,#ddd,#c21904)'},
    2:{label:'Vorticity',  min:'−',   max:'+',    grad:'linear-gradient(to right,#042db6,#ddd,#c21904)'},
    3:{label:'Ux stream',  min:'0',   max:'fast', grad:'linear-gradient(to right,#270c52,#1e8f82,#faed24)'},
  };
  const m=maps[mode];
  document.getElementById('legend-bar').style.background=m.grad;
  setText('legend-min',m.min); setText('legend-max',m.max);
  setText('legend-mode',m.label);
}
function updateForces(){
  const cd=forces.Cd, cl=forces.Cl;
  document.getElementById('val-cd').textContent=isFinite(cd)?Math.abs(cd).toFixed(2):'—';
  document.getElementById('val-cl').textContent=isFinite(cl)?cl.toFixed(2):'—';
  document.getElementById('val-cl').style.color=cl<0?'var(--red)':'var(--accent2)';
  const ld=cd!==0?Math.abs(cl/cd):0;
  document.getElementById('val-ld').textContent=isFinite(ld)&&ld>0?ld.toFixed(1):'—';
  document.getElementById('bar-drag').style.width=Math.min(100,Math.abs(cd)*40)+'%';
  document.getElementById('bar-lift').style.width=Math.min(100,Math.abs(cl)*30)+'%';
}

function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent=val; }

// ── Compass ────────────────────────────────────────────────────────────
const compassCtx=document.getElementById('compass-canvas').getContext('2d');
function drawCompass(deg){
  compassCtx.clearRect(0,0,56,56);
  compassCtx.strokeStyle='#1e1e2e'; compassCtx.lineWidth=1.5;
  compassCtx.beginPath(); compassCtx.arc(28,28,24,0,2*Math.PI); compassCtx.stroke();
  // Cardinal labels
  compassCtx.fillStyle='#565f89'; compassCtx.font='7px Arial'; compassCtx.textAlign='center';
  compassCtx.fillText('N',28,8); compassCtx.fillText('S',28,50);
  compassCtx.fillText('W',5,32); compassCtx.fillText('E',51,32);
  // Arrow
  const a=-deg*Math.PI/180;
  compassCtx.strokeStyle='#4a9eff'; compassCtx.lineWidth=2;
  compassCtx.beginPath(); compassCtx.moveTo(28,28);
  compassCtx.lineTo(28+20*Math.cos(a),28+20*Math.sin(a)); compassCtx.stroke();
  document.getElementById('compass-label').textContent=deg+'°';
}
drawCompass(0);

// ── Coords in status bar ───────────────────────────────────────────────
mainCanvas.addEventListener('mousemove', e=>{
  const rect=mainCanvas.getBoundingClientRect();
  const gx=Math.floor((e.clientX-rect.left)/rect.width*GRID_W);
  const gy=Math.floor((1-(e.clientY-rect.top)/rect.height)*GRID_H);
  setText('sb-coords',`x:${gx} y:${gy}`);
});
mainCanvas.addEventListener('mouseleave',()=>{
  setText('sb-coords','x:— y:—');
  tooltip.style.display='none';
});

// ── Main loop ──────────────────────────────────────────────────────────
let stepsPerFrame=4;
let frameCount=0, lastFPS=performance.now();
updateRe(); updateLegend(0);

applyPreset('gt3');

function loop(){
  requestAnimationFrame(loop);

  if(!paused){
    solver.simulate(stepsPerFrame);
    streamlines.update(frameCount);
    forces.update(frameCount);

    if(use3D && viewer3D){
      // 3D mode: render LBM viz to offscreen texture, then draw 3D scene
      solver.renderToFBO(viewer3D.vizFBO, solver.W, solver.H);
      viewer3D.render(streamlines._particles);
    } else {
      // 2D flat mode
      solver.render(mainCanvas.width, mainCanvas.height);
    }
  }

  frameCount++;
  const now=performance.now();
  if(now-lastFPS>500){
    const fps=Math.round(frameCount*1000/(now-lastFPS));
    frameCount=0; lastFPS=now;
    setText('fps',fps);
    setText('step',solver.step.toLocaleString());
    updateForces();
  }
}
loop();
