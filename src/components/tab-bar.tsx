"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

// ホーム: 4つの正方形グリッド
function GridIcon({ active }: { active: boolean }) {
  const color = active ? "#222222" : "#CCCCCC";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1" stroke={color} strokeWidth="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" stroke={color} strokeWidth="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" stroke={color} strokeWidth="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" stroke={color} strokeWidth="1" />
    </svg>
  );
}

// 録音: 円の中に塗り円
function RecordIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="19" stroke="#222222" strokeWidth="1" />
      <circle cx="20" cy="20" r="8" fill="#222222" />
    </svg>
  );
}

// グラフ: 3つの円 + 接続線
function GraphIcon({ active }: { active: boolean }) {
  const color = active ? "#222222" : "#CCCCCC";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <line x1="6" y1="6" x2="14" y2="6" stroke={color} strokeWidth="0.7" />
      <line x1="14" y1="6" x2="10" y2="15" stroke={color} strokeWidth="0.7" />
      <circle cx="6" cy="6" r="3" stroke={color} strokeWidth="1" fill="none" />
      <circle cx="14" cy="6" r="3" stroke={color} strokeWidth="1" fill="none" />
      <circle cx="10" cy="15" r="3" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

const HIDDEN_PATHS = ["/login", "/onboarding"];

export function TabBar() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) return null;

  const isHome = pathname === "/";
  const isRecord = pathname.startsWith("/record");
  const isGraph = pathname === "/graph";

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        <Link href="/" className="bottom-nav-item">
          <GridIcon active={isHome} />
        </Link>

        <Link href="/record?auto=true" className="bottom-nav-item">
          <RecordIcon />
        </Link>

        <Link href="/graph" className="bottom-nav-item">
          <GraphIcon active={isGraph || isRecord} />
        </Link>
      </div>
    </nav>
  );
}
