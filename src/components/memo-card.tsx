"use client";

import type { Idea } from "@/lib/types";

interface Props {
  idea: Idea;
  onClick?: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const d = Math.floor(hr / 24);
  return `${d}日前`;
}

export function MemoCard({ idea, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-opacity hover:opacity-90"
      style={{ background: "var(--bg-secondary)" }}
    >
      <p className="text-base leading-snug" style={{ color: "var(--text-primary)" }}>
        {idea.summary}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {idea.keywords.map((kw) => (
          <span
            key={kw}
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: "var(--accent)", color: "#0A0A0A" }}
          >
            {kw}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {idea.folder_name}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {timeAgo(idea.created_at)}
        </span>
      </div>
    </button>
  );
}
