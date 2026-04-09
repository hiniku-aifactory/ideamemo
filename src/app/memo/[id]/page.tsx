"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KnowledgeCard, LatentQuestionHeader } from "@/components/knowledge-card";
import { mockDb } from "@/lib/mock/db";
import type { Idea, Connection } from "@/lib/types";
import type { ChatSession } from "@/lib/mock/db";

// ← 戻るアイコン
function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// コピーアイコン
function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="6" y="6" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M12 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

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

  useEffect(() => {
    const found = mockDb.ideas.get(id);
    if (found) {
      setIdea(found);
      setConnections(mockDb.connections.listByIdea(id));
      setChatSessions(mockDb.chatSessions.listByIdea(id));
    }
    setLoading(false);
  }, [id]);

  const handleCopy = async () => {
    if (!idea) return;
    const text = `${idea.summary}\n\n${idea.keywords.join(", ")}\n\n${idea.transcript}`;
    await navigator.clipboard.writeText(text);
    setToast(true);
    setTimeout(() => setToast(false), 1500);
  };

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

  if (!idea) {
    return (
      <main className="flex flex-col min-h-dvh items-center justify-center gap-4">
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          Not found
        </p>
        <button
          onClick={() => router.push("/")}
          className="text-[11px]"
          style={{ color: "var(--accent)" }}
        >
          ← back
        </button>
      </main>
    );
  }

  const formattedDate = new Date(idea.created_at).toLocaleDateString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const formattedTime = new Date(idea.created_at).toLocaleTimeString("ja-JP", {
    hour: "2-digit", minute: "2-digit",
  });

  const knowledgeConnections = connections.filter((c) => c.connection_type === "external_knowledge");

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 pb-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <button onClick={() => router.push("/")} style={{ color: "var(--text-secondary)" }}>
          <BackArrow />
        </button>
        <button onClick={handleCopy} style={{ color: "var(--text-secondary)" }}>
          <CopyIcon />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-28 space-y-5">
        {/* サマリー */}
        <h2
          className="text-[15px] font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {idea.summary}
        </h2>

        {/* キーワード */}
        <div className="flex flex-wrap gap-1.5">
          {idea.keywords.map((kw) => (
            <span
              key={kw}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ border: "0.5px solid var(--border)", color: "var(--text-muted)" }}
            >
              {kw}
            </span>
          ))}
        </div>

        {/* 抽象原理 */}
        {idea.abstract_principle && (
          <p className="text-[13px] italic" style={{ color: "var(--text-secondary)" }}>
            {idea.abstract_principle}
          </p>
        )}

        {/* 区切り */}
        <hr style={{ border: "none", borderTop: "0.5px solid var(--border-light)" }} />

        {/* 文字起こし */}
        <p className="text-[13px]" style={{ color: "var(--text-primary)", lineHeight: 1.8 }}>
          {idea.transcript}
        </p>

        {/* 外部知識 */}
        {knowledgeConnections.length > 0 && (
          <>
            <hr style={{ border: "none", borderTop: "0.5px solid var(--border-light)" }} />
            <section>
              {idea.latent_question && (
                <LatentQuestionHeader question={idea.latent_question} />
              )}
              {knowledgeConnections.map((conn) => (
                <KnowledgeCard
                  key={conn.id}
                  title={conn.external_knowledge_title ?? ""}
                  description={conn.external_knowledge_summary ?? ""}
                  sourceUrl={conn.external_knowledge_url}
                  sourceTitle={conn.external_knowledge_title}
                  bookmarked={conn.bookmarked ?? false}
                  onBookmark={() => {
                    fetch(`/api/connections/${conn.id}/bookmark`, { method: "POST" });
                  }}
                />
              ))}
            </section>
          </>
        )}

        {/* チャット履歴 */}
        {chatSessions.length > 0 && (
          <>
            <hr style={{ border: "none", borderTop: "0.5px solid var(--border-light)" }} />
            <section>
              {chatSessions.map((session) => (
                <Link href={`/chat?session=${session.id}`} key={session.id}>
                  <div className="mt-2 p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                    <p className="text-[13px] line-clamp-1" style={{ color: "var(--text-primary)" }}>
                      {session.context_summary}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                      {formatRelativeTime(session.updated_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </section>
          </>
        )}

        {/* フッター情報 */}
        <div className="flex items-center justify-between pt-2">
          <span
            className="text-[10px]"
            style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          >
            {idea.folder_name || "other"}
          </span>
          <span
            className="text-[10px]"
            style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
          >
            {formattedDate} {formattedTime}
          </span>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-[11px] animate-page-enter"
          style={{ background: "var(--bg-secondary)", color: "var(--text-primary)", border: "0.5px solid var(--border-light)" }}
        >
          copied
        </div>
      )}
    </main>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("ja-JP");
}
