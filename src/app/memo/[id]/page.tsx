"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { ConnectionCard } from "@/components/connection-card";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";
import type { ChatSession } from "@/lib/mock/db";

interface Props {
  params: Promise<{ id: string }>;
}

export default function MemoDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    const found = mockDb.ideas.get(id);
    if (found) {
      setIdea(found);
      setConnections(mockDb.connections.listByIdea(id));
      setChatSessions(mockDb.chatSessions.listByIdea(id));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const handleCopy = async () => {
    if (!idea) return;

    const md = `## ${idea.summary}\n\n**キーワード:** ${idea.keywords.join(", ")}\n\n${connections.map(c =>
      `### ${c.persona_label ?? c.connection_type}\n${c.reason}\n→ TRY: ${c.action_suggestion}\n参照: ${c.external_knowledge_title ?? "なし"}`
    ).join("\n\n")}`;

    const markdown = md;

    await navigator.clipboard.writeText(markdown);
    setToast(true);
    setTimeout(() => setToast(false), 1500);
  };

  const handleShare = async () => {
    if (!idea) return;
    try {
      await navigator.share({
        title: idea.summary,
        text: `${idea.summary}\n\n${idea.abstract_principle}`,
      });
    } catch {
      // user cancelled
    }
  };

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

  if (!idea) {
    return (
      <main className="flex flex-col min-h-dvh items-center justify-center gap-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          メモが見つかりません
        </p>
        <button
          onClick={() => router.push("/")}
          className="text-sm px-4 py-2 rounded-lg"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
        >
          ホームに戻る
        </button>
      </main>
    );
  }

  const formattedDate = new Date(idea.created_at).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const formattedTime = new Date(idea.created_at).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 pb-4"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/")}
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <button onClick={handleCopy} style={{ color: "var(--text-secondary)" }}>
            <Copy size={18} />
          </button>
          {canShare && (
            <button onClick={handleShare} style={{ color: "var(--text-secondary)" }}>
              <Share2 size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-28 space-y-6">
        {/* サマリー */}
        <h2
          className="text-base font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {idea.summary}
        </h2>

        {/* キーワード */}
        <div className="flex flex-wrap gap-1.5">
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

        {/* 抽象原理 */}
        <p className="text-sm italic" style={{ color: "var(--text-secondary)" }}>
          {idea.abstract_principle}
        </p>

        {/* 区切り */}
        <hr style={{ borderColor: "var(--border)" }} />

        {/* 文字起こし */}
        <section>
          <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
            聞き取れた内容
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>
            {idea.transcript}
          </p>
        </section>

        {/* 区切り */}
        {connections.length > 0 && <hr style={{ borderColor: "var(--border)" }} />}

        {/* つながり */}
        {connections.length > 0 && (
          <section>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
              つながり（{connections.length}件）
            </p>
            <div className="space-y-3">
              {connections.map((conn) => (
                <ConnectionCard
                  key={conn.id}
                  personaLabel={conn.persona_label}
                  connectionType={conn.connection_type}
                  reason={conn.reason}
                  actionSuggestion={conn.action_suggestion}
                  sourceIdeaSummary={conn.source_idea_summary}
                  externalTitle={conn.external_knowledge_title}
                  externalUrl={conn.external_knowledge_url}
                  externalSummary={conn.external_knowledge_summary}
                  connectionId={conn.id}
                  onDeepDive={() => router.push(`/chat?connection=${conn.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* チャット履歴 */}
        {chatSessions.length > 0 && (
          <>
            <hr style={{ borderColor: "var(--border)" }} />
            <section>
              <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>チャット</p>
              {chatSessions.map((session) => (
                <Link href={`/chat?session=${session.id}`} key={session.id}>
                  <div className="mt-2 p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                    <p className="text-sm line-clamp-1" style={{ color: "var(--text-primary)" }}>
                      {session.context_summary}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {formatRelativeTime(session.updated_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </section>
          </>
        )}

        {/* 区切り */}
        <hr style={{ borderColor: "var(--border)" }} />

        {/* フッター情報 */}
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            フォルダ: {idea.folder_name || "その他"}
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {formattedDate} {formattedTime}
          </span>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-3xl text-sm animate-page-enter"
          style={{ background: "var(--success)", color: "#fff" }}
        >
          コピーしました
        </div>
      )}
    </main>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}
