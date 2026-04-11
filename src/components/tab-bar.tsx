"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useRecording } from "@/components/recording-context";

// ホーム: 4つの正方形グリッド
function GridIcon({ active }: { active: boolean }) {
  const color = active ? "#222222" : "#CCCCCC";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="2" width="8" height="8" rx="1" stroke={color} strokeWidth="1" />
      <rect x="12" y="2" width="8" height="8" rx="1" stroke={color} strokeWidth="1" />
      <rect x="2" y="12" width="8" height="8" rx="1" stroke={color} strokeWidth="1" />
      <rect x="12" y="12" width="8" height="8" rx="1" stroke={color} strokeWidth="1" />
    </svg>
  );
}

// 録音ボタン: 56px、録音中は停止アイコンに変化
function RecordIcon({ recording }: { recording: boolean }) {
  return (
    <div className="relative">
      {/* 録音中パルスリング */}
      {recording && (
        <div
          className="absolute -inset-1 rounded-full animate-pulse"
          style={{ background: "rgba(34, 34, 34, 0.06)" }}
        />
      )}
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="28" cy="28" r="27" stroke="#222222" strokeWidth="1" />
        {recording ? (
          // 録音中: 停止アイコン（角丸四角）
          <rect x="20" y="20" width="16" height="16" rx="2" fill="#222222" />
        ) : (
          // 待機中: 録音アイコン（塗り円）
          <circle cx="28" cy="28" r="10" fill="#222222" />
        )}
      </svg>
    </div>
  );
}

// グラフ: 3つの円 + 接続線
function GraphIcon({ active }: { active: boolean }) {
  const color = active ? "#222222" : "#CCCCCC";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <line x1="7" y1="7" x2="15" y2="7" stroke={color} strokeWidth="0.7" />
      <line x1="15" y1="7" x2="11" y2="16" stroke={color} strokeWidth="0.7" />
      <circle cx="7" cy="7" r="3" stroke={color} strokeWidth="1" fill="none" />
      <circle cx="15" cy="7" r="3" stroke={color} strokeWidth="1" fill="none" />
      <circle cx="11" cy="16" r="3" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}

const HIDDEN_PATHS = ["/login", "/onboarding"];

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isRecording, requestStop } = useRecording();

  if (HIDDEN_PATHS.includes(pathname)) return null;

  const isHome = pathname === "/";
  const isRecord = pathname.startsWith("/record");
  const isGraph = pathname === "/graph";

  const handleRecordTap = () => {
    if (isRecording) {
      requestStop();
    } else {
      router.push("/record?auto=true");
    }
  };

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        <Link href="/" className="bottom-nav-item">
          <GridIcon active={isHome} />
        </Link>

        <button onClick={handleRecordTap} className="bottom-nav-item">
          <RecordIcon recording={isRecording} />
        </button>

        <Link href="/graph" className="bottom-nav-item">
          <GraphIcon active={isGraph || isRecord} />
        </Link>
      </div>
    </nav>
  );
}
