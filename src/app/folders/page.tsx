"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Folder } from "lucide-react";
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
      <header
        className="px-6 pb-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <h1
          className="text-lg font-light"
          style={{
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
            color: "var(--text-primary)",
          }}
        >
          フォルダ
        </h1>
      </header>

      <div className="flex-1 px-6 pb-28">
        {folderNames.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ paddingTop: "30vh" }}>
            <Folder size={48} style={{ color: "var(--accent)", opacity: 0.5 }} />
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              まだフォルダがありません
            </p>
            <p className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
              メモを録音するとAIが自動的に分類します
            </p>
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
