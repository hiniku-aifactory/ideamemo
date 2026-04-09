"use client";

const TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  structural_analogy: { icon: "✦", label: "構造アナロジー" },
  causal: { icon: "⇄", label: "因果関係" },
  contrarian: { icon: "⊘", label: "逆張り" },
  abstract_concrete: { icon: "▽", label: "抽象-具体" },
  same_theme: { icon: "≡", label: "同テーマ" },
};

interface Props {
  connectionType: string;
  reason: string;
  actionSuggestion: string;
  externalTitle?: string | null;
  animate?: boolean;
}

export function ConnectionCard({
  connectionType,
  reason,
  actionSuggestion,
  externalTitle,
  animate = false,
}: Props) {
  const type = TYPE_LABELS[connectionType] ?? { icon: "✦", label: connectionType };

  return (
    <div
      className={`rounded-xl p-4 border-l-[3px] ${animate ? "animate-slide-in" : ""}`}
      style={{
        background: "var(--bg-secondary)",
        borderLeftColor: "var(--accent)",
        animation: animate
          ? "slide-in 400ms ease-out, glow 2s ease-out"
          : undefined,
      }}
    >
      {/* Type label */}
      <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
        {type.icon} {type.label}
      </p>

      {/* Reason */}
      <p
        className="mt-3 text-sm leading-relaxed"
        style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
      >
        {reason}
      </p>

      {/* TRY THIS */}
      <div className="mt-4">
        <p className="text-xs font-medium mb-1" style={{ color: "var(--accent-dim)" }}>
          TRY THIS
        </p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {actionSuggestion}
        </p>
      </div>

      {/* External knowledge reference */}
      {externalTitle && (
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          📖 {externalTitle}
        </p>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes glow {
          0% {
            box-shadow: -3px 0 12px var(--accent);
          }
          100% {
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
