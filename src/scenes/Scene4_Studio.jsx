import { AbsoluteFill, interpolate, spring, useVideoConfig } from "remotion";
import { Ball } from "../Ball";

// Scene 4: White studio — ball arcs in and lands on a white screen/cyclorama
export const Scene4_Studio = ({ frame, startFrame }) => {
  const W = 1280, H = 720;
  const { fps } = useVideoConfig();

  const localFrame = frame - startFrame;

  // Ball arcs in from top-left and lands on the white floor
  const floorY = 540;
  const ballRadius = 35;
  const restY = floorY - ballRadius;

  // Entry arc — 30 frames
  const entryDuration = 30;
  // Then 3 small damped bounces
  const bounceDurations = [32, 26, 20];
  const bounceTotalFrames = bounceDurations.reduce((a, b) => a + b, 0);
  const bounceHeights = [90, 40, 16];

  const opacity = interpolate(localFrame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  let ballX, ballY, ballScaleX = 1, ballScaleY = 1;

  if (localFrame < entryDuration) {
    // Arc in from upper-left corner
    const t = localFrame / entryDuration;
    ballX = interpolate(t, [0, 1], [-60, 640]);
    const arcHeight = 220;
    ballY = interpolate(t, [0, 1], [100, restY]) - arcHeight * Math.sin(Math.PI * t);
    ballScaleX = 1;
    ballScaleY = 1;
  } else {
    let bounceFrame = localFrame - entryDuration;
    let accum = 0;
    let bounceIdx = 0;
    let done = false;

    for (let i = 0; i < bounceDurations.length; i++) {
      if (bounceFrame < accum + bounceDurations[i]) {
        bounceIdx = i;
        done = false;
        break;
      }
      accum += bounceDurations[i];
      if (i === bounceDurations.length - 1) done = true;
    }

    if (done) {
      // Settled
      ballX = 640;
      ballY = restY;
      ballScaleX = 1;
      ballScaleY = 1;
    } else {
      const t = (bounceFrame - accum) / bounceDurations[bounceIdx];
      const squishDuration = 0.12;
      ballX = 640;

      if (t < squishDuration) {
        const s = t / squishDuration;
        ballScaleX = interpolate(s, [0, 0.5, 1], [1, 1.5, 1.2]);
        ballScaleY = interpolate(s, [0, 0.5, 1], [1, 0.5, 0.75]);
        ballY = restY;
      } else {
        const arcT = (t - squishDuration) / (1 - squishDuration);
        const parabola = -4 * (arcT - 0.5) ** 2 + 1;
        ballY = restY - bounceHeights[bounceIdx] * parabola;
        ballScaleX = 1;
        ballScaleY = 1;
      }
    }
  }

  // Shadow scale based on height above floor
  const shadowScale = interpolate(ballY, [restY - 300, restY], [0.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Floor shadow (separate from ball component for better look on white)
  const shadowOpacity = interpolate(ballY, [restY - 300, restY], [0.05, 0.18], { extrapolateLeft:"clamp", extrapolateRight:"clamp" });

  // Text fade in after ball settles
  const textOpacity = interpolate(localFrame, [entryDuration + bounceTotalFrames + 10, entryDuration + bounceTotalFrames + 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle studio floor reflection
  const cycloramaBreak = H * 0.72; // where wall meets floor in a cove

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Pure white cyclorama background */}
      <div style={{ position:"absolute", inset:0, background:"#ffffff" }} />

      {/* Subtle cyclorama cove curve — shadow gradient where wall meets floor */}
      <div
        style={{
          position:"absolute", left:0, right:0,
          top: cycloramaBreak - 80,
          height:200,
          background:"radial-gradient(ellipse at 50% 0%, rgba(200,210,220,0.35) 0%, transparent 70%)",
        }}
      />

      {/* Floor — very subtle off-white */}
      <div
        style={{
          position:"absolute", left:0, right:0, bottom:0,
          height: H - cycloramaBreak + 80,
          background:"linear-gradient(180deg, #f8f8f8 0%, #f0f0f0 100%)",
        }}
      />

      {/* Floor reflection of ball */}
      <div
        style={{
          position:"absolute",
          left: ballX - 50,
          top: floorY + 8,
          width:100, height:30,
          borderRadius:"50%",
          background:`rgba(0,180,168,${shadowOpacity * 0.4})`,
          filter:"blur(8px)",
          transform:`scaleX(${shadowScale * ballScaleX})`,
          transformOrigin:"center center",
        }}
      />

      {/* Ball shadow on floor */}
      <div
        style={{
          position:"absolute",
          left: ballX - 44,
          top: floorY + 2,
          width:88, height:20,
          borderRadius:"50%",
          background:`rgba(0,0,0,${shadowOpacity})`,
          filter:"blur(6px)",
          transform:`scaleX(${shadowScale * ballScaleX})`,
          transformOrigin:"center center",
        }}
      />

      {/* The ball */}
      <Ball x={ballX} y={ballY} scaleX={ballScaleX} scaleY={ballScaleY} shadow={false} />

      {/* Studio light rig - top */}
      <div style={{ position:"absolute", top:0, left:240, width:6, height:60, background:"#bbb" }} />
      <div style={{ position:"absolute", top:55, left:214, width:58, height:22, background:"#999", borderRadius:4 }}>
        <div style={{ position:"absolute", inset:2, background:"rgba(255,250,220,0.9)", borderRadius:2, boxShadow:"0 0 20px 6px rgba(255,240,180,0.4)" }} />
      </div>
      <div style={{ position:"absolute", top:0, right:260, width:6, height:60, background:"#bbb" }} />
      <div style={{ position:"absolute", top:55, right:218, width:58, height:22, background:"#999", borderRadius:4 }}>
        <div style={{ position:"absolute", inset:2, background:"rgba(255,250,220,0.9)", borderRadius:2, boxShadow:"0 0 20px 6px rgba(255,240,180,0.4)" }} />
      </div>

      {/* Key light beam */}
      <div
        style={{
          position:"absolute", top:0, left:0, right:0, bottom:0,
          background:"radial-gradient(ellipse at 50% 0%, rgba(255,250,240,0.35) 0%, transparent 60%)",
          pointerEvents:"none",
        }}
      />

      {/* "Made with Remotion" text */}
      <div
        style={{
          position:"absolute",
          bottom:60,
          left:"50%",
          transform:"translateX(-50%)",
          opacity: textOpacity,
          textAlign:"center",
        }}
      >
        <div style={{ fontSize:14, letterSpacing:6, color:"#aaa", fontFamily:"Helvetica, sans-serif", textTransform:"uppercase", marginBottom:8 }}>
          Made with Remotion
        </div>
        <div
          style={{
            width:60, height:3,
            background:"linear-gradient(90deg, transparent, #00d4c8, transparent)",
            margin:"0 auto",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
