"use client";

import { useAuth } from "@/components/auth-provider";
import { MemoCard } from "@/components/memo-card";
import { useEffect, useState, useCallback } from "react";
import type { Idea } from "@/lib/types";

export default function HomePage() {
  const { user, loading, signOut } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
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
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
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
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-light"
            style={{
              fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
              color: "var(--text-primary)",
            }}
          >
            ideamemo
          </h1>
          {ideas.length > 0 && (
            <span
              className="text-sm"
              style={{
                fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                color: "var(--text-muted)",
              }}
            >
              {ideas.length}
            </span>
          )}
        </div>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          ログアウト
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 pb-24">
        {fetching ? (
          <div className="flex justify-center pt-20">
            <div
              className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          </div>
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-32">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              まだメモがありません
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              下の録音ボタンをタップして、最初のアイデアを録音しましょう
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ideas.map((idea) => (
              <MemoCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
