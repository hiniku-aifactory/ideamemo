"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ContextHeader } from "@/components/chat/context-header";
import { SuggestButtons } from "@/components/chat/suggest-buttons";
import { mockDb } from "@/lib/mock/db";
import type { ChatSession, ChatMessage } from "@/lib/mock/db";
import type { ChatInsight, Idea, Connection } from "@/lib/types";

// セッション一覧ビュー
function SessionList({ onSelect }: { onSelect: (id: string) => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useEffect(() => {
    setSessions(mockDb.chatSessions.list());
  }, []);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ paddingTop: "30vh" }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="22" r="16" stroke="#E0E0E0" strokeWidth="0.5" />
          <path d="M16 34L24 38L20 34" stroke="#E0E0E0" strokeWidth="0.5" />
        </svg>
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
function ChatView({ sessionId, connectionId, ideaId }: { sessionId?: string; connectionId?: string; ideaId?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [streamingContent, setStreamingContent] = useState("");
  const [contextIdeas, setContextIdeas] = useState<{
    from: Idea | null; to: Idea | null; connection: Connection | null;
  }>({ from: null, to: null, connection: null });
  const [insights, setInsights] = useState<ChatInsight[]>([]);
  const [insightLoading, setInsightLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [followUpShown, setFollowUpShown] = useState(false);
  const [followUpDismissed, setFollowUpDismissed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const insightFetchedRef = useRef(false);

  // 初期化
  useEffect(() => {
    if (sessionId) {
      // 既存セッション復元
      const existingMessages = mockDb.chatMessages.listBySession(sessionId);
      setMessages(existingMessages);
      setCurrentSessionId(sessionId);
      const session = mockDb.chatSessions.get(sessionId);
      if (session) { /* context_summary は ContextHeader で表示 */ void session; }
    } else if (connectionId) {
      // 既存セッションがあるか確認
      const existing = mockDb.chatSessions.findByConnection(connectionId);
      if (existing) {
        const existingMessages = mockDb.chatMessages.listBySession(existing.id);
        setMessages(existingMessages);
        setCurrentSessionId(existing.id);
      } else {
        // 新規セッション作成
        initNewSession(connectionId);
      }
    } else if (ideaId) {
      // 単体メモをコンテキストにチャット開始
      const idea = mockDb.ideas.get(ideaId) ?? null;
      if (idea) setContextIdeas({ from: idea, to: null, connection: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, connectionId, ideaId]);

  // コンテキストideas取得（ideaId単体モードでは初期化useEffectで設定済みのためスキップ）
  useEffect(() => {
    if (ideaId) return;
    const cid = connectionId ?? (() => {
      if (!currentSessionId) return null;
      const session = mockDb.chatSessions.get(currentSessionId);
      return session?.connection_id ?? null;
    })();
    if (!cid) return;
    const conn = mockDb.connections.list().find((c) => c.id === cid) ?? null;
    const from = conn ? mockDb.ideas.get(conn.idea_from_id) ?? null : null;
    const to = conn?.idea_to_id ? mockDb.ideas.get(conn.idea_to_id) ?? null : null;
    setContextIdeas({ from, to, connection: conn });
  }, [currentSessionId, connectionId, ideaId]);

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

  const fetchInsights = useCallback(async (sid: string) => {
    if (insightFetchedRef.current || insightLoading) return;
    insightFetchedRef.current = true;
    setInsightLoading(true);
    try {
      const res = await fetch("/api/chat/extract-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid }),
      });
      const data = await res.json() as { insights: ChatInsight[] };
      setInsights(data.insights || []);
    } catch (err) {
      console.error("extract-insights error:", err);
    } finally {
      setInsightLoading(false);
    }
  }, [insightLoading]);

  // assistant発言が6回に達したら自動抽出
  useEffect(() => {
    const assistantCount = messages.filter((m) => m.role === "assistant").length;
    if (assistantCount >= 6 && currentSessionId && !insightFetchedRef.current && insights.length === 0) {
      fetchInsights(currentSessionId);
    }
  }, [messages, currentSessionId, insights.length, fetchInsights]);

  // フォローアップサジェスト表示
  useEffect(() => {
    const assistantCount = messages.filter((m) => m.role === "assistant").length;
    if (assistantCount >= 3 && !followUpShown && !followUpDismissed) {
      setFollowUpShown(true);
    }
  }, [messages, followUpShown, followUpDismissed]);

  const handleAddToGraph = useCallback(
    async (insight: ChatInsight) => {
      const session = currentSessionId ? mockDb.chatSessions.get(currentSessionId) : null;
      const parentIdeaId = session?.idea_id ?? null;

      const newIdea: Idea = {
        id: `idea-insight-${Date.now()}`,
        user_id: "mock-user-001",
        transcript: insight.full_text,
        summary: insight.summary,
        keywords: insight.keywords,
        abstract_principle: insight.full_text,
        latent_question: "",
        domain: "その他",
        audio_url: null,
        folder_id: null,
        folder_name: null,
        source: "chat_insight",
        parent_session_id: currentSessionId ?? null,
        graph_label: "",
        tags: [],
        created_at: new Date().toISOString(),
      };
      mockDb.ideas.insert(newIdea);

      if (parentIdeaId) {
        const newConn: Connection = {
          id: `conn-derived-${Date.now()}`,
          idea_from_id: parentIdeaId,
          idea_to_id: newIdea.id,
          connection_type: "chat_derived",
          source: "ai",
          persona_label: null,
          reason: insight.full_text,
          action_suggestion: "",
          quality_score: null,
          external_knowledge_title: null,
          external_knowledge_url: null,
          external_knowledge_summary: null,
          source_idea_summary: null,
          user_note: null,
          feedback: null,
          feedback_at: null,
          bookmarked: false,
          created_at: new Date().toISOString(),
        };
        mockDb.connections.insert(newConn);
      }

      // insight status を accepted に
      setInsights((prev) =>
        prev.map((i) => (i.id === insight.id ? { ...i, status: "accepted" as const } : i))
      );

      setToast("グラフに追加しました");
      setTimeout(() => setToast(null), 1500);
    },
    [currentSessionId]
  );

  const handleDismissInsight = useCallback((id: string) => {
    setInsights((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "dismissed" as const } : i))
    );
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setStreamingContent("");
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(), session_id: currentSessionId ?? "",
      role: "user" as const, content: text, created_at: new Date().toISOString(),
    }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, message: text,
          context: connectionId ? { connectionId } : undefined }),
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
          if (event === "session") { setCurrentSessionId(data.sessionId); }
          else if (event === "delta") { setStreamingContent(data.content); }
          else if (event === "done") {
            setMessages((prev) => {
              const lastStreamed = mockDb.chatMessages
                .listBySession(currentSessionId ?? "").filter((m) => m.role === "assistant").pop();
              if (lastStreamed) {
                return [...prev, { id: lastStreamed.id, session_id: currentSessionId ?? "",
                  role: "assistant" as const, content: lastStreamed.content, created_at: lastStreamed.created_at }];
              }
              return prev;
            });
            setStreamingContent("");
          }
        }
      }
    } catch (err) { console.error("Chat send error:", err); }
    finally { setSending(false); }
  }, [sending, currentSessionId, connectionId]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    sendMessage(text);
  }, [input, sendMessage]);

  const handleSuggestSelect = useCallback((text: string) => {
    setSuggestDismissed(true);
    sendMessage(text);
  }, [sendMessage]);

  const handleFollowUpSelect = useCallback((text: string) => {
    setFollowUpDismissed(true);
    setFollowUpShown(false);
    sendMessage(text);
  }, [sendMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* トースト */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-[12px] z-50"
          style={{
            background: "var(--text-primary)",
            color: "var(--bg-primary)",
          }}
        >
          {toast}
        </div>
      )}

      <ContextHeader ideaFrom={contextIdeas.from} ideaTo={contextIdeas.to} connection={contextIdeas.connection} />

      {/* 単体メモ深掘りのコンテキストヘッダー */}
      {ideaId && contextIdeas.from && !contextIdeas.connection && (
        <div className="mx-4 mb-2 rounded-lg px-3 py-2.5"
          style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--border-light)" }}>
          <p className="text-[10px] mb-0.5" style={{ color: "var(--text-muted)" }}>深掘り対象</p>
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
            {(contextIdeas.from.graph_label || contextIdeas.from.summary).slice(0, 30)}
            {(contextIdeas.from.graph_label || contextIdeas.from.summary).length > 30 ? "…" : ""}
          </p>
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

        {/* 初期サジェスト */}
        {messages.filter((m) => m.role === "user").length === 0 && (connectionId || contextIdeas.connection) && !suggestDismissed && (
          <SuggestButtons type="initial" onSelect={handleSuggestSelect} />
        )}

        {/* フォローアップサジェスト */}
        {followUpShown && !followUpDismissed && !sending && (
          <SuggestButtons type="followUp" onSelect={handleFollowUpSelect} />
        )}
      </div>

      {/* 気づき候補カード */}
      {insights.filter((i) => i.status === "suggested").length > 0 && (
        <div className="px-4 pb-3 animate-page-enter">
          <p className="text-[13px] mb-2" style={{ color: "var(--text-primary)" }}>
            新しい気づき
          </p>
          <div className="space-y-2">
            {insights
              .filter((i) => i.status === "suggested")
              .map((insight) => (
                <div
                  key={insight.id}
                  className="rounded-lg p-3"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "0.5px solid var(--border-light)",
                  }}
                >
                  <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {insight.summary}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>
                    {insight.full_text}
                  </p>
                  <div className="flex items-center justify-end gap-4 mt-2">
                    <button
                      onClick={() => handleAddToGraph(insight)}
                      className="text-[11px]"
                      style={{ color: "var(--accent)" }}
                    >
                      ノードに追加
                    </button>
                    <button
                      onClick={() => handleDismissInsight(insight.id)}
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 入力フィールド */}
      <div className="px-4 pb-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <div
          className="flex items-center gap-2 rounded-3xl px-4 py-2.5"
          style={{ background: "var(--bg-tertiary)" }}
        >
          {/* まとめるボタン */}
          {messages.filter((m) => m.role === "assistant").length >= 6 && currentSessionId && (
            <button
              onClick={() => fetchInsights(currentSessionId)}
              className="text-[11px] flex-none"
              style={{ color: "var(--text-muted)" }}
              disabled={insightLoading}
            >
              {insightLoading ? "..." : "まとめる"}
            </button>
          )}
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
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9L15 3L9 15L8 10L3 9Z" stroke="currentColor" strokeWidth="0.7" strokeLinejoin="round" />
            </svg>
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
  const ideaId = searchParams.get("idea") ?? undefined;

  const hasContext = connectionId || sessionId || ideaId;

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      <AppHeader showBack />

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {hasContext ? (
          <ChatView sessionId={sessionId} connectionId={connectionId} ideaId={ideaId} />
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
