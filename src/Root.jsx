import { Composition } from "remotion";
import { MyVideo, TOTAL_FRAMES } from "./MyVideo";

export const RemotionRoot = () => {
  return (
    <Composition
      id="TealBallBounce"
      component={MyVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1280}
      height={720}
    />
  );
};
