"use client";

import { Search, ArrowRightLeft } from "lucide-react";
import { FeedbackButton } from "./feedback-button";

interface Props {
  personaLabel?: string | null;
  connectionType: string;
  reason: string;
  actionSuggestion: string;
  sourceIdeaSummary?: string | null;
  externalTitle?: string | null;
  externalUrl?: string | null;
  externalSummary?: string | null;
  sourceType?: string | null;
  animate?: boolean;
  connectionId?: string;
  onDeepDive?: () => void;
}

export function ConnectionCard({
  personaLabel,
  connectionType,
  reason,
  actionSuggestion,
  sourceIdeaSummary,
  externalTitle,
  externalUrl,
  externalSummary,
  sourceType,
  animate = false,
  connectionId,
  onDeepDive,
}: Props) {
  // ラベル表示: personaLabelがあればそれを使う。なければconnectionTypeから旧式フォールバック
  const displayLabel = personaLabel ?? connectionType;
  const rightLabel = sourceType === "past_memo" ? "過去のメモ" : "外部知識";

  return (
    <div
      className={`rounded-xl p-4 border-l-[3px] ${animate ? "animate-slide-in" : ""}`}
      style={{
        background: "var(--bg-secondary)",
        borderLeftColor: "var(--accent)",
        animation: animate
          ? "slide-in 400ms ease-out, glow 2s ease-out"
          : undefined,
      }}
    >
      {/* ペルソナラベル */}
      <div className="flex items-center gap-1.5">
        <Search size={14} style={{ color: "var(--accent)" }} />
        <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>
          {displayLabel}
        </p>
      </div>

      {/* 左右カード（あなたのメモ <-> 外部知識） */}
      {(sourceIdeaSummary || externalTitle) && (
        <div className="flex items-stretch gap-2 mt-3">
          {sourceIdeaSummary && (
            <div
              className="flex-1 rounded-lg p-2.5"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
                あなたのメモ
              </p>
              <p
                className="text-[13px] line-clamp-2"
                style={{ color: "var(--text-primary)" }}
              >
                {sourceIdeaSummary}
              </p>
            </div>
          )}

          {sourceIdeaSummary && externalTitle && (
            <div className="flex items-center">
              <ArrowRightLeft size={16} style={{ color: "var(--accent)" }} />
            </div>
          )}

          {externalTitle && (
            <div
              className="flex-1 rounded-lg p-2.5"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>
                {rightLabel}
              </p>
              <p
                className="text-[13px] line-clamp-2"
                style={{ color: "var(--text-primary)" }}
              >
                {externalTitle}
              </p>
            </div>
          )}
        </div>
      )}

      {/* つながりの理由 */}
      <p
        className="mt-3 text-sm leading-relaxed"
        style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
      >
        {reason}
      </p>

      {/* TRY THIS */}
      <div className="mt-4">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--accent-dim)" }}>
          TRY THIS
        </p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {actionSuggestion}
        </p>
      </div>

      {/* 参照セクション */}
      {externalTitle && (
        <div className="mt-3">
          <p className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>
            参照
          </p>
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] underline"
              style={{ color: "var(--accent)" }}
            >
              {externalTitle}
            </a>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--accent)" }}>
              {externalTitle}
            </p>
          )}
          {externalSummary && (
            <p
              className="text-xs mt-0.5 line-clamp-3"
              style={{ color: "var(--text-secondary)" }}
            >
              {externalSummary}
            </p>
          )}
        </div>
      )}

      {/* フィードバック + 深掘り */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex gap-2">
          <FeedbackButton connectionId={connectionId} type="positive" label="使える" />
          <FeedbackButton connectionId={connectionId} type="negative" label="ピンとこない" />
        </div>
        {onDeepDive && (
          <button
            onClick={onDeepDive}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            <Search size={12} />
            深掘り
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes glow {
          0% {
            box-shadow: -3px 0 12px var(--accent);
          }
          100% {
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
