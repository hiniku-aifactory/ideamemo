"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
// BackArrow SVG
function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
import { MOCK_MODE, MOCK_USER } from "@/lib/mock/data";
import { mockDb } from "@/lib/mock/db";
import { PersonaSelector } from "@/components/persona-selector";

export default function SettingsPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (MOCK_MODE) {
      const settings = mockDb.userSettings.get("mock-user-001");
      setPersonas(settings?.personas ?? []);
    }
  }, []);

  const handlePersonaChange = useCallback((newPersonas: string[]) => {
    if (newPersonas.length === 0) {
      setToast("最低1つ選んでください");
      setTimeout(() => setToast(null), 1500);
      return;
    }

    setPersonas(newPersonas);

    // debounce保存
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (MOCK_MODE) {
        mockDb.userSettings.update("mock-user-001", { personas: newPersonas });
      }
    }, 500);
  }, []);

  const handleLogout = () => {
    if (!confirm("ログアウトしますか？")) return;

    if (MOCK_MODE) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("mock-auth");
      }
    }
    router.push("/login");
  };

  const email = MOCK_MODE ? MOCK_USER.email : "";

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 pb-4"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.back()}
          style={{ color: "var(--text-secondary)" }}
        >
          <BackArrow />
        </button>
        <h1
          className="text-lg font-light"
          style={{ color: "var(--text-primary)" }}
        >
          設定
        </h1>
      </header>

      <div className="flex-1 px-6 pb-28 space-y-6">
        {/* ペルソナ */}
        <section>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>ペルソナ</p>
          <PersonaSelector
            selected={personas}
            onChange={handlePersonaChange}
            minSelect={1}
          />
        </section>

        {/* アカウント */}
        <section>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>アカウント</p>
          <div
            className="p-4 rounded-xl"
            style={{ background: "var(--bg-secondary)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              {email}
            </p>
          </div>
        </section>

        {/* ログアウト */}
        <button
          onClick={handleLogout}
          className="w-full p-4 rounded-xl text-left text-sm"
          style={{ background: "var(--bg-secondary)", color: "var(--error)" }}
        >
          ログアウト
        </button>

        {/* 利用規約 / プライバシーポリシー */}
        <div className="space-y-2">
          <button
            className="w-full p-4 rounded-xl text-left text-sm"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          >
            利用規約
          </button>
          <button
            className="w-full p-4 rounded-xl text-left text-sm"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          >
            プライバシーポリシー
          </button>
        </div>

        {/* バージョン */}
        <p
          className="text-center text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          v1.0.0
        </p>
      </div>

      {/* トースト */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-3xl text-sm animate-page-enter"
          style={{ background: "var(--error)", color: "#fff" }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
