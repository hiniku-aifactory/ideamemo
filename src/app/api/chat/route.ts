import { NextRequest } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";
import { MOCK_CHAT_RESPONSES, MOCK_INITIAL_MESSAGE } from "@/lib/mock/chat";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { sessionId, message, context } = await request.json();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          let currentSessionId = sessionId;

          // 新規セッション作成
          if (!currentSessionId && context) {
            currentSessionId = crypto.randomUUID();
            const now = new Date().toISOString();

            // 接続情報からコンテキストサマリーを構築
            let contextSummary = "チャットセッション";
            let ideaId: string | null = null;

            if (context.connectionId && MOCK_MODE) {
              const conn = mockDb.connections.get(context.connectionId);
              if (conn) {
                contextSummary = conn.reason.slice(0, 80);
                ideaId = conn.idea_from_id;
              }
            }

            if (MOCK_MODE) {
              mockDb.chatSessions.create({
                id: currentSessionId,
                user_id: "mock-user-001",
                idea_id: ideaId,
                connection_id: context.connectionId ?? null,
                context_type: "connection",
                context_summary: contextSummary,
                created_at: now,
                updated_at: now,
              });

              // AI初回メッセージ保存
              mockDb.chatMessages.insert({
                id: crypto.randomUUID(),
                session_id: currentSessionId,
                role: "assistant",
                content: MOCK_INITIAL_MESSAGE,
                created_at: now,
              });
            }

            // 初回メッセージを送信
            send("session", { sessionId: currentSessionId });
            send("message", { role: "assistant", content: MOCK_INITIAL_MESSAGE });
          }

          // ユーザーメッセージがある場合
          if (message && currentSessionId) {
            const now = new Date().toISOString();

            if (MOCK_MODE) {
              // ユーザーメッセージ保存
              mockDb.chatMessages.insert({
                id: crypto.randomUUID(),
                session_id: currentSessionId,
                role: "user",
                content: message,
                created_at: now,
              });

              mockDb.chatSessions.updateTimestamp(currentSessionId);

              // モック応答: ストリーミング風にdelayで返す
              const responseText =
                MOCK_CHAT_RESPONSES[
                  Math.floor(Math.random() * MOCK_CHAT_RESPONSES.length)
                ];

              // 文字を段階的に送信
              const chars = responseText.split("");
              let accumulated = "";
              for (let i = 0; i < chars.length; i++) {
                accumulated += chars[i];
                if (i % 3 === 0 || i === chars.length - 1) {
                  send("delta", { content: accumulated });
                  await new Promise((r) => setTimeout(r, 15));
                }
              }

              // AI応答保存
              mockDb.chatMessages.insert({
                id: crypto.randomUUID(),
                session_id: currentSessionId,
                role: "assistant",
                content: responseText,
                created_at: new Date().toISOString(),
              });
            } else {
              // リアルモード: Claude Sonnet ストリーミング
              // TODO: Anthropic SDK streaming
              send("delta", { content: "リアルモードは未実装です。" });
            }
          }

          send("done", {});
        } catch (error) {
          console.error("[Chat] Error:", error);
          send("error", { message: "チャット処理中にエラーが発生しました" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Chat] Parse error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
