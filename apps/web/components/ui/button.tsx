import { cn } from "./cn";

type Variant = "primary" | "ghost" | "danger" | "success" | "outline";
const V: Record<Variant, string> = {
  primary: "bg-brand text-ink-950 hover:bg-brand/90",
  success: "bg-ok text-ink-950 hover:bg-ok/90",
  danger:  "bg-crit/15 text-crit ring-1 ring-inset ring-crit/30 hover:bg-crit/25",
  ghost:   "text-fg-muted hover:bg-white/[0.05] hover:text-fg",
  outline: "text-fg ring-1 ring-inset ring-white/10 hover:bg-white/[0.04]",
};

export function Button({ variant = "primary", size = "md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        V[variant], className)}
      {...p}
    />
  );
}

export const inputCls =
  "h-10 w-full rounded-xl border border-white/[0.08] bg-ink-900 px-3 text-sm text-fg placeholder:text-fg-subtle outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20";

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-fg-subtle">{hint}</span>}
    </label>
  );
}
