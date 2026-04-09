"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Mic, Network, MessageCircle } from "lucide-react";

const tabs = [
  { href: "/", icon: Home, label: "ホーム" },
  { href: "/record", icon: Mic, label: "録音", isFab: true },
  { href: "#", icon: Network, label: "グラフ", disabled: true },
  { href: "#", icon: MessageCircle, label: "チャット", disabled: true },
];

export function TabBar() {
  const pathname = usePathname();

  // Hide tab bar on login and result pages
  if (pathname === "/login" || pathname.startsWith("/result")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-end justify-around pb-6 pt-2 z-50"
      style={{
        background: "linear-gradient(transparent, var(--bg-primary) 30%)",
      }}
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        const Icon = tab.icon;

        if (tab.isFab) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center -mt-4"
            >
              <div
                className="flex items-center justify-center w-14 h-14 rounded-full"
                style={{ background: "var(--accent-dim)" }}
              >
                <Icon size={22} style={{ color: "var(--text-primary)" }} />
              </div>
            </Link>
          );
        }

        if (tab.disabled) {
          return (
            <div
              key={tab.label}
              className="flex flex-col items-center gap-1 opacity-30"
            >
              <Icon size={20} style={{ color: "var(--text-muted)" }} />
              <span
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {tab.label}
              </span>
            </div>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center gap-1"
          >
            <Icon
              size={20}
              style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
            />
            <span
              className="text-[10px]"
              style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
