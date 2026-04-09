"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Folder, Mic, GitBranch, MessageCircle } from "lucide-react";

interface NavItem {
  href: string;
  icon: typeof Home;
  label: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: Home, label: "ホーム" },
  { href: "/folders", icon: Folder, label: "フォルダ", disabled: true },
  { href: "/graph", icon: GitBranch, label: "グラフ", disabled: true },
  { href: "/chat", icon: MessageCircle, label: "チャット", disabled: true },
];

export function TabBar() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname.startsWith("/record") || pathname === "/onboarding") return null;

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavItemButton key={item.label} item={item} pathname={pathname} />
        ))}

        <Link href="/record?auto=true" className="bottom-nav-fab">
          <Mic size={24} color="#0A0A0A" />
        </Link>

        {NAV_ITEMS.slice(2).map((item) => (
          <NavItemButton key={item.label} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function NavItemButton({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href;
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <div className="bottom-nav-item" style={{ opacity: 0.3, pointerEvents: "none" }}>
        <Icon size={20} style={{ color: "var(--text-secondary)" }} />
        <span className="bottom-nav-label" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
      </div>
    );
  }

  return (
    <Link href={item.href} className="bottom-nav-item">
      <Icon size={20} style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }} />
      <span className="bottom-nav-label" style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}>
        {item.label}
      </span>
    </Link>
  );
}
