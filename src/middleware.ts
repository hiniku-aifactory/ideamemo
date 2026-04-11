import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Mock mode or Supabase未設定: skip all auth checks
  if (process.env.NEXT_PUBLIC_MOCK_MODE === "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.next();
  }

  const { updateSession } = await import("@/lib/supabase/middleware");
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|api/auth).*)",
  ],
};
