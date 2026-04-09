"use client";

import { AppHeader } from "@/components/app-header";

export default function AboutPage() {
  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      <AppHeader showBack title="About" />

      <div className="flex-1 flex flex-col items-center px-5 pb-28" style={{ paddingTop: "10vh" }}>
        {/* 幾何学モチーフ */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="38" stroke="#E0E0E0" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="24" stroke="#E0E0E0" strokeWidth="0.5" />
          <circle cx="40" cy="40" r="10" stroke="#E0E0E0" strokeWidth="0.5" />
          <line x1="40" y1="0" x2="40" y2="80" stroke="#E0E0E0" strokeWidth="0.5" />
          <line x1="0" y1="40" x2="80" y2="40" stroke="#E0E0E0" strokeWidth="0.5" />
        </svg>

        <h1
          className="mt-6 text-[18px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          ideamemo
        </h1>

        <p
          className="mt-1 text-[11px]"
          style={{ color: "var(--text-muted)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
        >
          v1.0.0
        </p>

        <p
          className="mt-4 text-[13px] text-center"
          style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}
        >
          声で気づきを貯める。AIが外の知識と紐づける。
        </p>

        {/* リンク */}
        <div className="mt-10 w-full max-w-xs space-y-0">
          {[
            { label: "Terms", href: "#" },
            { label: "Privacy", href: "#" },
            { label: "Contact", href: "#" },
          ].map((item, i) => (
            <a
              key={item.label}
              href={item.href}
              className="block py-3 text-[13px]"
              style={{
                color: "var(--accent)",
                borderBottom: i < 2 ? "0.5px solid var(--border-light)" : "none",
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
