// Drawing tools for the wind tunnel obstacle editor
// Handles: freehand, line, rectangle, ellipse, bezier, eraser

export class DrawingTool {
  constructor(solver, eventCanvas, handleCanvas, tooltip) {
    this.solver = solver;
    this.simCanvas = eventCanvas; // element that receives pointer events (same size as sim)
    this.handleCanvas = handleCanvas;
    this.tooltip = tooltip;

    this.mode = 'freehand';   // freehand|line|rect|ellipse|bezier|erase
    this.brushRadius = 4;     // in grid cells
    this.smoothing = 0.5;     // spline tension 0..1

    this._down = false;
    this._pts  = [];          // collected stroke points
    this._lastPt = null;
    this._bezierPts = [];     // control points for bezier tool
    this._dragHandle = -1;

    this._ctx = handleCanvas.getContext('2d');
    this._bind();
  }

  _bind() {
    const el = this.simCanvas;
    el.addEventListener('mousedown',  e => this._onDown(e));
    el.addEventListener('mousemove',  e => this._onMove(e));
    el.addEventListener('mouseup',    e => this._onUp(e));
    el.addEventListener('mouseleave', e => this._onUp(e));
    el.addEventListener('touchstart', e => { e.preventDefault(); this._onDown(e.touches[0]); }, {passive:false});
    el.addEventListener('touchmove',  e => { e.preventDefault(); this._onMove(e.touches[0]); }, {passive:false});
    el.addEventListener('touchend',   e => { e.preventDefault(); this._onUp(e.changedTouches[0]); }, {passive:false});
  }

  // Canvas pixel → grid cell coordinate
  // simCanvas is actually the event target (canvasWrap div or overlay canvas)
  // We find the WebGL canvas inside it to get the exact rendered bounds
  _toGrid(clientX, clientY) {
    // Use the WebGL sim canvas for pixel-accurate bounds
    const simEl = document.getElementById('sim-canvas');
    const rect = simEl ? simEl.getBoundingClientRect() : this.simCanvas.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width  * this.solver.W;
    const py = (1 - (clientY - rect.top) / rect.height) * this.solver.H;
    return {x: px, y: py};
  }

  _isSolid() {
    return this.mode !== 'erase';
  }

  _onDown(e) {
    this._down = true;
    const g = this._toGrid(e.clientX, e.clientY);

    if(this.mode === 'bezier') {
      // Check if clicking near an existing handle
      let hit = -1;
      for(let i=0;i<this._bezierPts.length;i++){
        const p = this._bezierPts[i];
        const dist = Math.hypot(p.x-g.x, p.y-g.y);
        if(dist < this.brushRadius*2){ hit=i; break; }
      }
      if(hit >= 0){
        this._dragHandle = hit;
      } else {
        this._bezierPts.push({x:g.x, y:g.y});
        this._dragHandle = -1;
        this._redrawHandles();
      }
      return;
    }

    this._pts = [g];
    this._lastPt = g;

    if(this.mode === 'freehand' || this.mode === 'erase'){
      this.solver.paintObstacle(g.x, g.y, this.brushRadius, this._isSolid());
    }
  }

  _onMove(e) {
    const g = this._toGrid(e.clientX, e.clientY);
    this._showTooltip(e.clientX, e.clientY, g);

    if(!this._down) return;

    if(this.mode === 'bezier' && this._dragHandle >= 0) {
      this._bezierPts[this._dragHandle] = g;
      this._redrawHandles();
      this._commitBezier(false);
      return;
    }

    if(this.mode === 'freehand' || this.mode === 'erase') {
      if(this._lastPt) {
        this.solver.paintLine(
          this._lastPt.x, this._lastPt.y,
          g.x, g.y,
          this.brushRadius,
          this._isSolid()
        );
      }
      this._pts.push(g);
      if(this.smoothing > 0 && this._pts.length >= 4) {
        this._smoothFreehand();
      }
    }
    this._lastPt = g;
    this._pts.push(g);
  }

  _onUp(e) {
    if(!this._down) return;
    this._down = false;
    const g = this._toGrid(e.clientX, e.clientY);

    if(this.mode === 'line') {
      if(this._pts.length > 0){
        const start = this._pts[0];
        this.solver.paintLine(start.x, start.y, g.x, g.y, this.brushRadius, true);
      }
    } else if(this.mode === 'rect') {
      if(this._pts.length > 0) this._drawRect(this._pts[0], g);
    } else if(this.mode === 'ellipse') {
      if(this._pts.length > 0) this._drawEllipse(this._pts[0], g);
    }

    this._ctx.clearRect(0,0,this.handleCanvas.width, this.handleCanvas.height);
    this._pts = [];
    this._lastPt = null;
  }

  _showTooltip(cx, cy, g) {
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = (cx+14) + 'px';
    this.tooltip.style.top  = (cy-4)  + 'px';
    this.tooltip.textContent = `x:${Math.floor(g.x)} y:${Math.floor(g.y)} | r:${this.brushRadius}`;
  }

  // Catmull-Rom spline smoothing — re-paints the last portion of the stroke
  _smoothFreehand() {
    const pts = this._pts;
    if(pts.length < 4) return;
    const i = pts.length - 1;
    const p0 = pts[i-3], p1 = pts[i-2], p2 = pts[i-1], p3 = pts[i];
    // Catmull-Rom → Bezier conversion
    const tension = 1 - this.smoothing;
    const steps = 8;
    let prev = p1;
    for(let t=1;t<=steps;t++){
      const s = t/steps;
      const s2=s*s, s3=s2*s;
      const x = 0.5*((2*p1.x) + (-p0.x+p2.x)*s*tension
                     + (2*p0.x-5*p1.x+4*p2.x-p3.x)*s2*tension
                     + (-p0.x+3*p1.x-3*p2.x+p3.x)*s3*tension);
      const y = 0.5*((2*p1.y) + (-p0.y+p2.y)*s*tension
                     + (2*p0.y-5*p1.y+4*p2.y-p3.y)*s2*tension
                     + (-p0.y+3*p1.y-3*p2.y+p3.y)*s3*tension);
      this.solver.paintLine(prev.x, prev.y, x, y, this.brushRadius, true);
      prev = {x,y};
    }
  }

  _drawRect(a, b) {
    const x0=Math.min(a.x,b.x), x1=Math.max(a.x,b.x);
    const y0=Math.min(a.y,b.y), y1=Math.max(a.y,b.y);
    // Outline only
    this.solver.paintLine(x0,y0,x1,y0,this.brushRadius,true);
    this.solver.paintLine(x1,y0,x1,y1,this.brushRadius,true);
    this.solver.paintLine(x1,y1,x0,y1,this.brushRadius,true);
    this.solver.paintLine(x0,y1,x0,y0,this.brushRadius,true);
  }

  _drawEllipse(center, edge) {
    const rx = Math.abs(edge.x - center.x);
    const ry = Math.abs(edge.y - center.y);
    const steps = Math.ceil(2*Math.PI*Math.max(rx,ry));
    let prev = null;
    for(let i=0;i<=steps;i++){
      const t = 2*Math.PI*i/steps;
      const x = center.x + rx*Math.cos(t);
      const y = center.y + ry*Math.sin(t);
      if(prev) this.solver.paintLine(prev.x,prev.y,x,y,this.brushRadius,true);
      prev = {x,y};
    }
  }

  _commitBezier(clear=false) {
    if(this._bezierPts.length < 2) return;
    if(clear) {
      // Do nothing — will redraw next frame
    }
    const pts = this._bezierPts;
    // Draw cubic bezier segments through control points
    for(let i=0;i<pts.length-1;i++){
      const p0 = pts[Math.max(0,i-1)];
      const p1 = pts[i];
      const p2 = pts[i+1];
      const p3 = pts[Math.min(pts.length-1,i+2)];
      this._catmullRomSegment(p0,p1,p2,p3);
    }
  }

  _catmullRomSegment(p0,p1,p2,p3) {
    const steps=20;
    let prev=p1;
    for(let t=1;t<=steps;t++){
      const s=t/steps, s2=s*s, s3=s2*s;
      const x=0.5*((2*p1.x)+(-p0.x+p2.x)*s+(2*p0.x-5*p1.x+4*p2.x-p3.x)*s2+(-p0.x+3*p1.x-3*p2.x+p3.x)*s3);
      const y=0.5*((2*p1.y)+(-p0.y+p2.y)*s+(2*p0.y-5*p1.y+4*p2.y-p3.y)*s2+(-p0.y+3*p1.y-3*p2.y+p3.y)*s3);
      this.solver.paintLine(prev.x,prev.y,x,y,this.brushRadius,true);
      prev={x,y};
    }
  }

  commitBezier() {
    this._commitBezier(true);
    this._bezierPts = [];
    this._redrawHandles();
  }

  clearBezier() {
    this._bezierPts = [];
    this._redrawHandles();
  }

  _redrawHandles() {
    const ctx = this._ctx;
    const W = this.handleCanvas.width, H = this.handleCanvas.height;
    ctx.clearRect(0,0,W,H);
    const pts = this._bezierPts;
    if(pts.length === 0) return;

    const toCanvas = (g) => ({
      x: g.x / this.solver.W * W,
      y: (1 - g.y / this.solver.H) * H
    });

    // Draw connecting lines
    ctx.strokeStyle = '#7aa2f780';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    pts.forEach((p,i) => {
      const c = toCanvas(p);
      if(i===0) ctx.moveTo(c.x,c.y);
      else ctx.lineTo(c.x,c.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw handles
    pts.forEach((p,i) => {
      const c = toCanvas(p);
      ctx.beginPath();
      ctx.arc(c.x,c.y,6,0,2*Math.PI);
      ctx.fillStyle = i===0 ? '#f7768e' : '#7aa2f7';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#c0caf5';
      ctx.font = '9px monospace';
      ctx.fillText(i+1, c.x+8, c.y-4);
    });
  }

  setMode(m) {
    this.mode = m;
    if(m !== 'bezier') {
      this._bezierPts = [];
      this._redrawHandles();
    }
  }
}
