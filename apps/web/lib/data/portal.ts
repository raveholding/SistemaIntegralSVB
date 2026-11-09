import "server-only";
import { isDemo } from "@/lib/env";
import { demoContracts, demoInvoices, demoPlans, demoResources, demoTickets } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { HealthStatus, Invoice, Ticket } from "@/lib/types";
import { docLabel } from "./pos";
import { unwrap } from "./_helpers";

export interface PortalOverview {
  clientName: string;
  services: { resource_id: string; service_name: string; status: HealthStatus; since: string; uptime_30d: number }[];
  contract: { code: string; title: string; status: string; start_date: string | null; end_date: string | null; path: string | null } | null;
  plan: { id: string; name: string; price: number; includes_ai: boolean } | null;
  invoices: Invoice[];
  tickets: Ticket[];
}

/** Sólo lectura de lo que RLS expone al rol client_*: nunca endpoints, métricas ni notas internas. */
export async function getPortalOverview(): Promise<PortalOverview> {
  if (isDemo) {
    const c = demoContracts[0];
    return {
      clientName: "Barbería Juan",
      services: demoResources.filter((r) => r.client_name === "Barbería Juan").map((r) => ({
        resource_id: r.id, service_name: r.public_name ?? r.name, status: r.status, since: r.last_heartbeat_at ?? "", uptime_30d: 99.97,
      })),
      contract: { code: c.code, title: c.title, status: c.status, start_date: c.start_date, end_date: c.end_date, path: c.current_version_path },
      plan: { id: demoPlans[0].id, name: demoPlans[0].name, price: demoPlans[0].price_monthly, includes_ai: false },
      invoices: demoInvoices,
      tickets: demoTickets,
    };
  }
  const db = await createSupabaseServer();
  const [client, services, contract, sub, docs, tickets] = await Promise.all([
    db.from("clients").select("legal_name, trade_name").limit(1).single(),
    db.rpc("portal_service_status"),
    db.from("contracts").select("code, title, status, start_date, end_date, contract_versions!contract_versions_contract_id_fkey(id, storage_path), current_version_id")
      .order("end_date", { ascending: false }).limit(1).maybeSingle(),
    db.from("subscriptions").select("plans(id, name, price_monthly, includes_ai), price_override").neq("status", "canceled").limit(1).maybeSingle(),
    db.from("sales_documents").select("id, doc_type, point_of_sale, number, issued_at, total, status, cae").order("issued_at", { ascending: false }).limit(12),
    db.from("support_tickets").select("id, number, subject, status, priority, category, created_at, sla_due_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const k = contract.data as any;
  const p = (sub.data as any)?.plans;
  return {
    clientName: client.data?.trade_name ?? client.data?.legal_name ?? "Mi empresa",
    services: unwrap(services) as PortalOverview["services"],
    contract: k ? { ...k, path: (k.contract_versions as any[]).find((v) => v.id === k.current_version_id)?.storage_path ?? null } : null,
    plan: p ? { id: p.id, name: p.name, price: Number((sub.data as any).price_override ?? p.price_monthly), includes_ai: p.includes_ai } : null,
    invoices: (docs.data ?? []).map((d) => ({ id: d.id, label: docLabel(d.doc_type, d.point_of_sale, d.number), issued_at: d.issued_at, total: Number(d.total), status: d.status, cae: d.cae })),
    tickets: (tickets.data ?? []) as Ticket[],
  };
}

export async function getTickets(): Promise<Ticket[]> {
  if (isDemo) return demoTickets;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.from("support_tickets")
    .select("id, number, subject, status, priority, category, created_at, sla_due_at, clients(trade_name, legal_name)")
    .in("status", ["open", "in_progress", "waiting_client"]).order("sla_due_at"));
  return rows.map((r) => ({ ...r, client_name: (r.clients as any)?.trade_name ?? (r.clients as any)?.legal_name })) as Ticket[];
}
