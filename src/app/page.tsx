"use client";

import { useAuth } from "@/components/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import type { Idea } from "@/lib/types";

const MEMO_LIMIT = 20;

interface IdeaWithMeta extends Idea {
  connection_count?: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaWithMeta[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas");
      const data = await res.json();
      setIdeas(data.ideas || []);
    } catch (err) {
      console.error("Failed to fetch ideas:", err);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchIdeas();
    else setFetching(false);
  }, [user, fetchIdeas]);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div
          className="h-6 w-6 rounded-full border border-t-transparent animate-spin"
          style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
        />
      </main>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      <AppHeader
        title={`${ideas.length} memos`}
      />

      {/* Content */}
      <div className="flex-1 px-5 pb-28">
        {fetching ? (
          <div className="flex justify-center pt-20">
            <div
              className="h-6 w-6 rounded-full border border-t-transparent animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
            />
          </div>
        ) : ideas.length === 0 ? (
          /* エンプティステート */
          <div className="flex flex-col items-center" style={{ paddingTop: "25vh" }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="38" stroke="#E0E0E0" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="24" stroke="#E0E0E0" strokeWidth="0.5" />
              <circle cx="40" cy="40" r="10" stroke="#E0E0E0" strokeWidth="0.5" />
              <line x1="40" y1="0" x2="40" y2="80" stroke="#E0E0E0" strokeWidth="0.5" />
              <line x1="0" y1="40" x2="80" y2="40" stroke="#E0E0E0" strokeWidth="0.5" />
            </svg>
            <span
              className="mt-4 text-xs"
              style={{
                color: "var(--text-muted)",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}
            >
              0 nodes
            </span>
          </div>
        ) : (
          /* メモ一覧 */
          <div>
            {ideas.map((idea, idx) => (
              <button
                key={idea.id}
                onClick={() => router.push(`/memo/${idea.id}`)}
                className="w-full text-left py-3"
                style={{
                  borderBottom: idx < ideas.length - 1 ? "0.5px solid var(--border-light)" : "none",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] leading-snug truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {idea.summary}
                    </p>
                    <span
                      className="text-[11px] mt-1 block"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      }}
                    >
                      {timeAgo(idea.created_at)}
                    </span>
                  </div>
                  {/* 外部知識数ドット */}
                  {(idea.connection_count ?? 0) > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-shrink-0">
                      {Array.from({ length: idea.connection_count ?? 0 }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-full"
                          style={{
                            width: "5px",
                            height: "5px",
                            background: "var(--border)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* メモ数表示 */}
      {ideas.length > 0 && (
        <div className="text-center pb-28">
          <span
            className="text-[10px]"
            style={{
              color: "var(--text-muted)",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            {ideas.length}/{MEMO_LIMIT}
          </span>
        </div>
      )}
    </main>
  );
}
