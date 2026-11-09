import { Card } from "./card";
import { cn } from "./cn";
import type { Tone } from "./status";

const ACCENT: Record<Tone, string> = {
  ok: "from-ok/20", warn: "from-warn/20", crit: "from-crit/20", info: "from-info/20", brand: "from-brand/25", neutral: "from-white/5",
};

export function Kpi({ label, value, hint, tone = "neutral", icon }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone; icon?: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl", ACCENT[tone])} />
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-fg-subtle">
        {label}
        {icon && <span className="text-fg-muted">{icon}</span>}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-fg tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </Card>
  );
}
