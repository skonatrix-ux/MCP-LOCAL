// OBJ and STL importer — projects 3D geometry to 2D side-view silhouette
// then rasterizes into the LBM obstacle grid

// ── OBJ parser ────────────────────────────────────────────────────────
function parseOBJ(text) {
  const verts = [], faces = [];
  for(const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if(parts[0] === 'v') {
      verts.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if(parts[0] === 'f') {
      // Face indices (1-based, may have /uv/normal suffixes)
      const idx = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
      // Triangulate if polygon
      for(let i=1;i<idx.length-1;i++)
        faces.push([idx[0], idx[i], idx[i+1]]);
    }
  }
  return {verts, faces};
}

// ── STL parser (binary and ASCII) ────────────────────────────────────
function parseSTL(buffer) {
  const verts = [], faces = [];

  // Try ASCII
  const text = new TextDecoder().decode(buffer.slice(0, 256));
  if(text.trimStart().startsWith('solid')) {
    const full = new TextDecoder().decode(buffer);
    const vertRe = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g;
    let m, tri = [];
    while((m = vertRe.exec(full)) !== null) {
      verts.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
      tri.push(verts.length-1);
      if(tri.length === 3) { faces.push([...tri]); tri = []; }
    }
  } else {
    // Binary STL: 80-byte header, 4-byte count, 50-byte triangles
    const view = new DataView(buffer);
    const count = view.getUint32(80, true);
    let off = 84;
    for(let i=0;i<count;i++, off+=50) {
      const base = verts.length;
      for(let j=0;j<3;j++) {
        verts.push([
          view.getFloat32(off+12+j*12, true),
          view.getFloat32(off+16+j*12, true),
          view.getFloat32(off+20+j*12, true),
        ]);
      }
      faces.push([base, base+1, base+2]);
      off += 2; // attribute byte count
    }
  }
  return {verts, faces};
}

// ── Project 3D mesh to 2D silhouette (side view: X→right, Z→up) ─────
// Returns array of 2D triangles [{ax,ay, bx,by, cx,cy}]
function projectSideView(verts, faces, axis='xz') {
  return faces.map(([i,j,k]) => {
    const get2D = v => {
      if(axis === 'xz') return {x: v[0], y: v[2]};
      if(axis === 'xy') return {x: v[0], y: v[1]};
      return {x: v[2], y: v[1]};
    };
    return [get2D(verts[i]), get2D(verts[j]), get2D(verts[k])];
  });
}

// ── Rasterize 2D triangles into the obstacle grid ────────────────────
// tris: array of [{x,y},{x,y},{x,y}] in model space
// Maps model bbox → grid with padding
function rasterizeToGrid(tris, grid, margin=0.05) {
  const W = grid.W, H = grid.H;
  if(tris.length === 0) return;

  // Compute bounding box
  let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  for(const [a,b,c] of tris) {
    for(const p of [a,b,c]) {
      minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x);
      minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y);
    }
  }

  const mW = maxX-minX, mH = maxY-minY;
  // Fit into grid with margin, centered vertically, placed at 20% from left
  const fitW = W * (1 - 0.25 - margin*2);
  const fitH = H * (1 - margin*2);
  const scale = Math.min(fitW/mW, fitH/mH) * 0.85;
  const offX = W * 0.22 - (minX + mW/2) * scale + W*0.01;
  const offY = H * 0.5  - (minY + mH/2) * scale;

  const toGrid = (p) => ({
    x: p.x * scale + offX,
    y: p.y * scale + offY,
  });

  // Clear existing obstacles
  grid.obsCPU.fill(0);

  // Rasterize each triangle
  for(const [a,b,c] of tris) {
    const ga = toGrid(a), gb = toGrid(b), gc = toGrid(c);
    rasterizeTri(ga, gb, gc, grid.obsCPU, W, H);
  }

  grid._uploadObs();
}

function rasterizeTri(a, b, c, buf, W, H) {
  // Bounding box
  const x0 = Math.max(0,  Math.floor(Math.min(a.x,b.x,c.x)));
  const x1 = Math.min(W-1,Math.ceil( Math.max(a.x,b.x,c.x)));
  const y0 = Math.max(0,  Math.floor(Math.min(a.y,b.y,c.y)));
  const y1 = Math.min(H-1,Math.ceil( Math.max(a.y,b.y,c.y)));

  for(let y=y0;y<=y1;y++){
    for(let x=x0;x<=x1;x++){
      if(pointInTri(x+0.5, y+0.5, a, b, c))
        buf[y*W+x] = 255;
    }
  }
}

function sign(px,py, ax,ay, bx,by) {
  return (px-bx)*(ay-by) - (ax-bx)*(py-by);
}

function pointInTri(px, py, a, b, c) {
  const d1 = sign(px,py,a.x,a.y,b.x,b.y);
  const d2 = sign(px,py,b.x,b.y,c.x,c.y);
  const d3 = sign(px,py,c.x,c.y,a.x,a.y);
  const hasNeg = (d1<0)||(d2<0)||(d3<0);
  const hasPos = (d1>0)||(d2>0)||(d3>0);
  return !(hasNeg && hasPos);
}

// ── Public API ────────────────────────────────────────────────────────
export async function importFile(file, solver, axis='xz') {
  const ext = file.name.split('.').pop().toLowerCase();
  let tris;

  if(ext === 'obj') {
    const text = await file.text();
    const {verts, faces} = parseOBJ(text);
    tris = projectSideView(verts, faces, axis);
  } else if(ext === 'stl') {
    const buf = await file.arrayBuffer();
    const {verts, faces} = parseSTL(buf);
    tris = projectSideView(verts, faces, axis);
  } else {
    throw new Error(`Unsupported format: .${ext}. Use OBJ or STL.`);
  }

  rasterizeToGrid(tris, solver);
  return tris.length;
}

// ── Built-in shape generators ─────────────────────────────────────────
export function drawShape(name, solver) {
  const W = solver.W, H = solver.H;
  solver.obsCPU.fill(0);

  const painters = { drawGT3, drawF1, drawAirfoilNACA2412, drawAirfoilNACA0012 };
  const fn = painters[{
    gt3: 'drawGT3',
    f1:  'drawF1',
    airfoil_naca2412: 'drawAirfoilNACA2412',
    airfoil_naca2412_flap: 'drawAirfoilNACA2412',
    airfoil_naca0012: 'drawAirfoilNACA0012',
  }[name]];

  if(fn) painters[fn](solver, W, H);
  solver._uploadObs();
}

function drawGT3(solver, W, H) {
  // Low-slung GT3 coupe with wide splitter, rear wing, diffuser
  const cx = W*0.42, cy = H*0.44;
  const carW = W*0.33, carH = H*0.13;
  const r = 3;

  // Main body outline (filled)
  const bodyPts = [
    // Bottom (floor)
    {x: cx - carW*0.50, y: cy - carH*0.52},
    {x: cx + carW*0.50, y: cy - carH*0.52},
    // Front nose (steep)
    {x: cx + carW*0.50, y: cy - carH*0.15},
    // Windscreen
    {x: cx + carW*0.28, y: cy + carH*0.48},
    // Roofline
    {x: cx - carW*0.10, y: cy + carH*0.55},
    // Rear screen
    {x: cx - carW*0.32, y: cy + carH*0.35},
    // Rear deck
    {x: cx - carW*0.48, y: cy + carH*0.10},
    // Rear
    {x: cx - carW*0.50, y: cy - carH*0.10},
  ];
  paintPoly(solver, bodyPts, r);

  // Splitter (extends ahead of nose)
  solver.paintLine(cx+carW*0.50, cy-carH*0.52, cx+carW*0.68, cy-carH*0.52, r, true);

  // Rear wing (horizontal element + two endplates)
  const wingY = cy + carH*0.72;
  const wingL = cx - carW*0.52, wingR = cx - carW*0.28;
  solver.paintLine(wingL, wingY, wingR, wingY, r+1, true);
  solver.paintLine(wingL, cy+carH*0.10, wingL, wingY, r, true);
  solver.paintLine(wingR, cy+carH*0.35, wingR, wingY, r, true);

  // Diffuser (angled underfloor at rear)
  solver.paintLine(cx-carW*0.38, cy-carH*0.52, cx-carW*0.50, cy-carH*0.30, r+1, true);

  // Wheels (front + rear)
  const wheelR = carH*0.28;
  solver.paintObstacle(cx + carW*0.36, cy - carH*0.52 - wheelR*0.5, wheelR, true);
  solver.paintObstacle(cx - carW*0.34, cy - carH*0.52 - wheelR*0.5, wheelR, true);
}

function drawF1(solver, W, H) {
  // Formula 1: narrow, low, big front wing, tiny cockpit, beam wing
  const cx = W*0.42, cy = H*0.46;
  const carW = W*0.35, carH = H*0.09;
  const r = 2;

  // Chassis (narrow monocoque)
  const body = [
    {x: cx - carW*0.50, y: cy - carH*0.50},
    {x: cx + carW*0.50, y: cy - carH*0.50},
    {x: cx + carW*0.50, y: cy + carH*0.30},
    {x: cx + carW*0.20, y: cy + carH*0.60}, // nose cone tip rises
    {x: cx - carW*0.05, y: cy + carH*0.80}, // cockpit
    {x: cx - carW*0.25, y: cy + carH*0.55},
    {x: cx - carW*0.50, y: cy + carH*0.20},
  ];
  paintPoly(solver, body, r);

  // Front wing (multi-element, extends forward)
  const fwY = cy - carH*0.50;
  solver.paintLine(cx+carW*0.50, fwY, cx+carW*0.90, fwY, r+2, true);
  solver.paintLine(cx+carW*0.50, fwY+carH*0.25, cx+carW*0.88, fwY+carH*0.25, r+1, true);
  // Front wing endplates
  solver.paintLine(cx+carW*0.88, fwY, cx+carW*0.90, fwY+carH*0.40, r, true);

  // Rear wing (large, generates massive downforce)
  const rwY = cy + carH*0.90;
  const rwL = cx - carW*0.52, rwR = cx - carW*0.18;
  solver.paintLine(rwL, rwY, rwR, rwY, r+2, true);
  solver.paintLine(rwL, rwY-carH*0.20, rwR, rwY-carH*0.20, r+1, true);
  solver.paintLine(rwL, cy+carH*0.20, rwL, rwY, r, true);
  solver.paintLine(rwR, cy+carH*0.55, rwR, rwY, r, true);

  // Diffuser
  solver.paintLine(cx-carW*0.30, cy-carH*0.50, cx-carW*0.50, cy, r+1, true);

  // Wheels (open-wheel, much larger)
  const wheelR = carH*0.55;
  solver.paintObstacle(cx + carW*0.60, cy - carH*0.50 - wheelR*0.4, wheelR, true);
  solver.paintObstacle(cx - carW*0.45, cy - carH*0.50 - wheelR*0.4, wheelR, true);

  // Halo (cockpit protection)
  solver.paintLine(cx-carW*0.08, cy+carH*1.1, cx+carW*0.12, cy+carH*1.1, r+1, true);
}

// NACA 4-digit airfoil generator
function naca4(code, chord, cx, cy, numPts=80) {
  const m = parseInt(code[0])/100;
  const p = parseInt(code[1])/10;
  const t = parseInt(code.slice(2))/100;

  const pts = [];
  for(let i=0;i<=numPts;i++){
    const x = i/numPts;
    const yt = 5*t*(0.2969*Math.sqrt(x) - 0.1260*x - 0.3516*x**2 + 0.2843*x**3 - 0.1015*x**4);
    let yc, dyc;
    if(x < p) {
      yc = m/p**2 * (2*p*x - x**2);
      dyc = 2*m/p**2 * (p-x);
    } else {
      yc = m/(1-p)**2 * (1 - 2*p + 2*p*x - x**2);
      dyc = 2*m/(1-p)**2 * (p-x);
    }
    const theta = Math.atan(dyc);
    pts.push({
      xu: (x - yt*Math.sin(theta)) * chord + cx,
      yu: (yc + yt*Math.cos(theta)) * chord + cy,
      xl: (x + yt*Math.sin(theta)) * chord + cx,
      yl: (yc - yt*Math.cos(theta)) * chord + cy,
    });
  }
  return pts;
}

function drawAirfoilNACA2412(solver, W, H) {
  const chord = W * 0.45;
  const cx = W * 0.20, cy = H * 0.50 - chord*0.05;
  const pts = naca4('2412', chord, cx, cy, 100);
  const r = 2;

  // Draw upper and lower surface
  for(let i=0;i<pts.length-1;i++){
    solver.paintLine(pts[i].xu, pts[i].yu, pts[i+1].xu, pts[i+1].yu, r, true);
    solver.paintLine(pts[i].xl, pts[i].yl, pts[i+1].xl, pts[i+1].yl, r, true);
  }
  // Fill the interior
  for(let i=0;i<pts.length;i++){
    solver.paintLine(pts[i].xu, pts[i].yu, pts[i].xl, pts[i].yl, r, true);
  }
}

function drawAirfoilNACA0012(solver, W, H) {
  const chord = W * 0.45;
  const cx = W * 0.20, cy = H * 0.50;
  const pts = naca4('0012', chord, cx, cy, 100);
  const r = 2;
  for(let i=0;i<pts.length-1;i++){
    solver.paintLine(pts[i].xu, pts[i].yu, pts[i+1].xu, pts[i+1].yu, r, true);
    solver.paintLine(pts[i].xl, pts[i].yl, pts[i+1].xl, pts[i+1].yl, r, true);
  }
  for(let i=0;i<pts.length;i++){
    solver.paintLine(pts[i].xu, pts[i].yu, pts[i].xl, pts[i].yl, r, true);
  }
}

// Fill a polygon outline (approximated by line segments)
function paintPoly(solver, pts, r) {
  for(let i=0;i<pts.length;i++){
    const a = pts[i], b = pts[(i+1)%pts.length];
    solver.paintLine(a.x, a.y, b.x, b.y, r, true);
  }
  // Flood-fill interior using scanline on the CPU grid
  fillPolygon(solver, pts);
}

function fillPolygon(solver, pts) {
  const W = solver.W, H = solver.H;
  // Scanline fill
  const minY = Math.max(0, Math.floor(Math.min(...pts.map(p=>p.y))));
  const maxY = Math.min(H-1, Math.ceil(Math.max(...pts.map(p=>p.y))));

  for(let y=minY;y<=maxY;y++){
    const intersections = [];
    for(let i=0;i<pts.length;i++){
      const a = pts[i], b = pts[(i+1)%pts.length];
      if((a.y<=y && b.y>y) || (b.y<=y && a.y>y)){
        const x = a.x + (y - a.y)/(b.y - a.y)*(b.x - a.x);
        intersections.push(x);
      }
    }
    intersections.sort((a,b)=>a-b);
    for(let i=0;i<intersections.length-1;i+=2){
      const x0=Math.max(0,Math.floor(intersections[i]));
      const x1=Math.min(W-1,Math.ceil(intersections[i+1]));
      for(let x=x0;x<=x1;x++) solver.obsCPU[y*W+x]=255;
    }
  }
}
