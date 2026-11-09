"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BadgeDollarSign, FileText, Globe, LayoutDashboard, LifeBuoy, ScrollText, Users, Wallet,
} from "lucide-react";
import { cn } from "@/components/ui/cn";

export interface NavItem { href: string; label: string; icon: keyof typeof ICONS; perm: string; badge?: number }

const ICONS = {
  dashboard: LayoutDashboard, monitor: Activity, docs: FileText, crm: BadgeDollarSign, pos: Wallet,
  hr: Users, cms: Globe, tickets: LifeBuoy, audit: ScrollText,
};

export function Sidebar({ items, tenant }: { items: NavItem[]; tenant: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.05] bg-ink-900/80 px-3 py-5 lg:flex">
      <div className="mb-8 flex items-center gap-3 px-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-info text-sm font-bold text-ink-950">VB</div>
        <div>
          <p className="text-sm font-semibold leading-tight text-fg">Sistema Integral</p>
          <p className="text-[11px] text-fg-subtle">{tenant}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active ? "bg-white/[0.06] text-fg" : "text-fg-muted hover:bg-white/[0.03] hover:text-fg")}>
              <Icon className={cn("h-4 w-4", active ? "text-brand" : "text-fg-subtle group-hover:text-fg-muted")} />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && (
                <span className="rounded-full bg-crit/15 px-1.5 text-[10px] font-semibold text-crit">{it.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <p className="px-3 text-[10px] text-fg-subtle">Vincular Business · (387) 4484132</p>
    </aside>
  );
}
