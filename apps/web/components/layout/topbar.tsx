import { Bell, Search } from "lucide-react";
import { ROLE_LABEL } from "@/lib/rbac";
import type { AppRole } from "@/lib/claims";

export function Topbar({ name, role, notifications }: { name: string; role: AppRole; notifications: number }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-white/[0.05] bg-ink-950/70 px-6 backdrop-blur-xl">
      <div className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-white/[0.06] bg-ink-900 px-3 py-2 text-sm text-fg-subtle">
        <Search className="h-4 w-4" />
        <span>Buscar clientes, contratos, comprobantes…</span>
        <kbd className="ml-auto rounded bg-white/[0.05] px-1.5 font-mono text-[10px]">⌘K</kbd>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative rounded-xl p-2 text-fg-muted hover:bg-white/[0.04]" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {notifications > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-crit shadow-glow text-crit" />}
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-fg">{name}</p>
            <p className="text-[11px] text-fg-subtle">{ROLE_LABEL[role]}</p>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-700 text-sm font-semibold text-fg">
            {name.slice(0, 1).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
