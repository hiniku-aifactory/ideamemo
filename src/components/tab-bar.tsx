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
  // 中央FABはスロットとして空ける
  { href: "/graph", icon: GitBranch, label: "グラフ", disabled: true },
  { href: "/chat", icon: MessageCircle, label: "チャット", disabled: true },
];

export function TabBar() {
  const pathname = usePathname();

  // /login, /record では非表示
  if (pathname === "/login" || pathname.startsWith("/record")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "var(--bg-primary)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-center justify-around h-14">
        {/* 左2つ */}
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavItemButton key={item.label} item={item} pathname={pathname} />
        ))}

        {/* 中央FAB */}
        <Link
          href="/record?auto=true"
          className="flex items-center justify-center w-14 h-14 rounded-full -translate-y-3"
          style={{
            background: "var(--accent)",
            boxShadow: "0 4px 12px rgba(212, 137, 106, 0.3)",
          }}
        >
          <Mic size={24} style={{ color: "#0A0A0A" }} />
        </Link>

        {/* 右2つ */}
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
      <div className="flex flex-col items-center gap-1 opacity-30 pointer-events-none py-2">
        <Icon size={20} style={{ color: "var(--text-secondary)" }} />
        <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {item.label}
        </span>
      </div>
    );
  }

  return (
    <Link href={item.href} className="flex flex-col items-center gap-1 py-2">
      <Icon
        size={20}
        style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
      />
      <span
        className="text-[10px]"
        style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
      >
        {item.label}
      </span>
    </Link>
  );
}
