import { Composition } from "remotion";
import { AmbientLoop } from "./AmbientLoop";

const SCENE_DUR = 150;
const FADE_DUR = 30;
const NUM_SCENES = 5;
const TOTAL = NUM_SCENES * (SCENE_DUR - FADE_DUR) + FADE_DUR; // 510 frames = 17s

export const RemotionRoot = () => (
  <Composition
    id="ambient"
    component={AmbientLoop}
    durationInFrames={TOTAL}
    fps={30}
    width={1920}
    height={1080}
  />
);
