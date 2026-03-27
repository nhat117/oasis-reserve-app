import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile, Sequence } from "remotion";

const scenes = [
  { src: "images/headspa.png", startX: 0, endX: -40, startY: 0, endY: -20, startScale: 1.15, endScale: 1.05 },
  { src: "images/detail1.jpg", startX: -30, endX: 10, startY: -10, endY: 10, startScale: 1.1, endScale: 1.02 },
  { src: "images/hero.jpg", startX: 20, endX: -20, startY: 10, endY: -10, startScale: 1.12, endScale: 1 },
  { src: "images/detail2.jpg", startX: -20, endX: 20, startY: 0, endY: -15, startScale: 1.08, endScale: 1.02 },
  { src: "images/headspa.png", startX: 10, endX: -30, startY: -15, endY: 5, startScale: 1.1, endScale: 1 },
];

const SCENE_DUR = 150; // 5s each
const FADE_DUR = 30;

const Scene: React.FC<{ scene: typeof scenes[0] }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const progress = frame / SCENE_DUR;

  const x = interpolate(progress, [0, 1], [scene.startX, scene.endX]);
  const y = interpolate(progress, [0, 1], [scene.startY, scene.endY]);
  const scale = interpolate(progress, [0, 1], [scene.startScale, scene.endScale]);

  const fadeIn = interpolate(frame, [0, FADE_DUR], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [SCENE_DUR - FADE_DUR, SCENE_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={staticFile(scene.src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
        }}
      />
      {/* Warm overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(30,20,10,0.15)" }} />
    </AbsoluteFill>
  );
};

export const AmbientLoop: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#1a130c" }}>
      {scenes.map((scene, i) => (
        <Sequence key={i} from={i * (SCENE_DUR - FADE_DUR)} durationInFrames={SCENE_DUR}>
          <Scene scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
