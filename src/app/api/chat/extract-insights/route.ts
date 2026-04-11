import { NextRequest, NextResponse } from "next/server";
import type { ChatInsight } from "@/lib/types";

// POST -- チャットから気づきを抽出（モック版）
export async function POST(request: NextRequest) {
  try {
    const { session_id } = await request.json() as { session_id: string };

    const now = new Date().toISOString();
    const insights: ChatInsight[] = [
      {
        id: `insight-${Date.now()}-1`,
        session_id,
        summary: "コスト変換の原理",
        full_text:
          "社会的コストを物理的動作に変換することで、集団の行動ロックを解除できる。アンドン紐、付箋、スレッドが同じ構造。",
        keywords: ["コスト変換", "行動設計", "ロック解除"],
        status: "suggested",
        created_at: now,
      },
      {
        id: `insight-${Date.now()}-2`,
        session_id,
        summary: "デフォルトの力",
        full_text:
          "行動の選択肢ではなくデフォルトを変えることで、意思決定なしに集団行動が変わる。オプトアウト vs オプトイン。",
        keywords: ["デフォルト", "ナッジ", "選択設計"],
        status: "suggested",
        created_at: now,
      },
    ];

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("[extract-insights] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
