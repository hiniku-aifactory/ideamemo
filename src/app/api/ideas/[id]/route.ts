import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Supabase未接続のためmockDbを常時使用
    mockDb.ideas.delete(id);
    mockDb.connections.deleteByIdea(id);
    mockDb.chatSessions.deleteByIdea(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Delete] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
