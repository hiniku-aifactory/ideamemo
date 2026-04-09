"use client";

import { useEffect } from "react";

function getTimeGradient() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return { accent: "#D4A070", bg: "#0A0A0A" };
  if (hour >= 10 && hour < 16) return { accent: "#D4896A", bg: "#0A0A0A" };
  if (hour >= 16 && hour < 20) return { accent: "#C47A6A", bg: "#0A0A0A" };
  return { accent: "#B08060", bg: "#080808" };
}

export function TimeGradientProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function apply() {
      const { accent, bg } = getTimeGradient();
      document.documentElement.style.setProperty("--accent", accent);
      document.documentElement.style.setProperty("--bg-primary", bg);
    }
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, []);

  return <>{children}</>;
}
