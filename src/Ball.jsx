import { interpolate } from "remotion";

export const Ball = ({ x, y, scaleX = 1, scaleY = 1, size = 70, shadow = true }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: `scaleX(${scaleX}) scaleY(${scaleY})`,
        transformOrigin: "center bottom",
      }}
    >
      {/* Ball */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #5fffef, #00b4a6 50%, #007a70)",
          boxShadow: "inset -6px -6px 14px rgba(0,0,0,0.25), inset 4px 4px 10px rgba(255,255,255,0.3)",
        }}
      />
      {/* Glare */}
      <div
        style={{
          position: "absolute",
          top: "14%",
          left: "22%",
          width: "28%",
          height: "18%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.55)",
          transform: "rotate(-30deg)",
        }}
      />
      {/* Shadow on desk */}
      {shadow && (
        <div
          style={{
            position: "absolute",
            bottom: -12,
            left: "50%",
            transform: "translateX(-50%)",
            width: size * scaleX * 0.9,
            height: 10,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.25)",
            filter: "blur(4px)",
          }}
        />
      )}
    </div>
  );
};

// Physics: ball bouncing on a surface
// Returns {x, y, scaleX, scaleY} given frame within a bounce sequence
export const useBallBounce = ({
  frame,
  startFrame,
  deskY,        // Y position of desk surface (ball center at rest = deskY - ballRadius)
  enterX,       // X where ball enters
  exitX,        // X where ball exits
  ballRadius = 35,
  bounces = 3,
}) => {
  const localFrame = frame - startFrame;
  const restY = deskY - ballRadius;

  // Each bounce: fall + squish + rise
  const bounceDuration = 28;
  const totalBounceDuration = bounces * bounceDuration;

  // Entry fall: frames 0-20
  const entryDuration = 20;

  if (localFrame < 0) return { x: enterX, y: -ballRadius, scaleX: 1, scaleY: 1, visible: false };

  if (localFrame < entryDuration) {
    // Free fall from above
    const t = localFrame / entryDuration;
    const y = interpolate(t * t, [0, 1], [-80, restY]);
    return { x: enterX, y, scaleX: 1, scaleY: 1, visible: true };
  }

  if (localFrame < entryDuration + totalBounceDuration) {
    const bounceFrame = localFrame - entryDuration;
    const bounceIndex = Math.floor(bounceFrame / bounceDuration);
    const t = (bounceFrame % bounceDuration) / bounceDuration;

    // Height decreases each bounce
    const maxHeight = ballRadius * 2.2 * Math.pow(0.55, bounceIndex);
    const squishDuration = 0.12;

    let y, scaleX, scaleY;

    if (t < squishDuration) {
      // Squish on impact
      const s = t / squishDuration;
      scaleX = interpolate(s, [0, 0.5, 1], [1, 1.5, 1.2]);
      scaleY = interpolate(s, [0, 0.5, 1], [1, 0.55, 0.8]);
      y = restY;
    } else {
      // Parabolic arc up and down
      const arcT = (t - squishDuration) / (1 - squishDuration);
      const parabola = -4 * (arcT - 0.5) ** 2 + 1; // peaks at t=0.5
      y = restY - maxHeight * parabola;
      scaleX = 1;
      scaleY = 1;
    }

    // Drift X slightly across the desk
    const xProgress = (localFrame - entryDuration) / totalBounceDuration;
    const x = interpolate(xProgress, [0, 1], [enterX, exitX]);

    return { x, y, scaleX, scaleY, visible: true };
  }

  // Exit — fly off to the right/down
  const exitFrame = localFrame - entryDuration - totalBounceDuration;
  const exitDuration = 18;
  if (exitFrame < exitDuration) {
    const t = exitFrame / exitDuration;
    const x = interpolate(t, [0, 1], [exitX, exitX + 120]);
    const y = interpolate(t * t, [0, 1], [restY, restY - 60]);
    return { x, y, scaleX: 1, scaleY: 1, visible: true };
  }

  return { x: exitX + 140, y: restY - 80, scaleX: 1, scaleY: 1, visible: false };
};
