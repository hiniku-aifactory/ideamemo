import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";
import { MOCK_COMBINE_RESULTS } from "@/lib/mock/combine";
import type { Connection } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { ideaAId, ideaBId } = await request.json();

    if (!ideaAId || !ideaBId) {
      return NextResponse.json({ error: "Both idea IDs required" }, { status: 400 });
    }

    const ideaA = mockDb.ideas.get(ideaAId);
    const ideaB = mockDb.ideas.get(ideaBId);

    if (!ideaA || !ideaB) {
      return NextResponse.json({ error: "Ideas not found" }, { status: 404 });
    }

    let result;
    if (MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 1500));
      result = MOCK_COMBINE_RESULTS[Math.floor(Math.random() * MOCK_COMBINE_RESULTS.length)];
    } else {
      // TODO: Claude Sonnet 掛け合わせ生成
      return NextResponse.json({ error: "Real mode not implemented" }, { status: 501 });
    }

    const conn: Connection = {
      id: crypto.randomUUID(),
      idea_from_id: ideaAId,
      idea_to_id: ideaBId,
      connection_type: "combination",
      source: "combination",
      persona_label: null,
      reason: result.reason,
      action_suggestion: result.action_suggestion,
      quality_score: result.quality_score,
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

    if (MOCK_MODE) {
      mockDb.connections.insert(conn);
    }

    return NextResponse.json({
      connection: conn,
      ideaA: { summary: ideaA.summary },
      ideaB: { summary: ideaB.summary },
    });
  } catch (error) {
    console.error("[Combine] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
