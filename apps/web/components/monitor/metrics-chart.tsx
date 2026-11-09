"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricPoint } from "@/lib/types";
import { cn } from "@/components/ui/cn";

const METRICS = {
  cpu_pct:    { label: "CPU",      unit: "%",  color: "#7C8CFF", warn: 75,   crit: 90 },
  mem_pct:    { label: "Memoria",  unit: "%",  color: "#38BDF8", warn: 75,   crit: 85 },
  latency_ms: { label: "Latencia", unit: "ms", color: "#22E39B", warn: 800,  crit: 1500 },
} as const;
type Key = keyof typeof METRICS;

export function MetricsChart({ data }: { data: MetricPoint[] }) {
  const [metric, setMetric] = useState<Key>("cpu_pct");
  const m = METRICS[metric];
  const rows = useMemo(() => data.map((d) => ({
    t: new Date(d.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    v: d[metric] == null ? null : Math.round(Number(d[metric]) * 10) / 10,
  })), [data, metric]);
  const last = rows.at(-1)?.v ?? null;
  const tone = last == null ? "text-fg-subtle" : last >= m.crit ? "text-crit" : last >= m.warn ? "text-warn" : "text-ok";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-ink-900 p-1">
          {(Object.keys(METRICS) as Key[]).map((k) => (
            <button key={k} onClick={() => setMetric(k)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition",
                k === metric ? "bg-white/[0.08] text-fg" : "text-fg-subtle hover:text-fg-muted")}>
              {METRICS[k].label}
            </button>
          ))}
        </div>
        <p className={cn("text-2xl font-semibold tabular-nums", tone)}>
          {last ?? "—"}<span className="ml-1 text-sm text-fg-subtle">{m.unit}</span>
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ left: -18, right: 8, top: 8 }}>
            <defs>
              <linearGradient id={`g-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={m.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#6B768A", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tick={{ fill: "#6B768A", fontSize: 11 }} axisLine={false} tickLine={false}
              domain={m.unit === "%" ? [0, 100] : [0, "auto"]} />
            <Tooltip
              contentStyle={{ background: "#10141C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "#9AA4B6" }} formatter={(v) => [`${v} ${m.unit}`, m.label]} />
            <ReferenceLine y={m.warn} stroke="#FFC53D" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={m.crit} stroke="#FF4D6A" strokeDasharray="4 4" strokeOpacity={0.6} />
            <Area type="monotone" dataKey="v" stroke={m.color} strokeWidth={2} fill={`url(#g-${metric})`} connectNulls isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
