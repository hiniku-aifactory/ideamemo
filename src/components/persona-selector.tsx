"use client";

import { Check, Hammer, TrendingUp, FlaskConical, Palette } from "lucide-react";
import type { ComponentType } from "react";

const PERSONAS = [
  { id: "builder", icon: Hammer, sublabel: "作っている", desc: "起業、開発、制作" },
  { id: "grower", icon: TrendingUp, sublabel: "伸ばしている", desc: "マーケ、営業、運用" },
  { id: "researcher", icon: FlaskConical, sublabel: "深めている", desc: "研究、学習、専門職" },
  { id: "creator", icon: Palette, sublabel: "表現している", desc: "デザイン、文章、音楽" },
] as const;

interface Props {
  selected: string[];
  onChange: (personas: string[]) => void;
  minSelect?: number;
}

export function PersonaSelector({ selected, onChange, minSelect = 1 }: Props) {
  function togglePersona(id: string) {
    if (selected.includes(id)) {
      if (selected.length <= minSelect) return;
      onChange(selected.filter((p) => p !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {PERSONAS.map((persona) => {
        const isSelected = selected.includes(persona.id);
        const Icon = persona.icon as ComponentType<{ size?: number; style?: React.CSSProperties }>;
        return (
          <button
            key={persona.id}
            onClick={() => togglePersona(persona.id)}
            className="relative text-left rounded-xl p-4 transition-transform duration-150 ease-out"
            style={{
              background: "var(--bg-secondary)",
              border: `2px solid ${isSelected ? "var(--accent)" : "transparent"}`,
              minHeight: "100px",
            }}
            onPointerDown={(e) => {
              e.currentTarget.style.transform = "scale(0.97)";
            }}
            onPointerUp={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isSelected && (
              <div
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "var(--bg-secondary)" }}
              >
                <Check size={16} style={{ color: "var(--accent)" }} />
              </div>
            )}
            <Icon size={28} style={{ color: "var(--accent)" }} />
            <span className="text-base font-bold block mt-2" style={{ color: "var(--text-primary)" }}>
              {persona.sublabel}
            </span>
            <span className="text-[11px] block mt-1" style={{ color: "var(--text-muted)" }}>
              {persona.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
