"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";

type SortMode = "connectivity" | "newest" | "oldest";

const SORT_LABELS: Record<SortMode, string> = {
  connectivity: "connectivity",
  newest: "newest",
  oldest: "oldest",
};

const SORT_ORDER: SortMode[] = ["connectivity", "newest", "oldest"];

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}

function getConnCount(ideaId: string, connections: Connection[]): number {
  return connections.filter(
    (c) => c.idea_from_id === ideaId || c.idea_to_id === ideaId
  ).length;
}

function getLabelChars(summary: string): string {
  return summary.slice(0, 3);
}

export default function GraphPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("connectivity");

  useEffect(() => {
    setIdeas(mockDb.ideas.list());
    setConnections(mockDb.connections.list());
  }, []);

  const totalLinks = useMemo(() => {
    return connections.filter((c) => c.idea_to_id).length;
  }, [connections]);

  const sortedIdeas = useMemo(() => {
    const list = [...ideas];
    switch (sortMode) {
      case "connectivity":
        return list.sort(
          (a, b) => getConnCount(b.id, connections) - getConnCount(a.id, connections)
        );
      case "newest":
        return list.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "oldest":
        return list.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
    }
  }, [ideas, connections, sortMode]);

  if (ideas.length === 0) {
    return (
      <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
        <AppHeader />
        <div
          className="flex-1 flex flex-col items-center justify-center"
          style={{ paddingBottom: "20vh" }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="#E0E0E0" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="24" stroke="#E0E0E0" strokeWidth="0.5" />
            <circle cx="40" cy="40" r="10" stroke="#E0E0E0" strokeWidth="0.5" />
          </svg>
          <span
            className="mt-4 text-xs"
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            0 nodes
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-dvh overflow-hidden animate-page-enter">
      <AppHeader />
      <div className="flex-none flex items-center justify-between px-5 pb-3">
        <span
          className="text-[11px]"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
        >
          {ideas.length} nodes · {totalLinks} links
        </span>
        <button
          onClick={() => {
            const currentIndex = SORT_ORDER.indexOf(sortMode);
            const nextIndex = (currentIndex + 1) % SORT_ORDER.length;
            setSortMode(SORT_ORDER[nextIndex]);
          }}
          className="text-[11px]"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
        >
          {SORT_LABELS[sortMode]} ▾
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-24">
        <div className="space-y-2">
          {sortedIdeas.map((idea) => {
            const connCount = getConnCount(idea.id, connections);
            const maxDots = Math.min(connCount, 6);
            return (
              <button
                key={idea.id}
                onClick={() => router.push(`/graph/explore?root=${idea.id}`)}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-xl text-left"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 44,
                    height: 44,
                    border: "0.5px solid var(--border)",
                    background: "var(--bg-primary)",
                  }}
                >
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {getLabelChars(idea.summary)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[14px] font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {idea.summary}
                  </p>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                  >
                    {connCount} connections · {formatRelativeTime(idea.created_at)}
                  </p>
                </div>
                <div className="flex-shrink-0 flex gap-1">
                  {Array.from({ length: maxDots }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-full"
                      style={{ width: 6, height: 6, background: "var(--text-secondary)" }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
