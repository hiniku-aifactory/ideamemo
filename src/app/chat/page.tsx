"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send, ChevronDown, ChevronUp, MessageCircle, Pin } from "lucide-react";
import { mockDb } from "@/lib/mock/db";
import type { ChatSession, ChatMessage } from "@/lib/mock/db";

// セッション一覧ビュー
function SessionList({ onSelect }: { onSelect: (id: string) => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    setSessions(mockDb.chatSessions.list());
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ paddingTop: "30vh" }}>
        <MessageCircle size={48} style={{ color: "var(--accent)", opacity: 0.5 }} />
        <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
          まだチャット履歴がありません
        </p>
        <p className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
          接続カードの「深掘り」から
          <br />
          チャットを始められます
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const messages = mockDb.chatMessages.listBySession(session.id);
        const lastMsg = messages[messages.length - 1];
        return (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className="w-full text-left p-3 rounded-lg"
            style={{ background: "var(--bg-secondary)" }}
          >
            <p className="text-sm line-clamp-1" style={{ color: "var(--text-primary)" }}>
              {session.context_summary}
            </p>
            {lastMsg && (
              <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                {lastMsg.content}
              </p>
            )}
            <p className="text-[10px] mt-1 text-right" style={{ color: "var(--text-muted)" }}>
              {formatRelativeTime(session.updated_at)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// チャットビュー
function ChatView({ sessionId, connectionId }: { sessionId?: string; connectionId?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [streamingContent, setStreamingContent] = useState("");
  const [contextExpanded, setContextExpanded] = useState(false);
  const [contextSummary, setContextSummary] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初期化
  useEffect(() => {
    if (sessionId) {
      // 既存セッション復元
      const existingMessages = mockDb.chatMessages.listBySession(sessionId);
      setMessages(existingMessages);
      setCurrentSessionId(sessionId);
      const session = mockDb.chatSessions.get(sessionId);
      if (session) setContextSummary(session.context_summary);
    } else if (connectionId) {
      // 既存セッションがあるか確認
      const existing = mockDb.chatSessions.findByConnection(connectionId);
      if (existing) {
        const existingMessages = mockDb.chatMessages.listBySession(existing.id);
        setMessages(existingMessages);
        setCurrentSessionId(existing.id);
        setContextSummary(existing.context_summary);
      } else {
        // 新規セッション作成
        initNewSession(connectionId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, connectionId]);

  // スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const initNewSession = useCallback(async (connId: string) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: { connectionId: connId } }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const eventMatch = raw.match(/event: (\w+)/);
          const dataMatch = raw.match(/data: ([\s\S]+)/);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "session") {
            setCurrentSessionId(data.sessionId);
            const session = mockDb.chatSessions.get(data.sessionId);
            if (session) setContextSummary(session.context_summary);
          } else if (event === "message") {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                session_id: data.sessionId ?? "",
                role: data.role,
                content: data.content,
                created_at: new Date().toISOString(),
              },
            ]);
          }
        }
      }
    } catch (err) {
      console.error("Chat init error:", err);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);
    setStreamingContent("");

    // ユーザーメッセージをUIに即追加
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        session_id: currentSessionId ?? "",
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: userMessage,
          context: connectionId ? { connectionId } : undefined,
        }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const eventMatch = raw.match(/event: (\w+)/);
          const dataMatch = raw.match(/data: ([\s\S]+)/);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (event === "session") {
            setCurrentSessionId(data.sessionId);
          } else if (event === "delta") {
            setStreamingContent(data.content);
          } else if (event === "done") {
            // ストリーミング完了: 最終テキストをメッセージに追加
            setMessages((prev) => {
              const lastStreamed = mockDb.chatMessages
                .listBySession(currentSessionId ?? "")
                .filter((m) => m.role === "assistant")
                .pop();
              if (lastStreamed) {
                return [
                  ...prev,
                  {
                    id: lastStreamed.id,
                    session_id: currentSessionId ?? "",
                    role: "assistant" as const,
                    content: lastStreamed.content,
                    created_at: lastStreamed.created_at,
                  },
                ];
              }
              return prev;
            });
            setStreamingContent("");
          }
        }
      }
    } catch (err) {
      console.error("Chat send error:", err);
    } finally {
      setSending(false);
    }
  }, [input, sending, currentSessionId, connectionId]);

  return (
    <div className="flex flex-col h-full">
      {/* コンテキストバー */}
      {contextSummary && (
        <div
          className="mx-4 mb-2 rounded-lg overflow-hidden"
          style={{ background: "var(--bg-secondary)" }}
        >
          <button
            onClick={() => setContextExpanded(!contextExpanded)}
            className="w-full flex items-center gap-2 p-2.5 text-left"
          >
            <Pin size={12} style={{ color: "var(--text-muted)" }} />
            <span
              className={`flex-1 text-xs ${contextExpanded ? "" : "line-clamp-1"}`}
              style={{ color: "var(--text-secondary)" }}
            >
              {contextSummary}
            </span>
            {contextExpanded ? (
              <ChevronUp size={14} style={{ color: "var(--text-muted)" }} />
            ) : (
              <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
            )}
          </button>
        </div>
      )}

      {/* メッセージ一覧 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "assistant" ? (
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>
                {msg.content}
              </p>
            ) : (
              <div className="flex justify-end">
                <p
                  className="text-sm rounded-2xl px-3.5 py-2.5 max-w-[80%]"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                >
                  {msg.content}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* ストリーミング中の表示 */}
        {streamingContent && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>
            {streamingContent}
          </p>
        )}

        {/* 送信中インジケーター */}
        {sending && !streamingContent && (
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--text-muted)" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--text-muted)", animationDelay: "0.2s" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--text-muted)", animationDelay: "0.4s" }} />
          </div>
        )}
      </div>

      {/* 入力フィールド */}
      <div className="px-4 pb-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <div
          className="flex items-center gap-2 rounded-3xl px-4 py-2.5"
          style={{ background: "var(--bg-tertiary)" }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="メッセージを入力..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              color: input.trim() ? "var(--accent)" : "var(--text-muted)",
              opacity: sending ? 0.5 : 1,
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const connectionId = searchParams.get("connection") ?? undefined;
  const sessionId = searchParams.get("session") ?? undefined;

  const hasContext = connectionId || sessionId;

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 pb-3"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.back()}
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1
          className="text-lg font-light"
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "var(--text-primary)",
          }}
        >
          {hasContext ? "深掘り" : "チャット"}
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {hasContext ? (
          <ChatView sessionId={sessionId} connectionId={connectionId} />
        ) : (
          <div className="flex-1 px-4">
            <SessionList onSelect={(id) => router.push(`/chat?session=${id}`)} />
          </div>
        )}
      </div>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-dvh items-center justify-center">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </main>
    }>
      <ChatPageInner />
    </Suspense>
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
