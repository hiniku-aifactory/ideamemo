"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AppHeaderProps {
  showBack?: boolean;
  title?: string;
  rightContent?: React.ReactNode;
}

// 幾何学モチーフ: 同心円 + 十字線
function GeometricLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke="#E0E0E0" strokeWidth="0.5" />
      <circle cx="14" cy="14" r="8" stroke="#E0E0E0" strokeWidth="0.5" />
      <circle cx="14" cy="14" r="3" stroke="#E0E0E0" strokeWidth="0.5" />
      <line x1="14" y1="0" x2="14" y2="28" stroke="#E0E0E0" strokeWidth="0.5" />
      <line x1="0" y1="14" x2="28" y2="14" stroke="#E0E0E0" strokeWidth="0.5" />
    </svg>
  );
}

// ← 戻るアイコン
function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ハンバーガーメニュー
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <line x1="3" y1="5" x2="17" y2="5" stroke="#BBBBBB" strokeWidth="1" />
      <line x1="3" y1="10" x2="17" y2="10" stroke="#BBBBBB" strokeWidth="1" />
      <line x1="3" y1="15" x2="17" y2="15" stroke="#BBBBBB" strokeWidth="1" />
    </svg>
  );
}

const MENU_ITEMS = [
  { label: "Folders", href: "/folders" },
  { label: "Bookmarks", href: "/bookmarks" },
  { label: "Settings", href: "/settings" },
  { label: "About", href: "/about" },
];

export function AppHeader({ showBack = false, title, rightContent }: AppHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="flex-none flex items-center justify-between px-5 pb-3"
      style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
    >
      {/* 左: 戻る or ロゴ */}
      <div className="flex items-center gap-2">
        {showBack ? (
          <button onClick={() => router.back()} style={{ color: "var(--text-secondary)" }}>
            <BackArrow />
          </button>
        ) : (
          <GeometricLogo />
        )}
      </div>

      {/* 中央: タイトル */}
      {title && (
        <span
          className="text-[14px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </span>
      )}

      {/* 右: カスタムコンテンツ or ハンバーガー */}
      <div className="flex items-center gap-2">
        {rightContent}
        <button onClick={() => setMenuOpen(!menuOpen)} className="relative">
          <MenuIcon />
        </button>
      </div>

      {/* ドロップダウンメニュー */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed right-5 z-50 rounded-lg overflow-hidden shadow-sm"
            style={{
              top: "calc(44px + env(safe-area-inset-top))",
              background: "var(--bg-secondary)",
              border: "0.5px solid var(--border-light)",
            }}
          >
            {MENU_ITEMS.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-[13px]"
                style={{
                  color: "var(--text-body)",
                  borderBottom: i < MENU_ITEMS.length - 1 ? "0.5px solid var(--border-light)" : "none",
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </header>
  );
}
