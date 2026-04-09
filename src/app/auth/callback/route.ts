import { NextResponse } from "next/server";
import { MOCK_MODE } from "@/lib/mock/data";
import { mockDb } from "@/lib/mock/db";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // モックモード: personas未設定ならオンボーディングへ
  if (MOCK_MODE) {
    const settings = mockDb.userSettings.get("mock-user-001");
    if (!settings?.personas?.length) {
      return NextResponse.redirect(new URL("/onboarding", origin));
    }
    return NextResponse.redirect(new URL("/", origin));
  }

  // リアルモード: TODO Supabaseでuser_settings.personasをチェック
  return NextResponse.redirect(new URL("/", origin));
}
