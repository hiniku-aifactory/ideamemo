"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { KnowledgeCard } from "@/components/knowledge-card";
import { mockDb } from "@/lib/mock/db";
import type { Connection } from "@/lib/types";

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setBookmarks(mockDb.connections.listBookmarked());
    setLoading(false);
  }, []);

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

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      <AppHeader showBack title="Bookmarks" />

      <div className="flex-1 px-5 pb-28">
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center" style={{ paddingTop: "25vh" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path
                d="M24 40s-16-10-16-22A10 10 0 0 1 24 12a10 10 0 0 1 16 6c0 12-16 22-16 22z"
                stroke="#E0E0E0"
                strokeWidth="0.5"
              />
            </svg>
            <span
              className="mt-4 text-xs"
              style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              no bookmarks yet
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((conn) => (
              <KnowledgeCard
                key={conn.id}
                title={conn.external_knowledge_title ?? ""}
                description={conn.external_knowledge_summary ?? ""}
                sourceUrl={conn.external_knowledge_url}
                sourceTitle={conn.external_knowledge_title}
                bookmarked={conn.bookmarked}
                onBookmark={() => {
                  fetch(`/api/connections/${conn.id}/bookmark`, { method: "POST" });
                  setBookmarks((prev) => prev.filter((c) => c.id !== conn.id));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
