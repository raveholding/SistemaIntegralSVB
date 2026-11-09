import "server-only";
import { isDemo } from "@/lib/env";
import { demoAudit, demoMovements, demoSession } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { AuditEvent, CashMovement, CashSession } from "@/lib/types";
import { nameMap, unwrap } from "./_helpers";

const DOC_LABEL: Record<string, string> = {
  invoice_a: "Factura A", invoice_b: "Factura B", invoice_c: "Factura C", ticket: "Ticket",
  deposit_receipt: "Seña", receipt: "Recibo", credit_note: "Nota de crédito",
};
export const docLabel = (t: string, pos: number, n: number) =>
  `${DOC_LABEL[t] ?? t} ${String(pos).padStart(4, "0")}-${String(n).padStart(8, "0")}`;

export async function getRegisters() {
  if (isDemo) return [{ id: "ca000000-0000-0000-0000-000000000001", name: "Caja Principal" }];
  const db = await createSupabaseServer();
  return unwrap(await db.from("cash_registers").select("id, name").eq("is_active", true).order("name"));
}

export async function getOpenSession(): Promise<CashSession | null> {
  if (isDemo) return demoSession;
  const db = await createSupabaseServer();
  const s = unwrap(await db.from("cash_session_balances").select("*").eq("status", "open")
    .order("opened_at", { ascending: false }).limit(1).maybeSingle()) as any;
  if (!s) return null;
  const [{ data: reg }, names] = await Promise.all([
    db.from("cash_registers").select("name").eq("id", s.register_id).single(),
    nameMap(db, [s.opened_by]),
  ]);
  return { ...s, register_name: reg?.name ?? "Caja", opened_by_name: names.get(s.opened_by) ?? "—" } as CashSession;
}

export async function getMovements(sessionId: string): Promise<CashMovement[]> {
  if (isDemo) return demoMovements;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.from("cash_movements")
    .select("id, created_at, kind, method, amount, reference, created_by, sales_documents(doc_type, point_of_sale, number)")
    .eq("session_id", sessionId).order("created_at", { ascending: false }));
  const names = await nameMap(db, rows.map((r) => r.created_by));
  return rows.map((r) => {
    const d = r.sales_documents as any;
    return { ...r, user_name: names.get(r.created_by) ?? "—", doc_label: d ? docLabel(d.doc_type, d.point_of_sale, d.number) : null } as CashMovement;
  });
}

export async function getAuditFeed(tenantId: string, table?: string, limit = 50): Promise<AuditEvent[]> {
  if (isDemo) return table ? demoAudit.filter((e) => e.table_name === table) : demoAudit;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.rpc("audit_feed", { p_tenant: tenantId, p_table: table ?? null, p_limit: limit })) as any[];
  const names = await nameMap(db, rows.map((r) => r.actor_id));
  return rows.map((r) => ({
    ...r, actor_name: r.actor_id ? names.get(r.actor_id) ?? r.actor_id : "sistema",
    hash_hex: String(r.hash ?? "").replace(/^\\x/, ""),
  })) as AuditEvent[];
}

export async function verifyAudit(tenantId: string) {
  if (isDemo) return { ok: true, broken_event_id: null, reason: null, events_checked: 1042 };
  const db = await createSupabaseServer();
  const rows = unwrap(await db.rpc("audit_verify", { p_tenant: tenantId })) as any[];
  return rows[0];
}
