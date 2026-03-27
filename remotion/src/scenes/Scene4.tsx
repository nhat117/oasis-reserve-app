import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadSans } from "@remotion/google-fonts/Outfit";

const { fontFamily: serifFont } = loadFont("normal", { weights: ["300"], subsets: ["latin", "vietnamese"] });
const { fontFamily: sansFont } = loadSans("normal", { weights: ["200", "300"], subsets: ["latin", "vietnamese"] });

export const Scene4: React.FC = () => {
  const frame = useCurrentFrame();

  const bgScale = interpolate(frame, [0, 150], [1.12, 1], { extrapolateRight: "clamp" });
  const overlayOp = interpolate(frame, [0, 30], [0.8, 0.55], { extrapolateRight: "clamp" });

  const logoOp = interpolate(frame, [15, 45], [0, 1], { extrapolateRight: "clamp" });
  const logoScale = interpolate(frame, [15, 45], [0.8, 1], { extrapolateRight: "clamp" });

  const titleOp = interpolate(frame, [35, 65], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [35, 65], [25, 0], { extrapolateRight: "clamp" });

  const ctaOp = interpolate(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" });

  const fadeOut = interpolate(frame, [110, 140], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${bgScale})` }}>
        <Img src={staticFile("images/hero.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(25,18,10,${overlayOp})` }} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
        <div style={{ opacity: logoOp, transform: `scale(${logoScale})` }}>
          <Img src={staticFile("images/logo.png")} style={{ width: 70, height: 70, objectFit: "contain" }} />
        </div>
        <div style={{ height: 25 }} />
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, textAlign: "center" }}>
          <div style={{ fontFamily: serifFont, fontSize: 64, color: "#f5f0e8", fontWeight: 300, lineHeight: 1.15, fontStyle: "italic" }}>
            Book Your Experience
          </div>
        </div>
        <div style={{ height: 30 }} />
        <div style={{ opacity: ctaOp, fontFamily: sansFont, fontSize: 14, color: "rgba(210,190,165,0.7)", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 200 }}>
          Royal Head Spa
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
