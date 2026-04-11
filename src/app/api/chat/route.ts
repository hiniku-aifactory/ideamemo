import { NextRequest } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";
import { MOCK_CHAT_RESPONSES, MOCK_INITIAL_MESSAGE } from "@/lib/mock/chat";

// --- P4 リアルモード用定数・ヘルパー ---
// docs/prompts/P4_deepdive_chat.md から引用

const MAX_TURNS = 5;

interface ChatContext {
  memo: {
    summary: string;
    abstract_principle: string;
    latent_question: string;
  };
  connection: {
    title: string;
    description: string;
  };
}

// P4 systemプロンプト（ターン別振る舞い込み）
function buildDeepDiveSystemPrompt(context: ChatContext, currentTurn: number): string {
  return `あなたはユーザーの気づきと外部知識の接続を一緒に掘り下げる相棒。

# 今回の接続
元メモ: ${context.memo.summary}
元メモの本質: ${context.memo.abstract_principle}
元メモの問い: ${context.memo.latent_question}
外部知識: ${context.connection.title}
接続内容: ${context.connection.description}

# 口調
- 知的な友達が飲みながら話す感じ。論文調禁止
- 断定調。「〜かもしれません」「〜と考えられます」禁止
- 1応答は3-5文。長くても7文まで。箇条書き禁止
- 禁止ワード: 「原理」「メカニズム」「示唆する」「提唱した」「いい質問ですね」「おっしゃる通り」

# ターン管理
このチャットは最大5ターン（ユーザー発言5回）。
現在 ${currentTurn}/5 ターン目。

## ターン別の振る舞い

ターン1-2:
- ユーザーの質問に正面から答える
- 具体的な事実・事例・数字を含める
- 必要に応じてWeb検索で追加事例を探す
- 「他にもある」と匂わせて次の質問を誘う

ターン3-4:
- ユーザーが聞いてない角度から1つ事実をぶつける
- 「ちなみに逆の事例もあって」「これ、別の見方をすると」で切り出す
- ユーザーの元メモの文脈に引き寄せる発言を1つ入れる

ターン5（最終）:
- ここまでの会話を2文で要約
- 元メモの気づきが「今どう見えるか」を1文で問いかける（答えは求めない）
- 末尾に区切りメッセージを付ける:
  「──\nこのチャットはここまで。新しいメモを録って、また別の角度から掘ってみよう。」

# 品質チェック（毎ターン出力前に自問）
1. この1文を友達にLINEで送れるか？ → 送れないなら硬すぎる
2. 事実か意見か？ → 事実ベースで話す。意見は「個人的には」と前置きする
3. ユーザーの元メモと繋がってるか？ → 繋がってないなら脱線してる
4. 数字や期間を断定してないか？ → 根拠がないなら「体感だけど」と前置きする`;
}

// P4 初期メッセージ生成用systemプロンプト
const INITIAL_MESSAGE_SYSTEM = `初期メッセージを生成してください。

# 構成
1. 接続カードの内容を1文で要約（カードのdescriptionをそのまま繰り返すな。別の切り口で）
2. この接続から広がる3つの問いを提示。ユーザーが1つ選んでタップできる形式

# 問いの設計ルール
- 3つの問いは異なる角度から:
  - Why系: 「なぜそうなるのか」の深掘り
  - Where系: 「他にどこで同じことが起きてるか」の横展開
  - So-what系: 「これが正しいなら何が言えるか」の応用
- 各問いは15-25字。疑問文で
- ユーザーが「どれも面白そう」と思える粒度。1つだけ明らかにつまらない、はNG

# 出力JSON
{
  "greeting": "接続の要約1文",
  "questions": [
    {"type": "why", "text": "なぜ〜なのか？"},
    {"type": "where", "text": "他にどこで〜？"},
    {"type": "so_what", "text": "これが本当なら〜？"}
  ]
}`;

// メッセージ内容から検索が必要か判定
function shouldSearch(message: string, currentTurn: number): boolean {
  if (currentTurn >= MAX_TURNS) return false;
  const triggers = ["他に", "例えば", "本当に", "ソース", "事例", "具体的に", "もっと", "他の"];
  return triggers.some((t) => message.includes(t));
}

// contextからChatContextを構築（mockDbから情報取得）
function buildChatContext(connectionId: string | undefined): ChatContext | null {
  if (!connectionId) return null;
  const conn = mockDb.connections.get(connectionId);
  if (!conn) return null;
  const idea = mockDb.ideas.get(conn.idea_from_id);
  return {
    memo: {
      summary: idea?.summary ?? "",
      abstract_principle: idea?.abstract_principle ?? "",
      latent_question: idea?.latent_question ?? "",
    },
    connection: {
      title: conn.external_knowledge_title ?? "",
      description: conn.external_knowledge_summary ?? "",
    },
  };
}

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

            if (context.connectionId) {
              const conn = mockDb.connections.get(context.connectionId);
              if (conn) {
                contextSummary = conn.reason.slice(0, 80);
                ideaId = conn.idea_from_id;
              }
            }

            // セッション作成（モード問わずmockDbに保存）
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

            // 初回メッセージを送信
            send("session", { sessionId: currentSessionId });

            if (MOCK_MODE) {
              // モックモード: 固定メッセージを保存して送信
              mockDb.chatMessages.insert({
                id: crypto.randomUUID(),
                session_id: currentSessionId,
                role: "assistant",
                content: MOCK_INITIAL_MESSAGE,
                created_at: now,
              });
              send("message", { role: "assistant", content: MOCK_INITIAL_MESSAGE });
            } else {
              // リアルモード: P4初期メッセージ生成
              const chatContext = buildChatContext(context.connectionId);
              if (chatContext && process.env.ANTHROPIC_API_KEY) {
                const { default: Anthropic } = await import("@anthropic-ai/sdk");
                const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
                const initRes = await anthropic.messages.create({
                  model: "claude-sonnet-4-20250514",
                  max_tokens: 400,
                  system: INITIAL_MESSAGE_SYSTEM,
                  messages: [
                    {
                      role: "user",
                      content: `元メモ: ${chatContext.memo.summary}\n本質: ${chatContext.memo.abstract_principle}\n問い: ${chatContext.memo.latent_question}\n外部知識: ${chatContext.connection.title}\n接続内容: ${chatContext.connection.description}`,
                    },
                  ],
                });
                const initText = (initRes.content[0] as { type: string; text: string }).text.trim();
                const initJson = initText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                const initParsed = JSON.parse(initJson) as {
                  greeting: string;
                  questions: { type: string; text: string }[];
                };
                const formatted = `${initParsed.greeting}\n\n${initParsed.questions.map((q) => `・${q.text}`).join("\n")}`;

                mockDb.chatMessages.insert({
                  id: crypto.randomUUID(),
                  session_id: currentSessionId,
                  role: "assistant",
                  content: formatted,
                  created_at: now,
                });
                send("message", { role: "assistant", content: formatted });
              } else {
                send("message", { role: "assistant", content: MOCK_INITIAL_MESSAGE });
              }
            }
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
              // リアルモード: Claude Sonnet ストリーミング（P4）
              if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
              const { default: Anthropic } = await import("@anthropic-ai/sdk");
              const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

              // ターン数チェック
              const existingMsgs = mockDb.chatMessages.listBySession(currentSessionId);
              const userMsgCount = existingMsgs.filter((m) => m.role === "user").length;

              if (userMsgCount >= MAX_TURNS) {
                send("error", { code: "CHAT_LIMIT", message: "このチャットは5ターンで区切りです" });
                send("done", {});
                return;
              }

              const currentTurn = userMsgCount + 1;

              // contextからsystem prompt構築
              const chatContext = buildChatContext(context?.connectionId);
              if (!chatContext) throw new Error("Chat context not found");
              const systemPrompt = buildDeepDiveSystemPrompt(chatContext, currentTurn);

              // 検索が必要か判定
              let extraContext = "";
              if (shouldSearch(message, currentTurn)) {
                const { groundingSearchWithText } = await import("@/lib/ai/gemini");
                const query = `${message} ${chatContext.connection.title}`;
                const { text } = await groundingSearchWithText(query.slice(0, 200));
                if (text) extraContext = `\n\n[参考情報]\n${text.slice(0, 400)}`;
              }

              // 会話履歴構築
              const history = existingMsgs.map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              }));
              history.push({ role: "user", content: message + extraContext });

              // ストリーミング
              const stream = anthropic.messages.stream({
                model: "claude-sonnet-4-20250514",
                max_tokens: 800,
                system: systemPrompt,
                messages: history,
              });

              let fullResponse = "";
              for await (const event of stream) {
                if (
                  event.type === "content_block_delta" &&
                  event.delta.type === "text_delta"
                ) {
                  fullResponse += event.delta.text;
                  send("delta", { content: fullResponse });
                }
              }

              // AI応答保存
              mockDb.chatMessages.insert({
                id: crypto.randomUUID(),
                session_id: currentSessionId,
                role: "assistant",
                content: fullResponse,
                created_at: new Date().toISOString(),
              });
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
