import "server-only";
import { isDemo } from "@/lib/env";
import { demoAlerts, demoResources, demoSeries } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Alert, MetricPoint, Resource } from "@/lib/types";
import { unwrap } from "./_helpers";

export async function getResources(): Promise<Resource[]> {
  if (isDemo) return demoResources;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.from("monitored_resources")
    .select("id, name, public_name, kind, region, status, last_heartbeat_at, clients(trade_name, legal_name)")
    .eq("is_active", true).order("status").order("name"));
  // último sample por recurso (índice PK resource_id, ts desc)
  const latest = await Promise.all(rows.map((r) =>
    db.from("metric_samples").select("cpu_pct, mem_pct, latency_ms").eq("resource_id", r.id)
      .order("ts", { ascending: false }).limit(1).maybeSingle()));
  return rows.map((r, i) => {
    const c = r.clients as unknown as { trade_name: string | null; legal_name: string } | null;
    return { ...r, client_name: c ? c.trade_name ?? c.legal_name : null, ...(latest[i].data ?? {}) } as Resource;
  });
}

export async function getSeries(resourceId: string | null, minutes = 60): Promise<MetricPoint[]> {
  if (isDemo || !resourceId) return demoSeries(minutes);
  const db = await createSupabaseServer();
  return unwrap(await db.from("metric_samples").select("ts, cpu_pct, mem_pct, latency_ms")
    .eq("resource_id", resourceId).gte("ts", new Date(Date.now() - minutes * 60_000).toISOString())
    .order("ts")) as MetricPoint[];
}

export async function getAlerts(limit = 30): Promise<Alert[]> {
  if (isDemo) return demoAlerts;
  const db = await createSupabaseServer();
  return unwrap(await db.from("alerts")
    .select("id, severity, status, title, message, opened_at, resolved_at, notified_at")
    .order("opened_at", { ascending: false }).limit(limit)) as Alert[];
}
