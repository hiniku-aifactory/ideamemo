"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useRecording } from "@/components/recording-context";

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
