"use client";

import { useState } from "react";

interface Props {
  connectionId?: string;
  type: "positive" | "negative";
  label: string;
}

export function FeedbackButton({ connectionId, type, label }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  if (selected !== null && selected !== type) return null;

  const isActive = selected === type;

  async function handleClick() {
    if (selected) return;
    setSelected(type);

    if (connectionId) {
      try {
        await fetch(`/api/connections/${connectionId}/feedback`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: type }),
        });
      } catch (err) {
        console.error("Feedback save failed:", err);
      }
    }
  }

  return (
    <button
      onClick={handleClick}
      className="px-3 py-1.5 rounded-full text-xs transition-all"
      style={{
        background: isActive ? "var(--accent)" : "var(--bg-tertiary)",
        color: isActive ? "#0A0A0A" : "var(--text-secondary)",
      }}
    >
      {label}
    </button>
  );
}
