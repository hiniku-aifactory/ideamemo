"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MemoCard } from "@/components/memo-card";
import { mockDb } from "@/lib/mock/db";
import type { Idea } from "@/lib/types";

interface Props {
  params: Promise<{ name: string }>;
}

export default function FolderDetailPage({ params }: Props) {
  const { name } = use(params);
  const router = useRouter();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const folderName = decodeURIComponent(name);

  useEffect(() => {
    const all = mockDb.ideas.list();
    const filtered = all.filter((i) => (i.folder_name ?? "その他") === folderName);
    setIdeas(filtered);
  }, [folderName]);

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      <AppHeader showBack title={folderName} />

      <div className="flex-1 px-6 pb-28">
        {ideas.length === 0 ? (
          <div className="flex flex-col items-center pt-32">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              このフォルダにはまだメモがありません
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ideas.map((idea) => (
              <MemoCard
                key={idea.id}
                idea={idea}
                onClick={() => router.push(`/memo/${idea.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
