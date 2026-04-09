"use client";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LimitModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="mx-8 p-6 rounded-xl max-w-sm" style={{ background: "var(--bg-secondary)" }}>
        <p className="text-base font-medium text-center" style={{ color: "var(--text-primary)" }}>
          メモの上限に達しました
        </p>
        <p className="text-sm mt-3 text-center leading-relaxed" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          現在のバージョンでは
          <br />
          20件まで保存できます
        </p>
        <p className="text-sm mt-3 text-center" style={{ color: "var(--text-secondary)" }}>
          もっと使いたい方は
          <br />
          フィードバックをお寄せください
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <a
            href="mailto:hiniku.aifactory@gmail.com"
            className="block w-full py-2.5 rounded-lg text-sm text-center"
            style={{ background: "var(--accent)", color: "#0A0A0A" }}
          >
            メールで連絡する
          </a>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
