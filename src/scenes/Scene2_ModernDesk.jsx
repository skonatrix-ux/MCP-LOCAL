import { AbsoluteFill, interpolate } from "remotion";
import { Ball, useBallBounce } from "../Ball";

// Scene 2: Modern minimalist home office
export const Scene2_ModernDesk = ({ frame, startFrame }) => {
  const W = 1280, H = 720;
  const deskY = 450;
  const ball = useBallBounce({
    frame,
    startFrame,
    deskY,
    enterX: 400,
    exitX: 760,
    ballRadius: 35,
    bounces: 3,
  });

  const opacity = interpolate(frame - startFrame, [0, 10, 95, 108], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Cool grey wall */}
      <div style={{ position: "absolute", inset: 0, background: "#dde2e8" }} />

      {/* Wall panel accent */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0, right: 0,
          height: deskY + 30,
          background: "linear-gradient(180deg, #eef0f3 0%, #d8dde4 100%)",
        }}
      />

      {/* Horizontal wall stripe */}
      <div
        style={{
          position: "absolute",
          left: 0, top: deskY - 80, right: 0,
          height: 4,
          background: "#b0bac6",
        }}
      />

      {/* Monitor - ultrawide */}
      <div style={{ position: "absolute", left: 460, top: deskY - 310 }}>
        {/* Screen bezel */}
        <div style={{ width: 420, height: 260, background: "#1a1a2e", borderRadius: 8, padding: 8 }}>
          {/* Screen */}
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #0f3460, #16213e)", borderRadius: 4, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ color:"#00d4c8", fontFamily:"monospace", fontSize:13, textAlign:"center" }}>
              <div style={{ opacity:0.7, marginBottom:6 }}>$ npm run dev</div>
              <div style={{ color:"#5fffef" }}>✓ ready in 312ms</div>
            </div>
          </div>
        </div>
        {/* Monitor stand */}
        <div style={{ width:8, height:40, background:"#2a2a3e", margin:"0 auto" }} />
        <div style={{ width:100, height:10, background:"#2a2a3e", borderRadius:4, margin:"0 auto" }} />
      </div>

      {/* Keyboard */}
      <div style={{ position: "absolute", left: 490, top: deskY - 36 }}>
        <div style={{ width: 340, height: 28, background: "#c8cdd6", borderRadius: 4, boxShadow:"0 2px 6px rgba(0,0,0,0.2)" }}>
          {[...Array(4)].map((_, row) => (
            <div key={row} style={{ display:"flex", gap:2, padding:"2px 4px" }}>
              {[...Array(14)].map((_, col) => (
                <div key={col} style={{ flex:1, height:3, background:"#a0a8b4", borderRadius:1 }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Wireless mouse */}
      <div style={{ position:"absolute", left:870, top:deskY - 40 }}>
        <div style={{ width:38, height:58, background:"#b8bfc8", borderRadius:"50% 50% 40% 40%", boxShadow:"2px 2px 6px rgba(0,0,0,0.2)" }}>
          <div style={{ position:"absolute", top:10, left:"50%", transform:"translateX(-50%)", width:1, height:24, background:"#8890a0" }} />
        </div>
      </div>

      {/* Airpods case */}
      <div style={{ position:"absolute", left:880, top:deskY - 52 }}>
        <div style={{ width:46, height:52, background:"white", borderRadius:12, boxShadow:"0 2px 10px rgba(0,0,0,0.15)", border:"1px solid #e0e0e0" }} />
      </div>

      {/* Small succulent */}
      <div style={{ position:"absolute", left:200, top:deskY - 100 }}>
        <div style={{ width:44, height:40, background:"#b87333", borderRadius:"4px 4px 6px 6px" }} />
        {[0,1,2].map(i => (
          <div key={i} style={{ position:"absolute", left:4+i*12, top:-20-i*8, width:16, height:28, background:"#4caf50", borderRadius:"50% 50% 30% 30%", transform:`rotate(${(i-1)*18}deg)`, transformOrigin:"bottom center" }} />
        ))}
      </div>

      {/* Notebook */}
      <div style={{ position:"absolute", left:240, top:deskY - 30 }}>
        <div style={{ width:120, height:22, background:"#f5f5f5", borderRadius:2, border:"1px solid #ddd", transform:"rotate(-4deg)" }}>
          {[6,10,14].map(t => (
            <div key={t} style={{ position:"absolute", left:8, top:t, right:8, height:1, background:"#dde" }} />
          ))}
        </div>
        <div style={{ position:"absolute", left:4, top:2, width:6, height:20, background:"#e74c3c", borderRadius:1, transform:"rotate(-4deg)" }} />
      </div>

      {/* Glass desk surface */}
      <div
        style={{
          position: "absolute",
          left: 60, top: deskY,
          width: W - 120, height: 220,
          background: "linear-gradient(180deg, #b8c4d0 0%, #90a0b0 60%, #6a8098 100%)",
          borderRadius: "2px 2px 0 0",
          boxShadow: "0 -2px 20px rgba(0,0,0,0.3)",
        }}
      />
      {/* Glass sheen */}
      <div
        style={{
          position: "absolute",
          left: 60, top: deskY,
          width: W - 120, height: 6,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.4) 70%, transparent 100%)",
        }}
      />

      {/* Floor */}
      <div
        style={{
          position: "absolute",
          left: 0, bottom: 0, right: 0,
          height: H - deskY - 220,
          background: "#c0c8d4",
        }}
      />

      {/* Subtle floor grid */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ position:"absolute", left:i*220, bottom:0, width:1, height:80, background:"rgba(160,170,184,0.4)" }} />
      ))}

      {/* Ambient light from monitor */}
      <div
        style={{
          position:"absolute", inset:0,
          background:"radial-gradient(ellipse at 55% 40%, rgba(0,180,200,0.08) 0%, transparent 55%)",
          pointerEvents:"none",
        }}
      />

      {ball.visible && (
        <Ball x={ball.x} y={ball.y} scaleX={ball.scaleX} scaleY={ball.scaleY} />
      )}

      <div
        style={{
          position:"absolute", bottom:30, left:50,
          color:"rgba(60,80,100,0.6)", fontSize:22,
          fontFamily:"Helvetica, sans-serif", fontWeight:300, letterSpacing:2,
        }}
      >
        A modern home
      </div>
    </AbsoluteFill>
  );
};
