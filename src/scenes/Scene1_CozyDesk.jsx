import { AbsoluteFill, interpolate } from "remotion";
import { Ball, useBallBounce } from "../Ball";

// Scene 1: Warm cozy living room desk
export const Scene1_CozyDesk = ({ frame, startFrame }) => {
  const W = 1280, H = 720;
  const deskY = 460;
  const ball = useBallBounce({
    frame,
    startFrame,
    deskY,
    enterX: 320,
    exitX: 680,
    ballRadius: 35,
    bounces: 3,
  });

  const opacity = interpolate(frame - startFrame, [0, 10, 95, 108], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Room background */}
      <div style={{ position: "absolute", inset: 0, background: "#3d2b1f" }} />
      {/* Wall */}
      <div
        style={{
          position: "absolute",
          left: 0, top: 0, right: 0,
          height: deskY + 40,
          background: "linear-gradient(180deg, #c9a97a 0%, #b8956a 100%)",
        }}
      />
      {/* Wallpaper pattern - subtle stripes */}
      {[...Array(9)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: i * 145,
            top: 0,
            width: 1,
            height: deskY + 40,
            background: "rgba(180,140,90,0.4)",
          }}
        />
      ))}

      {/* Framed picture on wall */}
      <div
        style={{
          position: "absolute",
          left: 860, top: 120,
          width: 200, height: 150,
          border: "10px solid #5c3d1e",
          background: "linear-gradient(135deg, #e8d5b0, #d4b896)",
          borderRadius: 4,
        }}
      >
        {/* Simple landscape in frame */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"50%", background:"#7a9e5a" }} />
        <div style={{ position:"absolute", top:20, left:30, width:60, height:80, background:"#5a7a3a", clipPath:"polygon(50% 0%, 0% 100%, 100% 100%)" }} />
        <div style={{ position:"absolute", top:10, right:40, width:40, height:60, background:"#4a6a2a", clipPath:"polygon(50% 0%, 0% 100%, 100% 100%)" }} />
        <div style={{ position:"absolute", top:15, left:80, width:28, height:45, background:"#ffd700", borderRadius:"50% 50% 0 0" }} />
      </div>

      {/* Desk surface */}
      <div
        style={{
          position: "absolute",
          left: 80, top: deskY,
          width: W - 160, height: 200,
          background: "linear-gradient(180deg, #8b5e3c 0%, #6b4423 60%, #4a2d12 100%)",
          borderRadius: "4px 4px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
        }}
      />
      {/* Desk front edge highlight */}
      <div
        style={{
          position: "absolute",
          left: 80, top: deskY,
          width: W - 160, height: 8,
          background: "linear-gradient(180deg, #c4835a, #a06040)",
          borderRadius: "4px 4px 0 0",
        }}
      />

      {/* Coffee mug */}
      <div style={{ position: "absolute", left: 200, top: deskY - 70 }}>
        <div style={{ width: 50, height: 65, background: "#e8e0d0", borderRadius: "4px 4px 8px 8px", border: "2px solid #c8b8a0" }} />
        <div style={{ position:"absolute", right:-18, top:15, width:20, height:30, border:"4px solid #c8b8a0", borderLeft:"none", borderRadius:"0 20px 20px 0" }} />
        <div style={{ position:"absolute", top:8, left:6, width:38, height:16, background: "#6b4423", borderRadius:2, opacity:0.6 }} />
        {/* Steam */}
        <div style={{ position:"absolute", top:-20, left:10, width:3, height:18, background:"rgba(255,255,255,0.5)", borderRadius:2, transform:"rotate(-5deg)" }} />
        <div style={{ position:"absolute", top:-24, left:20, width:3, height:22, background:"rgba(255,255,255,0.4)", borderRadius:2, transform:"rotate(5deg)" }} />
        <div style={{ position:"absolute", top:-18, left:32, width:3, height:16, background:"rgba(255,255,255,0.45)", borderRadius:2, transform:"rotate(-3deg)" }} />
      </div>

      {/* Stack of books */}
      <div style={{ position: "absolute", left: 900, top: deskY - 100 }}>
        {[{h:30,c:"#c0392b"},{h:25,c:"#2980b9"},{h:28,c:"#27ae60"}].map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: i * 27,
              left: i * 2,
              width: 80, height: b.h,
              background: b.c,
              borderRadius: 2,
              boxShadow: "2px 2px 4px rgba(0,0,0,0.3)",
            }}
          />
        ))}
      </div>

      {/* Lamp */}
      <div style={{ position: "absolute", left: 1000, top: deskY - 260 }}>
        {/* Base */}
        <div style={{ width: 70, height: 20, background: "#5c3d1e", borderRadius: 4, marginTop: 230 }} />
        {/* Pole */}
        <div style={{ position:"absolute", left:32, top:10, width:6, height:210, background:"#7a5a35" }} />
        {/* Shade */}
        <div style={{ position:"absolute", left:-15, top:0, width:96, height:60, background:"#f0d080", clipPath:"polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)", opacity:0.9 }} />
        {/* Glow */}
        <div style={{ position:"absolute", left:-30, top:50, width:130, height:120, background:"radial-gradient(ellipse, rgba(255,220,100,0.25) 0%, transparent 70%)" }} />
      </div>

      {/* Plant */}
      <div style={{ position: "absolute", left: 140, top: deskY - 130 }}>
        <div style={{ width: 50, height: 55, background: "#c47a3a", borderRadius: "4px 4px 8px 8px" }} />
        {[[-10,-60,40,70],[10,-80,35,65],[-5,-50,30,60],[15,-70,38,72]].map(([x,y,w,h],i)=>(
          <div key={i} style={{ position:"absolute", left:x+10, top:y+90, width:w, height:h, background:"#2d7a2d", borderRadius:"50% 50% 30% 30%", transformOrigin:"bottom center", transform:`rotate(${(i-1.5)*20}deg)` }} />
        ))}
      </div>

      {/* Floor */}
      <div
        style={{
          position: "absolute",
          left: 0, bottom: 0, right: 0,
          height: H - deskY - 200,
          background: "linear-gradient(180deg, #4a2d12, #2a1a08)",
        }}
      />

      {/* Warm light overlay */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 80% 40%, rgba(255,200,80,0.12) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Ball */}
      {ball.visible && (
        <Ball x={ball.x} y={ball.y} scaleX={ball.scaleX} scaleY={ball.scaleY} />
      )}

      {/* Scene label */}
      <div
        style={{
          position: "absolute",
          bottom: 30, left: 50,
          color: "rgba(255,255,255,0.55)",
          fontSize: 22,
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
        }}
      >
        A cozy home
      </div>
    </AbsoluteFill>
  );
};
