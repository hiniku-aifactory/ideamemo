"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { MOCK_MODE } from "@/lib/mock/data";
import { mockDb } from "@/lib/mock/db";

const PERSONAS = [
  { id: "builder", emoji: "\u{1F3D7}", label: "\u4F55\u304B\u3092", sublabel: "\u4F5C\u3063\u3066\u3044\u308B", desc: "\u8D77\u696D\u3001\u958B\u767A\u3001\u5236\u4F5C" },
  { id: "grower", emoji: "\u{1F4C8}", label: "\u4F55\u304B\u3092", sublabel: "\u4F38\u3070\u3057\u3066\u3044\u308B", desc: "\u30DE\u30FC\u30B1\u3001\u55B6\u696D\u3001\u904B\u7528" },
  { id: "researcher", emoji: "\u{1F52C}", label: "\u4F55\u304B\u3092", sublabel: "\u6DF1\u3081\u3066\u3044\u308B", desc: "\u7814\u7A76\u3001\u5B66\u7FD2\u3001\u5C02\u9580\u8077" },
  { id: "creator", emoji: "\u{1F3A8}", label: "\u4F55\u304B\u3092", sublabel: "\u8868\u73FE\u3057\u3066\u3044\u308B", desc: "\u30C7\u30B6\u30A4\u30F3\u3001\u6587\u7AE0\u3001\u97F3\u697D" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function togglePersona(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (selected.length === 0) return;

    if (MOCK_MODE) {
      mockDb.userSettings.update("mock-user-001", { personas: selected });
    }
    // TODO: Supabase update

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
      <div className="grid grid-cols-2 gap-3">
        {PERSONAS.map((persona) => {
          const isSelected = selected.includes(persona.id);
          return (
            <button
              key={persona.id}
              onClick={() => togglePersona(persona.id)}
              className="relative text-left rounded-xl p-4 transition-transform duration-150 ease-out"
              style={{
                background: "var(--bg-secondary)",
                border: `2px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                transform: isSelected ? "scale(1)" : undefined,
                minHeight: "100px",
              }}
              onPointerDown={(e) => {
                const target = e.currentTarget;
                target.style.transform = "scale(0.97)";
              }}
              onPointerUp={(e) => {
                const target = e.currentTarget;
                target.style.transform = "scale(1)";
              }}
              onPointerLeave={(e) => {
                const target = e.currentTarget;
                target.style.transform = "scale(1)";
              }}
            >
              {/* チェックマーク */}
              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "var(--bg-secondary)" }}
                >
                  <Check size={16} style={{ color: "var(--accent)" }} />
                </div>
              )}

              <span className="text-[28px] block">{persona.emoji}</span>
              <span
                className="text-base font-bold block mt-2"
                style={{ color: "var(--text-primary)" }}
              >
                {persona.sublabel}
              </span>
              <span
                className="text-[11px] block mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {persona.desc}
              </span>
            </button>
          );
        })}
      </div>

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
        <p
          className="text-center text-xs mt-3"
          style={{ color: "var(--text-muted)" }}
        >
          あとから変えられます
        </p>
      </div>
    </main>
  );
}
