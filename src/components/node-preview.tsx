import type { Idea } from "@/lib/types";

interface NodePreviewProps {
  idea: Idea;
  allIdeas: Idea[];
}

const VIEW_W = 360;
const VIEW_H = 280;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const MAIN_R = 50;
const SAT_R = 16;
const SAT_DIST = 115;

function satellitePos(index: number, total: number): { x: number; y: number } {
  const angleDeg = -90 + (360 / total) * index;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + SAT_DIST * Math.cos(rad),
    y: CY + SAT_DIST * Math.sin(rad),
  };
}

export function NodePreview({ idea, allIdeas }: NodePreviewProps) {
  const mainTag = idea.tags[0] ?? "";

  // 同タグのアイデアを取得（メイン以外、最大3件）
  const tagSiblings = allIdeas
    .filter((i) => i.id !== idea.id && i.tags.includes(mainTag))
    .slice(0, 3);

  const satellites = tagSiblings.map((sibling, i) => ({
    label: sibling.graph_label || sibling.summary.slice(0, 5),
    pos: satellitePos(i, Math.max(tagSiblings.length, 1)),
  }));

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" style={{ maxWidth: 360 }} aria-hidden="true">
      {/* タグ名 */}
      <text x="20" y="24" fontSize="11" fill="var(--text-hint)"
        fontFamily="'JetBrains Mono', ui-monospace, monospace">
        {mainTag}
      </text>

      {/* 接続線 */}
      {satellites.map((sat, i) => (
        <line key={`l-${i}`} x1={CX} y1={CY} x2={sat.pos.x} y2={sat.pos.y}
          stroke="var(--border)" strokeWidth="0.5" />
      ))}

      {/* メインノード */}
      <circle cx={CX} cy={CY} r={MAIN_R} fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth="1" />
      <text x={CX} y={CY} textAnchor="middle" dominantBaseline="central"
        fontSize="13" fontWeight="500" fill="var(--text-primary)"
        fontFamily="system-ui, -apple-system, sans-serif">
        {idea.graph_label || idea.summary.slice(0, 7)}
      </text>

      {/* 衛星ノード */}
      {satellites.map((sat, i) => (
        <g key={`s-${i}`}>
          <circle cx={sat.pos.x} cy={sat.pos.y} r={SAT_R} fill="var(--bg-secondary)"
            stroke="var(--border-light)" strokeWidth="0.5" />
          <text x={sat.pos.x} y={sat.pos.y} textAnchor="middle" dominantBaseline="central"
            fontSize="9" fill="var(--text-muted)" fontFamily="system-ui, -apple-system, sans-serif">
            {sat.label.slice(0, 5)}
          </text>
        </g>
      ))}
    </svg>
  );
}
