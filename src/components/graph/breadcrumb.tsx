"use client";

interface BreadcrumbProps {
  items: string[];
  onTap: (index: number) => void;
}

export function Breadcrumb({ items, onTap }: BreadcrumbProps) {
  return (
    <div className="flex-none flex items-center gap-1.5 px-5 pb-2 overflow-x-auto scrollbar-hide">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5 flex-shrink-0">
          {i > 0 && <span className="text-[10px]" style={{ color: "var(--text-hint)" }}>›</span>}
          <button
            onClick={() => onTap(i)}
            className="text-[11px]"
            style={{
              color: i === items.length - 1 ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: i === items.length - 1 ? 500 : 400,
            }}
          >
            {item}
          </button>
        </span>
      ))}
    </div>
  );
}
