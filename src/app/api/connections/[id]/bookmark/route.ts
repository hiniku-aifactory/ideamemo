import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Supabase未接続のためmockDbを常時使用
    const bookmarked = mockDb.connections.toggleBookmark(id);
    return NextResponse.json({ bookmarked });
  } catch (error) {
    console.error("Bookmark toggle error:", error);
    return NextResponse.json(
      { error: "Failed to toggle bookmark" },
      { status: 500 }
    );
  }
}
