"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Gavel,
  User,
  Activity,
  History,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
  { href: "/marketplace",   icon: ShoppingCart,    label: "Market" },
  { href: "/auctions",      icon: Gavel,           label: "Auctions" },
  { href: "/prosumer",      icon: User,            label: "Prosumer" },
  { href: "/oracle-health", icon: Activity,        label: "Oracle" },
  { href: "/history",       icon: History,         label: "History" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-16 min-h-screen border-r"
      style={{ background: "var(--bg-panel)", borderColor: "var(--bg-border)" }}
    >
      {/* Logo mark */}
      <div
        className="flex items-center justify-center h-14 border-b text-xs font-display tracking-widest"
        style={{ borderColor: "var(--bg-border)", color: "var(--cyan)" }}
      >
        EON
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 py-4 flex-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className="relative flex flex-col items-center justify-center w-12 h-12 rounded transition-colors group"
              style={{
                color: isActive ? "var(--cyan)" : "var(--text-muted)",
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r"
                  style={{ background: "var(--cyan)" }}
                />
              )}
              <Icon size={18} />
              <span className="text-[9px] mt-0.5 font-data">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
