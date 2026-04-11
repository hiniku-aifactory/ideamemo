import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { feedback } = await request.json();

    if (feedback !== "positive" && feedback !== "negative") {
      return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
    }

    // Supabase未接続のためmockDbを常時使用
    mockDb.connections.updateFeedback(id, feedback);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Feedback] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
