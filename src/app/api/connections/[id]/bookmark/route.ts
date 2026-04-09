import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    if (MOCK_MODE) {
      const bookmarked = mockDb.connections.toggleBookmark(id);
      return NextResponse.json({ bookmarked });
    }

    // TODO: Supabase実装
    return NextResponse.json({ bookmarked: false });
  } catch (error) {
    console.error("Bookmark toggle error:", error);
    return NextResponse.json(
      { error: "Failed to toggle bookmark" },
      { status: 500 }
    );
  }
}
