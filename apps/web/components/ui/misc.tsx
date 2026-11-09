import { cn } from "./cn";

export function PageHeader({ title, subtitle, actions, eyebrow }: {
  title: string; subtitle?: string; actions?: React.ReactNode; eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, tone }: { value: number; tone?: "ok" | "warn" | "crit" | "brand" }) {
  const v = Math.max(0, Math.min(100, value));
  const t = tone ?? (v >= 100 ? "ok" : v >= 60 ? "brand" : v >= 30 ? "warn" : "crit");
  const bar = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", brand: "bg-brand" }[t];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={cn("h-full rounded-full shadow-glow transition-all", bar)} style={{ width: `${v}%`, color: "inherit" }} />
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-fg-muted">{title}</p>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="mb-6 rounded-xl border border-warn/20 bg-warn/[0.06] px-4 py-2.5 text-xs text-warn">
      Modo demo: datos de ejemplo. Configure <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
      <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> para conectar su proyecto.
    </div>
  );
}
