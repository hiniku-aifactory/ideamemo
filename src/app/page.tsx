"use client";

import { useAuth } from "@/components/auth-provider";
import { Mic } from "lucide-react";

export default function HomePage() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <div
          className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </main>
    );
  }

  if (!user) {
    // Mock mode without login — show redirect hint
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-12 pb-4">
        <h1
          className="text-xl font-light"
          style={{
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
            color: "var(--text-primary)",
          }}
        >
          ideamemo
        </h1>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
          style={{
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          ログアウト
        </button>
      </header>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          まだメモがありません
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          下のボタンをタップして、最初のアイデアを録音しましょう
        </p>
      </div>

      {/* FAB — Recording button (DESIGN.md §4-1) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <button
          className="relative flex items-center justify-center w-16 h-16 rounded-full transition-colors"
          style={{ background: "var(--accent-dim)" }}
        >
          <Mic size={24} style={{ color: "var(--text-primary)" }} />
        </button>
      </div>
    </main>
  );
}
