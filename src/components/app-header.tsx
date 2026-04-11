"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AppHeaderProps {
  showBack?: boolean;
  title?: string;
  rightContent?: React.ReactNode;
}

// 幾何学モチーフ: 同心円 + 十字線（30px）
function GeometricLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <circle cx="15" cy="15" r="14" stroke="#E0E0E0" strokeWidth="0.5" />
      <circle cx="15" cy="15" r="9" stroke="#E0E0E0" strokeWidth="0.5" />
      <circle cx="15" cy="15" r="4" stroke="#E0E0E0" strokeWidth="0.5" />
      <line x1="15" y1="0" x2="15" y2="30" stroke="#E0E0E0" strokeWidth="0.5" />
      <line x1="0" y1="15" x2="30" y2="15" stroke="#E0E0E0" strokeWidth="0.5" />
    </svg>
  );
}

// ← 戻るアイコン（22px）
function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M14 4L8 11L14 18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ハンバーガーメニュー（22px）
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <line x1="3" y1="6" x2="19" y2="6" stroke="#BBBBBB" strokeWidth="1" />
      <line x1="3" y1="11" x2="19" y2="11" stroke="#BBBBBB" strokeWidth="1" />
      <line x1="3" y1="16" x2="19" y2="16" stroke="#BBBBBB" strokeWidth="1" />
    </svg>
  );
}

const MENU_ITEMS = [
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
      style={{
        paddingTop: "calc(12px + env(safe-area-inset-top))",
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--bg-primary)",
      }}
    >
      {/* 左: 戻る or ロゴ（ロゴタップで / に遷移） */}
      <div className="flex items-center gap-2">
        {showBack ? (
          <button onClick={() => router.back()} style={{ color: "var(--text-secondary)" }}>
            <BackArrow />
          </button>
        ) : (
          <button onClick={() => router.push("/")} aria-label="ホームに戻る">
            <GeometricLogo />
          </button>
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
