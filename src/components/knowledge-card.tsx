"use client";

import { useState } from "react";

interface Props {
  title: string;
  description: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  bookmarked?: boolean;
  onBookmark?: () => void;
  connectionId?: string;
  onDeepDive?: (connId: string) => void;
  isExternalKnowledge?: boolean;
}

// ♡ ブックマークアイコン
function BookmarkHeart({ filled, size = 14 }: { filled: boolean; size?: number }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="#999999">
        <path d="M7 12.5s-5.5-3.5-5.5-7A3 3 0 0 1 7 3.5a3 3 0 0 1 5.5 2c0 3.5-5.5 7-5.5 7z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path
        d="M7 12.5s-5.5-3.5-5.5-7A3 3 0 0 1 7 3.5a3 3 0 0 1 5.5 2c0 3.5-5.5 7-5.5 7z"
        stroke="#CCCCCC"
        strokeWidth="0.7"
      />
    </svg>
  );
}

export function KnowledgeCard({ title, description, sourceUrl, sourceTitle, bookmarked = false, onBookmark, connectionId, onDeepDive, isExternalKnowledge = false }: Props) {
  const [isBookmarked, setIsBookmarked] = useState(bookmarked);

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    onBookmark?.();
  };

  return (
    <div className="flex gap-3">
      {/* タイムラインノード + 縦線 */}
      <div className="flex flex-col items-center pt-1.5">
        <div
          className="rounded-full flex-shrink-0"
          style={{
            width: "5px",
            height: "5px",
            border: isExternalKnowledge ? "1px solid var(--accent)" : "1px solid #BBBBBB",
            background: isExternalKnowledge ? "var(--accent)" : "var(--bg-primary)",
          }}
        />
        <div
          className="flex-1 mt-1"
          style={{
            width: "0.5px",
            background: "var(--border)",
          }}
        />
      </div>

      {/* コンテンツ */}
      <div className="flex-1 pb-4 min-w-0">
        <p
          className="text-[13px] font-semibold"
          style={{ color: "var(--text-body, var(--text-primary))" }}
        >
          {title}
        </p>
        <p
          className="text-[13px] mt-1"
          style={{ color: "var(--text-body, var(--text-primary))", lineHeight: 1.8 }}
        >
          {description}
        </p>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px]"
                style={{ color: "var(--accent)" }}
              >
                {sourceTitle || sourceUrl} ↗
              </a>
            ) : sourceTitle ? (
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {sourceTitle}
              </span>
            ) : (
              <span />
            )}

            {connectionId && onDeepDive && (
              <button onClick={() => onDeepDive(connectionId)}
                className="text-[10px]" style={{ color: "var(--accent)" }}>
                深掘り →
              </button>
            )}

            {isExternalKnowledge && (
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                グラフに追加済み
              </span>
            )}
          </div>

          <button
            onClick={handleBookmark}
            className="flex-shrink-0 transition-transform active:scale-[1.15]"
            style={{ transition: "transform 200ms ease-out" }}
          >
            <BookmarkHeart filled={isBookmarked} />
          </button>
        </div>
      </div>
    </div>
  );
}

// latent_questionヘッダー
export function LatentQuestionHeader({ question }: { question: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {/* 同心円アイコン */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
        <circle cx="10" cy="10" r="9" stroke="#E0E0E0" strokeWidth="0.5" />
        <circle cx="10" cy="10" r="5" stroke="#E0E0E0" strokeWidth="0.5" />
        <circle cx="10" cy="10" r="1.5" fill="#BBBBBB" />
      </svg>
      <p
        className="text-[13px] font-medium italic"
        style={{ color: "var(--text-secondary)" }}
      >
        {question}
      </p>
    </div>
  );
}
