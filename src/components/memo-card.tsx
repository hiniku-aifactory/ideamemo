"use client";

import { useState, useRef } from "react";
import type { Idea } from "@/lib/types";

interface Props {
  idea: Idea;
  onClick?: () => void;
  onDelete?: (id: string) => void;
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

export function MemoCard({ idea, onClick, onDelete }: Props) {
  const [swipeX, setSwipeX] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const startXRef = useRef(0);
  const trackingRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    trackingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!trackingRef.current) return;
    const dx = e.touches[0].clientX - startXRef.current;
    if (dx < 0) {
      setSwipeX(Math.max(dx, -100));
    }
  };

  const handleTouchEnd = () => {
    trackingRef.current = false;
    if (swipeX < -80) {
      setSwipeX(-80);
    } else {
      setSwipeX(0);
    }
  };

  const handleDelete = () => {
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await fetch(`/api/ideas/${idea.id}`, { method: "DELETE" });
      onDelete?.(idea.id);
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setShowConfirm(false);
    setSwipeX(0);
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        {/* 削除ボタン背景 */}
        {onDelete && (
          <div
            className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
            style={{ width: "80px", background: "var(--error)" }}
          >
            <button
              onClick={handleDelete}
              className="text-sm font-medium"
              style={{ color: "#fff" }}
            >
              削除
            </button>
          </div>
        )}

        {/* カード本体 */}
        <button
          onClick={swipeX === 0 ? onClick : () => setSwipeX(0)}
          onTouchStart={onDelete ? handleTouchStart : undefined}
          onTouchMove={onDelete ? handleTouchMove : undefined}
          onTouchEnd={onDelete ? handleTouchEnd : undefined}
          className="relative w-full text-left rounded-xl p-4 transition-transform"
          style={{
            background: "var(--bg-secondary)",
            transform: `translateX(${swipeX}px)`,
            transition: trackingRef.current ? "none" : "transform 200ms ease-out",
          }}
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
      </div>

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="mx-8 p-5 rounded-xl max-w-sm" style={{ background: "var(--bg-secondary)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              このメモを削除しますか?
            </p>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              接続やチャット履歴も一緒に削除されます。
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowConfirm(false); setSwipeX(0); }}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "var(--error)", color: "#fff" }}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
