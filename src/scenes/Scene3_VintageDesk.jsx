import { AbsoluteFill, interpolate } from "remotion";
import { Ball, useBallBounce } from "../Ball";

// Scene 3: Cluttered vintage/creative home studio desk
export const Scene3_VintageDesk = ({ frame, startFrame }) => {
  const W = 1280, H = 720;
  const deskY = 455;
  const ball = useBallBounce({
    frame,
    startFrame,
    deskY,
    enterX: 280,
    exitX: 700,
    ballRadius: 35,
    bounces: 3,
  });

  const opacity = interpolate(frame - startFrame, [0, 10, 95, 108], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Vintage cream/olive wall */}
      <div style={{ position:"absolute", inset:0, background:"#e8e0c8" }} />
      <div
        style={{
          position:"absolute", left:0, top:0, right:0,
          height:deskY + 30,
          background:"linear-gradient(180deg, #d4c99a 0%, #c8ba88 100%)",
        }}
      />

      {/* Exposed brick patch on wall */}
      {[...Array(6)].map((_, row) =>
        [...Array(5)].map((_, col) => (
          <div
            key={`${row}-${col}`}
            style={{
              position:"absolute",
              left:col*70 + (row % 2 ? 35 : 0) + 650,
              top:row*28 + 100,
              width:64, height:22,
              background:`hsl(${10 + col*3}, ${50+row*4}%, ${45+col*3}%)`,
              borderRadius:2,
              outline:"1px solid rgba(200,180,140,0.5)",
            }}
          />
        ))
      )}

      {/* Vintage world map poster */}
      <div style={{ position:"absolute", left:120, top:80, width:280, height:180, background:"#f0e8d0", border:"3px solid #8b6914", borderRadius:2, overflow:"hidden" }}>
        {/* Simplified map blobs */}
        {[{l:30,t:40,w:60,h:50},{l:110,t:30,w:80,h:70},{l:200,t:50,w:50,h:60},{l:20,t:110,w:70,h:50},{l:120,t:120,w:40,h:30}].map((s,i)=>(
          <div key={i} style={{ position:"absolute", left:s.l, top:s.t, width:s.w, height:s.h, background:"#8fac70", borderRadius:8, opacity:0.7 }} />
        ))}
        <div style={{ position:"absolute", inset:0, background:"#b8d4e8", opacity:0.4, zIndex:-1 }} />
        <div style={{ position:"absolute", bottom:6, left:0, right:0, textAlign:"center", fontSize:10, color:"#5a3e1a", fontFamily:"serif" }}>World Map</div>
      </div>

      {/* Corkboard with sticky notes */}
      <div style={{ position:"absolute", left:440, top:80, width:240, height:160, background:"#c8a87a", borderRadius:4, border:"8px solid #7a5a35" }}>
        {[
          {l:10,t:10,c:"#ffeb3b",r:-3,text:"ideas!"},
          {l:90,t:20,c:"#ff8a65",r:5,text:"call mom"},
          {l:150,t:8,c:"#81c784",r:-2,text:"✓ done"},
          {l:30,t:90,c:"#64b5f6",r:4,text:"buy milk"},
          {l:120,t:85,c:"#f48fb1",r:-6,text:"🎨 art"},
        ].map((n,i)=>(
          <div key={i} style={{ position:"absolute", left:n.l, top:n.t, width:65, height:55, background:n.c, transform:`rotate(${n.r}deg)`, padding:4, boxShadow:"2px 2px 4px rgba(0,0,0,0.2)", fontSize:9, fontFamily:"cursive", color:"#333" }}>
            {n.text}
            <div style={{ position:"absolute", top:2, left:"50%", transform:"translateX(-50%)", width:6, height:6, background:"rgba(200,50,50,0.7)", borderRadius:"50%" }} />
          </div>
        ))}
      </div>

      {/* Desk - dark walnut */}
      <div
        style={{
          position:"absolute", left:40, top:deskY,
          width:W-80, height:220,
          background:"linear-gradient(180deg, #4a3420 0%, #3a2410 70%, #2a1808 100%)",
          borderRadius:"3px 3px 0 0",
          boxShadow:"0 -3px 20px rgba(0,0,0,0.6)",
        }}
      />
      {/* Wood grain lines */}
      {[8,16,28,44,60,80].map(t=>(
        <div key={t} style={{ position:"absolute", left:40, top:deskY+t, width:W-80, height:1, background:"rgba(80,50,20,0.3)" }} />
      ))}
      {/* Edge highlight */}
      <div style={{ position:"absolute", left:40, top:deskY, width:W-80, height:6, background:"#7a5030", borderRadius:"3px 3px 0 0" }} />

      {/* Typewriter */}
      <div style={{ position:"absolute", left:820, top:deskY - 110 }}>
        <div style={{ width:170, height:90, background:"#2a2a2a", borderRadius:"8px 8px 4px 4px", position:"relative" }}>
          <div style={{ position:"absolute", top:8, left:10, right:10, height:35, background:"#1a1a1a", borderRadius:4 }}>
            <div style={{ margin:"6px 4px", height:8, background:"#e8e0d0", borderRadius:2 }} />
          </div>
          {[...Array(3)].map((_,row)=>(
            <div key={row} style={{ display:"flex", gap:3, position:"absolute", bottom:8+row*14, left:8 }}>
              {[...Array(8)].map((_,col)=>(
                <div key={col} style={{ width:14, height:12, background:"#444", borderRadius:2, border:"1px solid #555" }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ width:190, height:14, background:"#1a1a1a", borderRadius:4, marginLeft:-10, marginTop:4 }} />
      </div>

      {/* Pencil holder with pens */}
      <div style={{ position:"absolute", left:200, top:deskY - 90 }}>
        <div style={{ width:44, height:60, background:"#c47a3a", borderRadius:"4px 4px 8px 8px" }} />
        {[{c:"#e74c3c",x:4},{c:"#2c3e50",x:14},{c:"#f39c12",x:24},{c:"#27ae60",x:34}].map((p,i)=>(
          <div key={i} style={{ position:"absolute", left:p.x, bottom:55, width:6, height:50, background:p.c, borderRadius:2, transform:`rotate(${(i-1.5)*8}deg)`, transformOrigin:"bottom center" }} />
        ))}
      </div>

      {/* Old radio */}
      <div style={{ position:"absolute", left:130, top:deskY - 80 }}>
        <div style={{ width:80, height:60, background:"#8b6914", borderRadius:6, border:"2px solid #6b4a08" }}>
          <div style={{ position:"absolute", top:8, left:8, width:40, height:28, background:"#c8a84a", borderRadius:30, border:"2px solid #a08030" }}>
            {[...Array(4)].map((_,i)=>(
              <div key={i} style={{ position:"absolute", top:"50%", left:"50%", width:34-i*8, height:22-i*5, transform:"translate(-50%,-50%)", border:"1px solid rgba(120,90,20,0.4)", borderRadius:20 }} />
            ))}
          </div>
          <div style={{ position:"absolute", right:8, top:8, width:18, height:18, background:"#444", borderRadius:"50%", border:"2px solid #666" }} />
          <div style={{ position:"absolute", right:12, bottom:8, width:12, height:12, background:"#333", borderRadius:"50%" }} />
        </div>
      </div>

      {/* Scattered papers */}
      {[{l:350,r:6},{l:500,r:-4},{l:600,r:3}].map((p,i)=>(
        <div key={i} style={{ position:"absolute", left:p.l, top:deskY - 18, width:110, height:16, background:"#f5f0e0", transform:`rotate(${p.r}deg)`, borderRadius:1, opacity:0.9 }}>
          {[4,8,12].map(t=>(
            <div key={t} style={{ position:"absolute", left:8, top:t, right:8, height:1, background:"#ccc" }} />
          ))}
        </div>
      ))}

      {/* Floor - dark wood */}
      <div style={{ position:"absolute", left:0, bottom:0, right:0, height:H-deskY-220, background:"linear-gradient(180deg, #2a1808,#180e04)" }} />

      {/* Warm lamp glow */}
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 25% 30%, rgba(255,180,60,0.15) 0%, transparent 50%)", pointerEvents:"none" }} />

      {ball.visible && (
        <Ball x={ball.x} y={ball.y} scaleX={ball.scaleX} scaleY={ball.scaleY} />
      )}

      <div
        style={{
          position:"absolute", bottom:30, left:50,
          color:"rgba(200,180,120,0.7)", fontSize:22,
          fontFamily:"Georgia, serif", fontStyle:"italic",
        }}
      >
        A creative home
      </div>
    </AbsoluteFill>
  );
};
