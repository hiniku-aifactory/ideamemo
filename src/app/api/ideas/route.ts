import { NextRequest, NextResponse } from "next/server";
import { transcribe, structure, discoverConnectionSingle } from "@/lib/ai";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";
import { maybeUpdateProfile } from "@/lib/ai/profile";
import type { Idea, Connection } from "@/lib/types";
import type { PersonaId } from "@/lib/personas";

const CONNECTION_COUNT = 3;
const SEARCH_ANGLES = ["business_model", "psychology", "cross_domain"] as const;
const MEMO_LIMIT = 20;

// POST -- Record -> Transcribe -> Structure -> Connect x3 (SSE)
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // 0. メモ上限チェック
        const userId = MOCK_MODE ? "mock-user-001" : "TODO";
        const currentCount = MOCK_MODE
          ? mockDb.ideas.listByUser(userId).length
          : 0;

        if (currentCount >= MEMO_LIMIT) {
          send("error", {
            code: "MEMO_LIMIT_REACHED",
            message: "メモの上限（20件）に達しました",
            retry: false,
          });
          controller.close();
          return;
        }

        // 1. 音声取得
        const formData = await request.formData();
        const audio = formData.get("audio") as File | null;

        if (!audio) {
          send("error", { code: "NO_AUDIO", message: "音声ファイルがありません", retry: false });
          controller.close();
          return;
        }

        if (audio.size > 10 * 1024 * 1024) {
          send("error", { code: "FILE_TOO_LARGE", message: "ファイルサイズが大きすぎます（上限10MB）", retry: false });
          controller.close();
          return;
        }

        // ペルソナ情報を取得
        const personasStr = formData.get("personas") as string | null;
        const personas: PersonaId[] = personasStr ? JSON.parse(personasStr) : ["builder"];

        // 2. 文字起こし
        const transcript = await transcribe(audio);
        send("transcription", { transcript });

        // 3. 構造化
        const structured = await structure(transcript);
        send("structured", structured);

        // 4. アイデア保存
        const ideaId = crypto.randomUUID();
        const now = new Date().toISOString();

        const idea: Idea = {
          id: ideaId,
          user_id: MOCK_MODE ? "mock-user-001" : "TODO",
          transcript,
          summary: structured.summary,
          keywords: structured.keywords,
          abstract_principle: structured.abstract_principle,
          latent_question: structured.latent_question ?? "",
          domain: structured.domain as Idea["domain"],
          audio_url: null,
          folder_id: null,
          folder_name: autoFolderName(structured.domain),
          created_at: now,
        };

        if (MOCK_MODE) {
          mockDb.ideas.insert(idea);
        }

        // 5. 接続発見（常に3件を段階的にSSE送信）
        const primaryPersona = personas[0] ?? "builder";
        for (let i = 0; i < CONNECTION_COUNT; i++) {
          let connResult;
          if (MOCK_MODE) {
            connResult = await discoverConnectionSingle(i);
          } else {
            const { generateConnection } = await import("@/lib/ai/pipeline");
            connResult = await generateConnection({
              summary: structured.summary,
              keywords: structured.keywords,
              abstract_principle: structured.abstract_principle,
              transcript,
              searchAngle: SEARCH_ANGLES[i],
              personaId: primaryPersona,
            });
          }
          if (!connResult) continue;

          const conn: Connection = {
            id: crypto.randomUUID(),
            idea_from_id: ideaId,
            idea_to_id: null,
            connection_type: connResult.connection_type as Connection["connection_type"],
            source: "ai",
            persona_label: connResult.persona_label,
            reason: connResult.reason,
            action_suggestion: connResult.action_suggestion,
            quality_score: connResult.quality_score,
            external_knowledge_title: connResult.external_knowledge_title,
            external_knowledge_url: connResult.external_knowledge_url,
            external_knowledge_summary: connResult.external_knowledge_summary,
            source_idea_summary: connResult.source_idea_summary,
            user_note: null,
            feedback: null,
            feedback_at: null,
            bookmarked: false,
            created_at: now,
          };

          if (MOCK_MODE) {
            mockDb.connections.insert(conn);
          }

          send("connection", {
            id: conn.id,
            title: connResult.title ?? conn.external_knowledge_title ?? "",
            description: connResult.description ?? conn.external_knowledge_summary ?? "",
            source_url: connResult.source_url ?? conn.external_knowledge_url ?? null,
            source_title: connResult.source_title ?? conn.external_knowledge_title ?? null,
            quality_score: conn.quality_score,
            bookmarked: false,
          });
        }

        // プロファイル自動更新チェック（非同期、レスポンスをブロックしない）
        maybeUpdateProfile(userId).catch(console.error);

        send("done", { idea_id: ideaId, folder: idea.folder_name });
      } catch (error) {
        console.error("[A01] Pipeline error:", error);
        send("error", {
          code: "PROCESSING_FAILED",
          message: error instanceof Error ? error.message : "処理中にエラーが発生しました",
          retry: true,
        });
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
}

// GET -- アイデア一覧
export async function GET() {
  if (MOCK_MODE) {
    const ideas = mockDb.ideas.list();
    const ideasWithMeta = ideas.map((idea) => ({
      ...idea,
      connection_count: mockDb.connections.listByIdea(idea.id).length,
    }));
    return NextResponse.json({ ideas: ideasWithMeta, total: ideas.length });
  }

  return NextResponse.json({ ideas: [], total: 0 });
}

function autoFolderName(domain: string): string {
  const map: Record<string, string> = {
    仕事: "仕事",
    生活: "生活",
    趣味: "趣味",
    学び: "学び",
    人間関係: "人間関係",
    その他: "その他",
  };
  return map[domain] ?? "その他";
}
