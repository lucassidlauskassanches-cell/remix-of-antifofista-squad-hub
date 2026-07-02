import { forwardRef } from "react";
import logoAsset from "@/assets/logo-antifofista.png.asset.json";

type Props = {
  streakDays: number;
  rank: string;
  studentName: string;
  format: "story" | "square";
};

export const StreakMilestoneCard = forwardRef<HTMLDivElement, Props>(
  ({ streakDays, rank, studentName, format }, ref) => {
    const isStory = format === "story";
    const width = 1080;
    const height = isStory ? 1920 : 1080;
    const accent = "#F5C518";

    return (
      <div
        ref={ref}
        style={{
          width,
          height,
          background:
            "radial-gradient(circle at 30% 20%, #1a1a1a 0%, #0a0a0a 60%, #000 100%)",
          color: "#fff",
          fontFamily: "'Anton', 'Impact', sans-serif",
          padding: isStory ? 96 : 72,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 12,
            background: accent,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img
            src={logoAsset.url}
            alt=""
            crossOrigin="anonymous"
            style={{ height: isStory ? 120 : 90, width: "auto" }}
          />
          <div
            style={{
              fontSize: isStory ? 28 : 22,
              letterSpacing: 8,
              color: "#888",
            }}
          >
            ANTIFOFISTA SQUAD
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: isStory ? 40 : 32,
              letterSpacing: 6,
              color: "#888",
              marginBottom: 16,
            }}
          >
            NOVA PATENTE DE GUERRA
          </div>
          <div
            style={{
              fontSize: isStory ? 360 : 280,
              lineHeight: 1,
              color: accent,
              textShadow: `0 0 60px ${accent}55`,
            }}
          >
            {streakDays}
          </div>
          <div
            style={{
              fontSize: isStory ? 44 : 36,
              letterSpacing: 6,
              color: "#ccc",
              marginTop: 8,
            }}
          >
            DIAS DE GUERRA
          </div>
          <div
            style={{
              marginTop: isStory ? 60 : 40,
              padding: isStory ? "24px 40px" : "18px 32px",
              border: `4px solid ${accent}`,
              display: "inline-block",
              fontSize: isStory ? 56 : 44,
              letterSpacing: 4,
            }}
          >
            {rank}
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: isStory ? 32 : 26,
              letterSpacing: 4,
              color: "#fff",
            }}
          >
            {studentName?.toUpperCase() || "SOLDADO"}
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: isStory ? 22 : 18,
              letterSpacing: 6,
              color: "#555",
            }}
          >
            #ANTIFOFISTASQUAD
          </div>
        </div>
      </div>
    );
  },
);
StreakMilestoneCard.displayName = "StreakMilestoneCard";
