import Link from "next/link";
import { Activity, BellRing, Cpu, Database, Globe, Server, Webhook } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, Progress } from "@/components/ui/misc";
import { HEALTH, SEVERITY, StatusDot, StatusPill, Pill } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { MetricsChart } from "@/components/monitor/metrics-chart";
import { LiveRefresh } from "@/components/monitor/live-refresh";
import { getAlerts, getResources, getSeries } from "@/lib/data/monitor";
import { dateTime, relative } from "@/lib/format";
import { requirePerm } from "@/lib/session";
import { acknowledgeAlert } from "./actions";

export const metadata = { title: "Infraestructura" };

const KIND_ICON = { server: Server, database: Database, supabase_project: Database, api: Webhook, website: Globe, worker: Cpu } as const;

export default async function MonitorPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const ctx = await requirePerm("monitor.read");
  const { r } = await searchParams;
  const resources = await getResources();
  const selected = resources.find((x) => x.id === r) ?? resources.find((x) => x.status !== "operational") ?? resources[0];
  const [series, alerts] = await Promise.all([getSeries(selected?.id ?? null), getAlerts()]);
  const canManage = ctx.perms.includes("monitor.manage");

  const counts = resources.reduce<Record<string, number>>((a, x) => ((a[x.status] = (a[x.status] ?? 0) + 1), a), {});

  return (
    <>
      <PageHeader eyebrow="Módulo 1" title="Monitor de salud e infraestructura"
        subtitle="Telemetría de servidores y bases Supabase/PostgreSQL de cada cliente corporativo."
        actions={<LiveRefresh />} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["operational", "degraded", "down", "unknown"] as const).map((s) => {
          const [tone, label] = HEALTH[s];
          return (
            <Card key={s} className="flex items-center gap-3 px-4 py-3">
              <StatusDot tone={tone} pulse={s === "down" && !!counts[s]} />
              <span className="text-sm text-fg-muted">{label}</span>
              <span className="ml-auto text-xl font-semibold tabular-nums text-fg">{counts[s] ?? 0}</span>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={selected ? selected.name : "Sin recursos"} icon={<Activity className="h-4 w-4" />}
            subtitle={selected ? `${selected.client_name ?? "Interno"} · ${selected.region ?? "—"} · último latido ${relative(selected.last_heartbeat_at)}` : undefined}
            action={selected && <StatusPill map={HEALTH} value={selected.status} />} />
          <CardBody><MetricsChart data={series} /></CardBody>
        </Card>

        <Card>
          <CardHeader title="Registro de alertas" subtitle="Notificadas por webhook a Telegram" icon={<BellRing className="h-4 w-4" />} />
          <ul className="max-h-[360px] divide-y divide-white/[0.04] overflow-y-auto">
            {alerts.map((a) => (
              <li key={a.id} className={cn("px-5 py-3", a.status === "resolved" && "opacity-60")}>
                <div className="flex items-center gap-2">
                  <StatusPill map={SEVERITY} value={a.severity} />
                  {a.notified_at && <Pill tone="info">Telegram ✓</Pill>}
                  <span className="ml-auto text-[11px] text-fg-subtle">{relative(a.opened_at)}</span>
                </div>
                <p className="mt-1.5 text-sm text-fg">{a.title}</p>
                {a.message && <p className="text-xs text-fg-subtle">{a.message}</p>}
                <div className="mt-2 flex items-center justify-between text-[11px] text-fg-subtle">
                  <span>{a.status === "resolved" ? `Resuelta ${dateTime(a.resolved_at)}` : a.status === "acknowledged" ? "En atención" : "Abierta"}</span>
                  {canManage && a.status === "open" && (
                    <form action={acknowledgeAlert}>
                      <input type="hidden" name="alertId" value={a.id} />
                      <Button size="sm" variant="outline">Tomar</Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recursos monitoreados" subtitle="CPU / memoria / latencia del último heartbeat" />
        <Table>
          <THead><tr><Th>Recurso</Th><Th>Cliente</Th><Th>Estado</Th><Th className="w-40">CPU</Th><Th className="w-40">Memoria</Th><Th>Latencia</Th><Th>Heartbeat</Th></tr></THead>
          <tbody>
            {resources.map((x) => {
              const Icon = KIND_ICON[x.kind as keyof typeof KIND_ICON] ?? Server;
              return (
                <Tr key={x.id} className={cn(x.id === selected?.id && "bg-white/[0.03]")}>
                  <Td>
                    <Link href={`/monitor?r=${x.id}`} className="flex items-center gap-2 text-fg hover:text-brand">
                      <Icon className="h-4 w-4 text-fg-subtle" /> {x.name}
                    </Link>
                  </Td>
                  <Td>{x.client_name ?? <span className="text-fg-subtle">Interno</span>}</Td>
                  <Td><StatusPill map={HEALTH} value={x.status} /></Td>
                  <Td>{x.cpu_pct != null ? <div className="space-y-1"><Progress value={x.cpu_pct} tone={x.cpu_pct > 90 ? "crit" : x.cpu_pct > 75 ? "warn" : "ok"} /><span className="text-[11px] tabular-nums">{x.cpu_pct.toFixed(0)} %</span></div> : "—"}</Td>
                  <Td>{x.mem_pct != null ? <div className="space-y-1"><Progress value={x.mem_pct} tone={x.mem_pct > 85 ? "crit" : x.mem_pct > 75 ? "warn" : "ok"} /><span className="text-[11px] tabular-nums">{x.mem_pct.toFixed(0)} %</span></div> : "—"}</Td>
                  <Td className={cn("tabular-nums", (x.latency_ms ?? 0) > 1500 ? "text-crit" : (x.latency_ms ?? 0) > 800 ? "text-warn" : "")}>{x.latency_ms != null ? `${Math.round(x.latency_ms)} ms` : "—"}</Td>
                  <Td className="text-xs">{relative(x.last_heartbeat_at)}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
