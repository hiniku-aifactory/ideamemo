import { NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";

// GET -- 接続一覧
export async function GET() {
  if (MOCK_MODE) {
    const connections = mockDb.connections.list();
    return NextResponse.json({ connections });
  }

  return NextResponse.json({ connections: [] });
}
