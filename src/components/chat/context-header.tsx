"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Idea, Connection } from "@/lib/types";

interface ContextHeaderProps {
  ideaFrom: Idea | null;
  ideaTo: Idea | null;
  connection: Connection | null;
}

export function ContextHeader({ ideaFrom, ideaTo, connection }: ContextHeaderProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  if (!connection || !ideaFrom) return null;

  const reason = connection.reason || connection.external_knowledge_summary || "";

  return (
    <div className="mx-4 mb-2 rounded-lg overflow-hidden"
      style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 10 }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3">
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); router.push(`/memo/${ideaFrom.id}`); }}
            className="flex items-center gap-1.5 min-w-0">
            <div className="flex-shrink-0 rounded-full flex items-center justify-center"
              style={{ width: 22, height: 22, border: "0.5px solid var(--border)" }}>
              <span style={{ fontSize: 8, color: "var(--text-muted)" }}>○</span>
            </div>
            <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {ideaFrom.summary.slice(0, 10)}
            </span>
          </button>
          <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>←→</span>
          <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {ideaTo ? ideaTo.summary.slice(0, 10) : connection.external_knowledge_title?.slice(0, 10) ?? ""}
          </span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 ml-auto">
            {expanded
              ? <path d="M3 9L7 5L11 9" stroke="var(--text-muted)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M3 5L7 9L11 5" stroke="var(--text-muted)" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </div>
        {reason && (
          <p className={`text-[11px] mt-1.5 ${expanded ? "" : "line-clamp-1"}`}
            style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>{reason}</p>
        )}
      </button>
    </div>
  );
}
