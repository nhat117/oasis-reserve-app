import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadSans } from "@remotion/google-fonts/Outfit";

const { fontFamily: serifFont } = loadFont("normal", { weights: ["300"], subsets: ["latin", "vietnamese"] });
const { fontFamily: sansFont } = loadSans("normal", { weights: ["200", "300"], subsets: ["latin", "vietnamese"] });

export const Scene2: React.FC = () => {
  const frame = useCurrentFrame();

  const imgScale = interpolate(frame, [0, 120], [1.1, 1], { extrapolateRight: "clamp" });
  const imgX = interpolate(frame, [0, 120], [-20, 0], { extrapolateRight: "clamp" });

  const textOp = interpolate(frame, [15, 45], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [15, 45], [25, 0], { extrapolateRight: "clamp" });

  const descOp = interpolate(frame, [35, 65], [0, 1], { extrapolateRight: "clamp" });
  const descY = interpolate(frame, [35, 65], [20, 0], { extrapolateRight: "clamp" });

  const lineW = interpolate(frame, [25, 60], [0, 60], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#1a130c" }}>
      {/* Left image */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", overflow: "hidden" }}>
        <Img
          src={staticFile("images/detail1.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${imgScale}) translateX(${imgX}px)` }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, #1a130c)" }} />
      </div>

      {/* Right text */}
      <div style={{ position: "absolute", right: 100, top: 0, width: "40%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ opacity: textOp, transform: `translateY(${textY}px)` }}>
          <div style={{ fontFamily: sansFont, fontSize: 13, color: "rgba(210,190,165,0.6)", letterSpacing: "0.3em", textTransform: "uppercase", fontWeight: 200, marginBottom: 20 }}>
            Herbal Therapy
          </div>
          <div style={{ fontFamily: serifFont, fontSize: 56, color: "#f5f0e8", fontWeight: 300, lineHeight: 1.15 }}>
            Gội đầu
          </div>
          <div style={{ fontFamily: serifFont, fontSize: 56, color: "#f5f0e8", fontWeight: 300, fontStyle: "italic", lineHeight: 1.15 }}>
            dưỡng sinh
          </div>
        </div>
        <div style={{ width: lineW, height: 1, background: "rgba(210,190,165,0.3)", marginTop: 30, marginBottom: 25 }} />
        <div style={{ opacity: descOp, transform: `translateY(${descY}px)`, fontFamily: sansFont, fontSize: 18, color: "rgba(210,190,165,0.7)", lineHeight: 1.7, fontWeight: 200, maxWidth: 420 }}>
          Phương pháp truyền thống kết hợp thảo dược thiên nhiên, mang đến sự thư giãn sâu cho tâm trí và cơ thể.
        </div>
      </div>
    </AbsoluteFill>
  );
};
