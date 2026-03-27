import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadSans } from "@remotion/google-fonts/Outfit";

const { fontFamily: serifFont } = loadFont("normal", { weights: ["300"], subsets: ["latin", "vietnamese"] });
const { fontFamily: sansFont } = loadSans("normal", { weights: ["200", "300"], subsets: ["latin", "vietnamese"] });

export const Scene3: React.FC = () => {
  const frame = useCurrentFrame();

  const imgScale = interpolate(frame, [0, 120], [1.08, 1], { extrapolateRight: "clamp" });

  const textOp = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [10, 40], [25, 0], { extrapolateRight: "clamp" });

  const descOp = interpolate(frame, [30, 60], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#1a130c" }}>
      {/* Right image */}
      <div style={{ position: "absolute", right: 0, top: 0, width: "55%", height: "100%", overflow: "hidden" }}>
        <Img
          src={staticFile("images/detail2.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${imgScale})` }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to left, transparent 60%, #1a130c)" }} />
      </div>

      {/* Left text */}
      <div style={{ position: "absolute", left: 100, top: 0, width: "38%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ opacity: textOp, transform: `translateY(${textY}px)` }}>
          <div style={{ fontFamily: sansFont, fontSize: 13, color: "rgba(210,190,165,0.6)", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 200, marginBottom: 20 }}>
            Nail Artistry
          </div>
          <div style={{ fontFamily: serifFont, fontSize: 56, color: "#f5f0e8", fontWeight: 300, lineHeight: 1.15 }}>
            Nghệ thuật
          </div>
          <div style={{ fontFamily: serifFont, fontSize: 56, color: "#f5f0e8", fontWeight: 300, fontStyle: "italic", lineHeight: 1.15 }}>
            chăm sóc
          </div>
        </div>
        <div style={{ width: interpolate(frame, [20, 55], [0, 60], { extrapolateRight: "clamp" }), height: 1, background: "rgba(210,190,165,0.3)", marginTop: 30, marginBottom: 25 }} />
        <div style={{ opacity: descOp, fontFamily: sansFont, fontSize: 18, color: "rgba(210,190,165,0.7)", lineHeight: 1.7, fontWeight: 200, maxWidth: 420 }}>
          Mỗi chi tiết được chăm chút tỉ mỉ, từ đôi bàn tay khéo léo đến không gian yên bình.
        </div>
      </div>
    </AbsoluteFill>
  );
};
