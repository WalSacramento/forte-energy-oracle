"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Activity,
  Gavel,
  History,
  LayoutDashboard,
  ReceiptText,
  ShoppingCart,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar as AppSidebarPrimitive,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const items = [
    { href: "/dashboard",       icon: LayoutDashboard, label: t("dashboard") },
    { href: "/marketplace",     icon: ShoppingCart,    label: t("market") },
    { href: "/auctions",        icon: Gavel,           label: t("auctions") },
    { href: "/prosumer",        icon: User,            label: t("prosumer") },
    { href: "/completed-trades",icon: ReceiptText,     label: t("trades") },
    { href: "/oracle-health",   icon: Activity,        label: t("oracle") },
    { href: "/history",         icon: History,         label: t("history") },
  ];

  return (
    <AppSidebarPrimitive collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-3 px-3 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-2 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Zap className="size-4" />
          </div>
          <div className="grid flex-1 text-left group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              Energy Grid
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Energy Market
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {items.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <SidebarMenuItem key={href} className="relative">
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" />
                )}
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={label}
                  render={<Link href={href} />}
                  className={cn(
                    "h-10 pl-3 transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className={cn("size-4", isActive && "text-primary")} />
                  <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarRail />
    </AppSidebarPrimitive>
  );
}
