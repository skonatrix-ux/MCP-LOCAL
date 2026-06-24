import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Scene1_CozyDesk } from "./scenes/Scene1_CozyDesk";
import { Scene2_ModernDesk } from "./scenes/Scene2_ModernDesk";
import { Scene3_VintageDesk } from "./scenes/Scene3_VintageDesk";
import { Scene4_Studio } from "./scenes/Scene4_Studio";

// Scene timing (frames at 30fps)
const SCENE_DURATION = 108; // 3.6s per home scene
const OVERLAP = 10;         // crossfade overlap

export const s1Start = 0;
export const s2Start = s1Start + SCENE_DURATION - OVERLAP;
export const s3Start = s2Start + SCENE_DURATION - OVERLAP;
export const s4Start = s3Start + SCENE_DURATION - OVERLAP;
export const TOTAL_FRAMES = s4Start + 140;

// Wrapper that converts Sequence-local frame to absolute frame
const AbsoluteFrameScene = ({ baseFrame, children: SceneComponent }) => {
  const localFrame = useCurrentFrame();
  return <SceneComponent frame={baseFrame + localFrame} startFrame={baseFrame} />;
};

export const MyVideo = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={0} durationInFrames={SCENE_DURATION + OVERLAP}>
        <AbsoluteFrameScene baseFrame={s1Start}>
          {Scene1_CozyDesk}
        </AbsoluteFrameScene>
      </Sequence>

      <Sequence from={s2Start - s1Start} durationInFrames={SCENE_DURATION + OVERLAP}>
        <AbsoluteFrameScene baseFrame={s2Start}>
          {Scene2_ModernDesk}
        </AbsoluteFrameScene>
      </Sequence>

      <Sequence from={s3Start - s1Start} durationInFrames={SCENE_DURATION + OVERLAP}>
        <AbsoluteFrameScene baseFrame={s3Start}>
          {Scene3_VintageDesk}
        </AbsoluteFrameScene>
      </Sequence>

      <Sequence from={s4Start - s1Start} durationInFrames={140}>
        <AbsoluteFrameScene baseFrame={s4Start}>
          {Scene4_Studio}
        </AbsoluteFrameScene>
      </Sequence>
    </AbsoluteFill>
  );
};
