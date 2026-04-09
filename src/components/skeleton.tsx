"use client";

interface Props {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = "100%", height = "16px", className = "" }: Props) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{
        width,
        height,
        background: "var(--bg-tertiary)",
      }}
    />
  );
}
