"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { mockDb } from "@/lib/mock/db";
import type { Idea } from "@/lib/types";

export default function FoldersPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ideas: Idea[] = mockDb.ideas.list();
    const grouped = ideas.reduce((acc, idea) => {
      const name = idea.folder_name ?? "その他";
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    setFolders(grouped);
    setLoading(false);
  }, []);

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

  const folderNames = Object.keys(folders);

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      <AppHeader showBack title="Folders" />

      <div className="flex-1 px-6 pb-28">
        {folderNames.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: "30vh" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="12" width="40" height="28" rx="2" stroke="#E0E0E0" strokeWidth="0.5" />
              <path d="M4 12L16 4H32L44 12" stroke="#E0E0E0" strokeWidth="0.5" />
            </svg>
            <span
              className="mt-4 text-xs"
              style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              0 folders
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {folderNames.map((name) => (
              <button
                key={name}
                onClick={() => router.push(`/folders/${encodeURIComponent(name)}`)}
                className="flex items-center justify-between p-4 rounded-xl text-left"
                style={{ background: "var(--bg-secondary)" }}
              >
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {name}
                </span>
                <span
                  className="text-sm"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                  }}
                >
                  ({folders[name]})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
