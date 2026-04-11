"use client";

interface SuggestButtonsProps {
  onSelect: (text: string) => void;
  type: "initial" | "followUp";
}

const SUGGEST_TEMPLATES = {
  initial: [
    { label: "構造", text: "この2つが繋がる根本の仕組みは何だろう？" },
    { label: "越境", text: "同じ構造が全く違う分野で起きてるとしたら、それは何？" },
    { label: "反転", text: "この関係性が逆転するケースってある？" },
  ],
  followUp: [
    { label: "深化", text: "今の話をもう一段掘り下げると、何が見える？" },
    { label: "応用", text: "これを自分の仕事や生活にどう活かせる？" },
  ],
} as const;

export function SuggestButtons({ onSelect, type }: SuggestButtonsProps) {
  const templates = SUGGEST_TEMPLATES[type];
  return (
    <div className="space-y-2 animate-page-enter">
      {templates.map((t) => (
        <button key={t.label} onClick={() => onSelect(t.text)}
          className="w-full text-left rounded-2xl px-4 py-2.5" style={{ background: "var(--bg-tertiary)" }}>
          <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{t.label}</span>
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}> </span>
          <span className="text-[13px]" style={{ color: "var(--text-body)" }}>{t.text}</span>
        </button>
      ))}
    </div>
  );
}
