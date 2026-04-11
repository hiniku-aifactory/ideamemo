"use client";

import { useState } from "react";

interface KnowledgeFormProps {
  onSave: (data: { title: string; url: string; description: string }) => void;
  onClose: () => void;
}

export function KnowledgeForm({ onSave, onClose }: KnowledgeFormProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  const canSave = title.trim().length > 0;

  return (
    <div className="absolute left-4 right-4 rounded-xl p-3.5 animate-page-enter"
      style={{
        bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
        background: "var(--bg-secondary)", border: "0.5px solid var(--border-light)",
        boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
      }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>外部リソースを追加</p>
        <button onClick={onClose} className="text-[11px]" style={{ color: "var(--text-muted)" }}>× キャンセル</button>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>タイトル <span style={{ color: "var(--accent)" }}>*</span></p>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ファインマン・テクニック"
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
          />
        </div>

        <div>
          <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>URL（任意）</p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
          />
        </div>

        <div>
          <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>メモ（任意）</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="このメモとの関連をひとこと..."
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
          />
        </div>
      </div>

      <button
        onClick={() => canSave && onSave({ title: title.trim(), url: url.trim(), description: description.trim() })}
        disabled={!canSave}
        className="w-full mt-3 py-2 rounded-lg text-[12px] font-medium"
        style={{
          background: canSave ? "var(--text-primary)" : "var(--bg-tertiary)",
          color: canSave ? "var(--bg-primary)" : "var(--text-muted)",
        }}>
        保存
      </button>
    </div>
  );
}
