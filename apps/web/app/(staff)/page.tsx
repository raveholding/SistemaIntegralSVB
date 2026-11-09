import Link from "next/link";
import { Activity, AlertTriangle, BadgeDollarSign, Bot, FileWarning, LifeBuoy, TrendingUp, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/misc";
import { HEALTH, SEVERITY, StatusDot, StatusPill } from "@/components/ui/status";
import { getKpis } from "@/lib/data/dashboard";
import { getAlerts, getResources } from "@/lib/data/monitor";
import { getContracts } from "@/lib/data/documents";
import { daysUntil, money, relative } from "@/lib/format";
import { getContext } from "@/lib/session";

export default async function DashboardPage() {
  const ctx = await getContext();
  const [k, resources, alerts, contracts] = await Promise.all([
    getKpis(ctx.tenantId), getResources().catch(() => []), getAlerts(5).catch(() => []), getContracts().catch(() => []),
  ]);
  const totalRes = Object.values(k.resources ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  const expiring = contracts
    .filter((c) => c.status === "signed" && (daysUntil(c.end_date) ?? 999) <= 30)
    .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""));

  return (
    <>
      <PageHeader eyebrow="Panel ejecutivo" title={`Hola, ${ctx.name}`}
        subtitle="Estado general de clientes, infraestructura e ingresos recurrentes." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="MRR" value={money(k.mrr)} tone="brand" icon={<TrendingUp className="h-4 w-4" />}
          hint={`${k.active_clients} clientes activos`} />
        <Kpi label="Planes con IA" value={`${k.ai_share ?? 0} %`} tone="info" icon={<Bot className="h-4 w-4" />}
          hint="Potencial de upgrade en el resto" />
        <Kpi label="Ventas del mes" value={money(k.sales_month)} tone="ok" icon={<BadgeDollarSign className="h-4 w-4" />}
          hint={`${k.new_leads_7d} leads nuevos en 7 días`} />
        <Kpi label="Servicios operativos" value={`${k.resources.operational ?? 0}/${totalRes}`}
          tone={k.resources.down ? "crit" : k.resources.degraded ? "warn" : "ok"} icon={<Activity className="h-4 w-4" />}
          hint={`${k.open_alerts} alertas abiertas`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Salud de clientes" subtitle="Heartbeat en tiempo real" icon={<Activity className="h-4 w-4" />}
            action={<Link href="/monitor" className="text-xs text-brand hover:underline">Ver monitor →</Link>} />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            {resources.slice(0, 8).map((r) => {
              const [tone] = HEALTH[r.status];
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-ink-900/60 px-4 py-3">
                  <StatusDot tone={tone} pulse={r.status !== "operational"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{r.name}</p>
                    <p className="truncate text-xs text-fg-subtle">{r.client_name ?? "Interno"} · {relative(r.last_heartbeat_at)}</p>
                  </div>
                  <StatusPill map={HEALTH} value={r.status} dot={false} />
                </div>
              );
            })}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Alertas recientes" icon={<AlertTriangle className="h-4 w-4" />} />
            <ul className="divide-y divide-white/[0.04]">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <StatusPill map={SEVERITY} value={a.severity} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{a.title}</p>
                    <p className="text-xs text-fg-subtle">{relative(a.opened_at)} · {a.status === "resolved" ? "resuelta" : a.status === "acknowledged" ? "en atención" : "abierta"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Contratos por vencer" subtitle="Próximos 30 días" icon={<FileWarning className="h-4 w-4" />} />
            <ul className="divide-y divide-white/[0.04]">
              {expiring.length === 0 && <li className="px-5 py-4 text-sm text-fg-subtle">Sin vencimientos próximos.</li>}
              {expiring.map((c) => {
                const d = daysUntil(c.end_date) ?? 0;
                return (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm text-fg">{c.client_name}</p>
                      <p className="font-mono text-[11px] text-fg-subtle">{c.code}</p>
                    </div>
                    <span className={d <= 7 ? "text-sm font-semibold text-crit" : "text-sm font-semibold text-warn"}>{d} días</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Tickets abiertos" value={k.open_tickets} tone={k.open_tickets > 5 ? "warn" : "neutral"} icon={<LifeBuoy className="h-4 w-4" />} />
        <Kpi label="Clientes activos" value={k.active_clients} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Contratos a renovar" value={k.contracts_expiring_30d} tone={k.contracts_expiring_30d ? "warn" : "ok"} icon={<FileWarning className="h-4 w-4" />} />
      </div>
    </>
  );
}
