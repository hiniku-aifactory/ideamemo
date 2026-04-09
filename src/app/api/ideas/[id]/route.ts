import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (MOCK_MODE) {
      mockDb.ideas.delete(id);
      mockDb.connections.deleteByIdea(id);
      mockDb.chatSessions.deleteByIdea(id);
      return NextResponse.json({ ok: true });
    }

    // TODO: Supabase CASCADE削除
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Delete] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
