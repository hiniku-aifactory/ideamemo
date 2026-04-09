"use client";

import { useAuth } from "@/components/auth-provider";
import { MemoCard } from "@/components/memo-card";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleUser, Settings, Search, Mic } from "lucide-react";
import type { Idea } from "@/lib/types";

const MEMO_LIMIT = 20;

const FOLDER_CHIPS = ["すべて", "仕事", "生活", "学び", "趣味", "人間関係", "その他"];

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
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
      <header
        className="flex items-center justify-between px-6 pb-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <CircleUser size={24} style={{ color: "var(--text-secondary)" }} />
        <h1
          className="text-xl"
          style={{
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
            color: "var(--text-primary)",
            fontWeight: 300,
          }}
        >
          ideamemo
        </h1>
        <Link href="/settings">
          <Settings size={20} style={{ color: "var(--text-secondary)" }} />
        </Link>
      </header>

      {/* 検索バー */}
      <div className="px-6 pb-3">
        <div
          className="flex items-center gap-2 h-10 px-3 rounded-xl"
          style={{ background: "var(--bg-secondary)" }}
        >
          <Search size={16} style={{ color: "var(--text-muted)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            メモを検索
          </span>
        </div>
      </div>

      {/* フォルダフィルタチップ */}
      <div className="pb-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 px-6 w-max">
          {FOLDER_CHIPS.map((chip, i) => (
            <span
              key={chip}
              className="px-3 py-1.5 rounded-[20px] text-xs whitespace-nowrap"
              style={{
                background: i === 0 ? "var(--accent)" : "var(--bg-secondary)",
                color: i === 0 ? "#0A0A0A" : "var(--text-secondary)",
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pb-28">
        {fetching ? (
          <div className="flex justify-center pt-20">
            <div
              className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
          </div>
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center" style={{ paddingTop: "25vh" }}>
            <Mic size={48} style={{ color: "var(--accent)", opacity: 0.5 }} />
            <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              最初の気づきを録ろう
            </p>
            <p className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
              ふと思ったこと、15秒でOK
              <br />
              AIが世界の知識と繋げます
            </p>
            <p className="mt-6 text-sm animate-bounce" style={{ color: "var(--text-muted)" }}>
              ↓ 録音ボタンをタップ
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ideas.map((idea) => (
              <MemoCard
                key={idea.id}
                idea={idea}
                onClick={() => router.push(`/memo/${idea.id}`)}
                onDelete={(id) => setIdeas((prev) => prev.filter((i) => i.id !== id))}
              />
            ))}
          </div>
        )}
      </div>

      {/* メモ数表示 */}
      {ideas.length > 0 && (
        <div className="text-center pb-28">
          <span
            className="text-xs"
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
            }}
          >
            {ideas.length}/{MEMO_LIMIT} メモ保存済み
          </span>
        </div>
      )}
    </main>
  );
}
