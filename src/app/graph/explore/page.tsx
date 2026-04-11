"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ExploreView } from "@/components/graph/explore-view";

function ExploreInner() {
  const searchParams = useSearchParams();
  const rootId = searchParams.get("root");

  if (!rootId) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No root node specified
        </p>
      </main>
    );
  }

  return <ExploreView rootId={rootId} />;
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center">
          <div
            className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
          />
        </main>
      }
    >
      <ExploreInner />
    </Suspense>
  );
}
