"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  ShoppingCart,
  Gavel,
  User,
  Activity,
  History,
  ReceiptText,
} from "lucide-react";

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const NAV_ITEMS = [
    { href: "/dashboard",        icon: LayoutDashboard, label: t("dashboard") },
    { href: "/marketplace",      icon: ShoppingCart,    label: t("market") },
    { href: "/auctions",         icon: Gavel,           label: t("auctions") },
    { href: "/prosumer",         icon: User,            label: t("prosumer") },
    { href: "/completed-trades", icon: ReceiptText,     label: t("trades") },
    { href: "/oracle-health",    icon: Activity,        label: t("oracle") },
    { href: "/history",          icon: History,         label: t("history") },
  ];

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
