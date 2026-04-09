import { NextRequest, NextResponse } from "next/server";
import { transcribe, structure, discoverConnection } from "@/lib/ai";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";
import type { Idea, Connection } from "@/lib/types";

// POST — Record → Transcribe → Structure → Connect (SSE)
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
        // 1. Get audio from form data
        const formData = await request.formData();
        const audio = formData.get("audio") as File | null;

        if (!audio) {
          send("error", { code: "NO_AUDIO", message: "音声ファイルがありません", retry: false });
          controller.close();
          return;
        }

        // Validate size (10MB)
        if (audio.size > 10 * 1024 * 1024) {
          send("error", { code: "FILE_TOO_LARGE", message: "ファイルサイズが大きすぎます（上限10MB）", retry: false });
          controller.close();
          return;
        }

        // 2. Transcribe
        const transcript = await transcribe(audio);
        send("transcription", { transcript });

        // 3. Structure
        const structured = await structure(transcript);
        send("structured", structured);

        // 4. Save idea
        const ideaId = crypto.randomUUID();
        const now = new Date().toISOString();

        const idea: Idea = {
          id: ideaId,
          user_id: MOCK_MODE ? "mock-user-001" : "TODO",
          transcript,
          summary: structured.summary,
          keywords: structured.keywords,
          abstract_principle: structured.abstract_principle,
          domain: structured.domain as Idea["domain"],
          audio_url: null,
          folder_id: null,
          folder_name: autoFolderName(structured.domain),
          created_at: now,
        };

        if (MOCK_MODE) {
          mockDb.ideas.insert(idea);
        }
        // TODO: Supabase insert for real mode

        // 5. Discover connection
        const connResult = await discoverConnection();
        if (connResult) {
          const conn: Connection = {
            id: crypto.randomUUID(),
            idea_from_id: ideaId,
            idea_to_id: null,
            connection_type: connResult.connection_type as Connection["connection_type"],
            source: "ai",
            reason: connResult.reason,
            action_suggestion: connResult.action_suggestion,
            quality_score: connResult.quality_score,
            external_knowledge_title: connResult.external_knowledge_title,
            external_knowledge_url: connResult.external_knowledge_url,
            user_note: null,
            created_at: now,
          };

          if (MOCK_MODE) {
            mockDb.connections.insert(conn);
          }

          send("connection", {
            connection_type: conn.connection_type,
            reason: conn.reason,
            action_suggestion: conn.action_suggestion,
            quality_score: conn.quality_score,
            external_knowledge_title: conn.external_knowledge_title,
          });
        }

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

// GET — List ideas
export async function GET() {
  if (MOCK_MODE) {
    const ideas = mockDb.ideas.list();
    return NextResponse.json({ ideas, total: ideas.length });
  }

  // TODO: Supabase query for real mode
  return NextResponse.json({ ideas: [], total: 0 });
}

function autoFolderName(domain: string): string {
  const map: Record<string, string> = {
    仕事: "💼 仕事",
    生活: "🌱 生活",
    趣味: "🎨 趣味",
    学び: "📚 学び",
    人間関係: "🤝 人間関係",
    その他: "📝 その他",
  };
  return map[domain] ?? "📝 その他";
}
