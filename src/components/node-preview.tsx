import type { Idea, Connection } from "@/lib/types";

interface NodePreviewProps {
  idea: Idea;
  connections: Connection[];
}

const MAIN_R = 65;
const SAT_R = 12;
const SAT_DIST = 115;
const VIEW_W = 360;
const VIEW_H = 280;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;

function satellitePos(index: number, total: number): { x: number; y: number } {
  const angleDeg = -90 + (360 / total) * index;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + SAT_DIST * Math.cos(rad),
    y: CY + SAT_DIST * Math.sin(rad),
  };
}

export function NodePreview({ idea, connections }: NodePreviewProps) {
  const satellites = connections.slice(0, 3);

  const label = idea.summary.slice(0, 7) + (idea.summary.length > 7 ? "…" : "");

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      style={{ maxHeight: "240px" }}
      aria-hidden="true"
    >
      {/* 接続線 */}
      {satellites.map((_, i) => {
        const pos = satellitePos(i, satellites.length || 1);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={pos.x}
            y2={pos.y}
            stroke="#E0E0E0"
            strokeWidth="0.5"
          />
        );
      })}

      {/* メインノード */}
      <circle cx={CX} cy={CY} r={MAIN_R} fill="#FFFFFF" stroke="#CCCCCC" strokeWidth="1" />
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="13"
        fill="#888888"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {label}
      </text>

      {/* 衛星ノード */}
      {satellites.map((_, i) => {
        const pos = satellitePos(i, satellites.length);
        return (
          <circle
            key={i}
            cx={pos.x}
            cy={pos.y}
            r={SAT_R}
            fill="#FFFFFF"
            stroke="#E0E0E0"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}
