"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOCK_MODE } from "@/lib/mock/data";
import { mockDb } from "@/lib/mock/db";
import { PersonaSelector } from "@/components/persona-selector";

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  async function handleSubmit() {
    if (selected.length === 0) return;

    if (MOCK_MODE) {
      mockDb.userSettings.update("mock-user-001", { personas: selected });
    }

    router.push("/record?auto=true");
  }

  return (
    <main
      className="flex flex-col min-h-dvh px-6 animate-page-enter"
      style={{ paddingTop: "calc(60px + env(safe-area-inset-top, 0px))" }}
    >
      {/* Title */}
      <div className="mb-8">
        <h1
          className="text-2xl font-light leading-relaxed"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
          }}
        >
          あなたの日常に
          <br />
          一番近いのは?
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          いくつでも選べます
        </p>
      </div>

      {/* 2x2 Grid */}
      <PersonaSelector selected={selected} onChange={setSelected} minSelect={0} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* CTA */}
      <div className="pb-8 pt-6">
        <button
          onClick={handleSubmit}
          disabled={selected.length === 0}
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity"
          style={{
            background: "var(--accent)",
            color: "#0A0A0A",
            opacity: selected.length === 0 ? 0.4 : 1,
            pointerEvents: selected.length === 0 ? "none" : "auto",
            height: "48px",
          }}
        >
          最初のメモを録ろう →
        </button>
        <p className="text-center text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          あとから変えられます
        </p>
      </div>
    </main>
  );
}
