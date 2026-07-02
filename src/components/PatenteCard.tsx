import { forwardRef } from "react";
import logoAsset from "@/assets/logo-antifofista.png.asset.json";

export type PatenteInfo = {
  rank: string;
  message: string;
  accent: string; // hex color
};

export function getPatente(score: number): PatenteInfo {
  if (score >= 100)
    return {
      rank: "REI DOS ANTIFOFISTAS",
      message: "100% dentro do plano. Mais um dia cumprido.",
      accent: "#F5C518",
    };
  if (score >= 75)
    return {
      rank: "VERDADEIRO ANTIFOFISTA",
      message: "Consistência é o caminho. Segue firme.",
      accent: "#E6A700",
    };
  if (score >= 50)
    return {
      rank: "ANTIFOFISTA",
      message: "Você está no jogo. Amanhã sobe mais.",
      accent: "#D08700",
    };
  return {
    rank: "QUASE UM ANTIFOFISTA",
    message: "Amanhã o jogo é seu. Volta com fome.",
    accent: "#B87500",
  };
}

type Props = {
  score: number;
  date: string; // yyyy-mm-dd
  studentName: string;
  format: "story" | "square";
};

export const PatenteCard = forwardRef<HTMLDivElement, Props>(
  ({ score, date, studentName, format }, ref) => {
    const p = getPatente(score);
    const isStory = format === "story";
    const width = isStory ? 1080 : 1080;
    const height = isStory ? 1920 : 1080;

    // pt-BR date
    const dateBR = (() => {
      const [y, m, d] = date.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    })();

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
        {/* accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 12,
            background: p.accent,
          }}
        />

        {/* top */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img
            src={logoAsset.url}
            alt=""
            crossOrigin="anonymous"
            style={{ height: isStory ? 120 : 90, width: "auto" }}
          />
          <div>
            <div
              style={{
                fontSize: isStory ? 28 : 22,
                letterSpacing: 8,
                color: "#888",
              }}
            >
              ANTIFOFISTA SQUAD
            </div>
            <div
              style={{
                fontSize: isStory ? 22 : 18,
                letterSpacing: 4,
                color: "#666",
                marginTop: 4,
              }}
            >
              {dateBR.toUpperCase()}
            </div>
          </div>
        </div>

        {/* middle */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: isStory ? 40 : 32,
              letterSpacing: 6,
              color: "#888",
              marginBottom: 24,
            }}
          >
            SCORE DO DIA
          </div>
          <div
            style={{
              fontSize: isStory ? 320 : 260,
              lineHeight: 1,
              color: p.accent,
              textShadow: `0 0 60px ${p.accent}55`,
            }}
          >
            {Math.round(score)}
            <span
              style={{
                fontSize: isStory ? 100 : 80,
                color: "#fff",
                marginLeft: 8,
              }}
            >
              %
            </span>
          </div>
          <div
            style={{
              marginTop: isStory ? 60 : 40,
              padding: isStory ? "24px 40px" : "18px 32px",
              border: `4px solid ${p.accent}`,
              display: "inline-block",
              fontSize: isStory ? 56 : 44,
              letterSpacing: 4,
            }}
          >
            {p.rank}
          </div>
          <div
            style={{
              marginTop: 40,
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: isStory ? 32 : 26,
              color: "#ccc",
              maxWidth: isStory ? 800 : 700,
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.4,
            }}
          >
            {p.message}
          </div>
        </div>

        {/* bottom */}
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
PatenteCard.displayName = "PatenteCard";
