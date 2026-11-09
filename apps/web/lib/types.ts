export type HealthStatus = "operational" | "degraded" | "down" | "maintenance" | "unknown";
export type Severity = "info" | "warning" | "critical";

export interface Resource {
  id: string; name: string; public_name: string | null; kind: string; region: string | null;
  status: HealthStatus; last_heartbeat_at: string | null; client_name: string | null;
  cpu_pct?: number | null; mem_pct?: number | null; latency_ms?: number | null;
}
export interface MetricPoint { ts: string; cpu_pct: number | null; mem_pct: number | null; latency_ms: number | null }
export interface Alert {
  id: string; severity: Severity; status: "open" | "acknowledged" | "resolved"; title: string;
  message: string | null; opened_at: string; resolved_at: string | null; notified_at: string | null;
}
export interface Contract {
  id: string; code: string; title: string; client_name: string;
  status: "draft" | "pending_signature" | "signed" | "expired" | "terminated";
  start_date: string | null; end_date: string | null; value_amount: number | null; versions: number;
  current_version_path: string | null;
}
export interface Plan { id: string; code: string; name: string; tier: number; price_monthly: number; includes_ai: boolean; features: string[] }
export interface ClientRow {
  id: string; legal_name: string; trade_name: string | null; status: "lead" | "active" | "paused" | "churned";
  city: string | null; industry: string | null; plan_name: string | null; plan_id: string | null; subscription_id: string | null;
  mrr: number | null; last_interaction: string | null; owner_name: string | null;
}
export interface CashSession {
  session_id: string; register_name: string; status: "open" | "closed"; opened_at: string; opened_by_name: string;
  opening_amount: number; cash_balance: number; gross_sales: number; movement_count: number;
}
export interface CashMovement {
  id: string; created_at: string; kind: string; method: string; amount: number; reference: string | null;
  user_name: string; doc_label: string | null;
}
export interface AuditEvent {
  id: number; occurred_at: string; actor_name: string | null; actor_role: string | null; action: string;
  table_name: string; record_id: string | null; amount: number | null; payment_method: string | null;
  ip: string | null; changed_cols: string[] | null; hash_hex: string;
}
export interface Employee {
  id: string; full_name: string; position: string | null; staff_type: "partner" | "employee" | "seller" | "technician";
  role: string | null; is_active: boolean; goal: number | null; sales: number; commission: number | null;
  commission_status: string | null;
}
export interface CmsPage {
  id: string; title: string; slug: string; kind: "page" | "landing" | "post"; status: string; site: string;
  views_30d: number; leads_30d: number; published_at: string | null;
}
export interface Deployment { id: string; site: string; status: string; commit_ref: string | null; duration_ms: number | null; created_at: string; url: string | null }
export interface Lead { id: string; full_name: string; email: string | null; company: string | null; page: string | null; status: string; created_at: string }
export interface Ticket {
  id: string; number: number; subject: string; status: string; priority: string; category: string;
  created_at: string; sla_due_at: string | null; client_name?: string;
}
export interface Invoice { id: string; label: string; issued_at: string; total: number; status: string; cae: string | null }
export interface Kpis {
  mrr: number; active_clients: number; ai_share: number | null; open_alerts: number; open_tickets: number;
  contracts_expiring_30d: number; sales_month: number; new_leads_7d: number;
  resources: Partial<Record<HealthStatus, number>>;
}
