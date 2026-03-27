import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/CormorantGaramond";

const { fontFamily: serifFont } = loadFont("normal", { weights: ["300", "400"], subsets: ["latin", "vietnamese"] });

import { loadFont as loadSans } from "@remotion/google-fonts/Outfit";
const { fontFamily: sansFont } = loadSans("normal", { weights: ["300", "400"], subsets: ["latin"] });

export const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgScale = interpolate(frame, [0, 150], [1.15, 1], { extrapolateRight: "clamp" });
  const overlayOp = interpolate(frame, [0, 40], [1, 0.45], { extrapolateRight: "clamp" });

  const logoOp = interpolate(frame, [20, 50], [0, 1], { extrapolateRight: "clamp" });
  const logoY = interpolate(frame, [20, 50], [20, 0], { extrapolateRight: "clamp" });

  const titleOp = interpolate(frame, [40, 75], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [40, 75], [30, 0], { extrapolateRight: "clamp" });

  const subOp = interpolate(frame, [65, 95], [0, 1], { extrapolateRight: "clamp" });

  const lineW = interpolate(frame, [55, 90], [0, 80], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
        <Img src={staticFile("images/hero.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(25,18,10,${overlayOp})` }} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: logoOp, transform: `translateY(${logoY}px)` }}>
          <Img src={staticFile("images/logo.png")} style={{ width: 90, height: 90, objectFit: "contain" }} />
        </div>
        <div style={{ height: 30 }} />
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
          <div style={{ fontFamily: serifFont, fontSize: 80, color: "#f5f0e8", fontWeight: 300, lineHeight: 1.1, letterSpacing: "0.02em" }}>
            A Ritual for
          </div>
          <div style={{ fontFamily: serifFont, fontSize: 80, color: "#f5f0e8", fontWeight: 300, fontStyle: "italic", lineHeight: 1.1 }}>
            the Senses
          </div>
        </div>
        <div style={{ width: lineW, height: 1, background: "rgba(245,240,232,0.4)", marginTop: 30 }} />
        <div style={{ opacity: subOp, marginTop: 20, fontFamily: sansFont, fontSize: 16, color: "rgba(245,240,232,0.6)", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 300 }}>
          Royal Head Spa
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
