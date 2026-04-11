"use client";

import { useAuth } from "@/components/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { NodePreview } from "@/components/node-preview";
import { pickHomeIdea } from "@/lib/home-picker";
import { quotes } from "@/lib/quotes";
import type { Idea, Connection } from "@/lib/types";

interface Quote {
  text: string;
  author: string;
  ja?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (d < 1) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function getDailyQuote(): Quote {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return (quotes as Quote[])[dayOfYear % quotes.length];
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [fetching, setFetching] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [ideasRes, connRes] = await Promise.all([
        fetch("/api/ideas"),
        fetch("/api/connections"),
      ]);
      const ideasData = await ideasRes.json();
      const connData = connRes.ok ? await connRes.json() : { connections: [] };
      setIdeas(ideasData.ideas || []);
      setConnections(connData.connections || []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
    else setFetching(false);
  }, [user, fetchData]);

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

  const pick = !fetching ? pickHomeIdea(ideas, connections) : null;
  const quote = getDailyQuote();

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      <AppHeader title={`${ideas.length} memos`} />

      <div className="flex-1 flex flex-col items-center px-5 pb-28" style={{ paddingTop: "6vh" }}>
        {fetching ? (
          <div className="flex justify-center pt-20">
            <div
              className="h-6 w-6 rounded-full border border-t-transparent animate-spin"
              style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
            />
          </div>
        ) : pick ? (
          <>
            {/* ノードプレビュー */}
            <button
              className="w-full max-w-xs"
              onClick={() => router.push(`/graph/explore?root=${pick.idea.id}`)}
              aria-label={pick.idea.summary}
            >
              <NodePreview idea={pick.idea} connections={pick.connections} />
            </button>

            {/* サマリー */}
            <p
              className="mt-4 text-[16px] w-full max-w-xs"
              style={{ color: "var(--text-primary)", lineHeight: 1.6 }}
            >
              {pick.idea.summary}
            </p>

            {/* メタ情報 */}
            <p
              className="mt-2 text-[11px] w-full max-w-xs"
              style={{
                color: "var(--text-muted)",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}
            >
              {pick.connections.length} connections · {timeAgo(pick.idea.created_at)}
            </p>

            {/* 区切り線 */}
            <div
              className="mt-6 w-full max-w-xs"
              style={{ borderTop: "0.5px solid var(--border-light)" }}
            />
          </>
        ) : (
          <>
            {/* エンプティステート */}
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

            {/* 区切り線 */}
            <div
              className="mt-8 w-full max-w-xs"
              style={{ borderTop: "0.5px solid var(--border-light)" }}
            />
          </>
        )}

        {/* 偉人の言葉 */}
        <div className="mt-6 w-full max-w-xs">
          {quote.ja ? (
            <>
              <p
                className="text-[13px] italic"
                style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}
              >
                {`"${quote.ja}"`}
              </p>
              <p
                className="mt-1 text-[11px] italic"
                style={{ color: "var(--text-muted)", lineHeight: 1.6 }}
              >
                {`"${quote.text}"`}
              </p>
            </>
          ) : (
            <p
              className="text-[13px] italic"
              style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}
            >
              {`"${quote.text}"`}
            </p>
          )}
          <p
            className="mt-2 text-[12px] text-right"
            style={{ color: "var(--text-muted)" }}
          >
            — {quote.author}
          </p>
        </div>
      </div>
    </main>
  );
}
