import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";

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

    if (MOCK_MODE) {
      mockDb.connections.updateFeedback(id, feedback);
      return NextResponse.json({ ok: true });
    }

    // TODO: Supabase update
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Feedback] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
