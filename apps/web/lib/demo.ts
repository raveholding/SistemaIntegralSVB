/**
 * Datos de demostración (MODO DEMO): se usan cuando no hay credenciales de Supabase.
 * Reflejan el mismo seed de supabase/seed.sql para que la UI se vea idéntica.
 */
import type {
  Alert, AuditEvent, CashMovement, CashSession, ClientRow, CmsPage, Contract, Deployment, Employee,
  Invoice, Kpis, Lead, MetricPoint, Plan, Resource, Ticket,
} from "./types";

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const inDays = (d: number) => new Date(now + d * 86_400_000).toISOString().slice(0, 10);

export const demoUser = { id: "demo-owner", name: "Nico", email: "nico@vincular.business" };

export const demoKpis: Kpis = {
  mrr: 610000, active_clients: 9, ai_share: 44.4, open_alerts: 2, open_tickets: 3,
  contracts_expiring_30d: 2, sales_month: 1_245_000, new_leads_7d: 7,
  resources: { operational: 9, degraded: 1, down: 1 },
};

export const demoResources: Resource[] = [
  { id: "r1", name: "barberia-prod-db", public_name: "Base de datos", kind: "supabase_project", region: "sa-east-1", status: "operational", last_heartbeat_at: ago(0.3), client_name: "Barbería Juan", cpu_pct: 23, mem_pct: 41, latency_ms: 38 },
  { id: "r2", name: "barberia-web", public_name: "Sitio web y turnero", kind: "website", region: "sa-east-1", status: "operational", last_heartbeat_at: ago(0.5), client_name: "Barbería Juan", cpu_pct: 12, mem_pct: 33, latency_ms: 142 },
  { id: "r3", name: "camping-api", public_name: "Sistema de socios", kind: "api", region: "sa-east-1", status: "down", last_heartbeat_at: ago(9), client_name: "Club Camping", cpu_pct: null, mem_pct: null, latency_ms: null },
  { id: "r4", name: "gym-mi-prod", public_name: "App de entrenamiento", kind: "server", region: "us-east-1", status: "degraded", last_heartbeat_at: ago(0.2), client_name: "Movimiento Inteligente", cpu_pct: 88, mem_pct: 86, latency_ms: 1720 },
  { id: "r5", name: "estudio-norte-db", public_name: "Base de datos", kind: "database", region: "sa-east-1", status: "operational", last_heartbeat_at: ago(0.4), client_name: "Estudio Norte", cpu_pct: 31, mem_pct: 52, latency_ms: 21 },
  { id: "r6", name: "arca-gateway", public_name: "Facturación electrónica", kind: "worker", region: "sa-east-1", status: "operational", last_heartbeat_at: ago(0.6), client_name: null, cpu_pct: 9, mem_pct: 27, latency_ms: 310 },
  { id: "r7", name: "rave-menu-qr", public_name: "Menú digital", kind: "website", region: "sa-east-1", status: "operational", last_heartbeat_at: ago(0.7), client_name: "RAVE", cpu_pct: 6, mem_pct: 18, latency_ms: 96 },
  { id: "r8", name: "svb-core-api", public_name: null, kind: "api", region: "sa-east-1", status: "operational", last_heartbeat_at: ago(0.1), client_name: null, cpu_pct: 34, mem_pct: 47, latency_ms: 64 },
];

export function demoSeries(points = 60, base = { cpu: 35, mem: 50, lat: 120 }): MetricPoint[] {
  return Array.from({ length: points }, (_, i) => {
    const t = i / points;
    const spike = i > points * 0.7 && i < points * 0.82 ? 1 : 0;
    return {
      ts: new Date(now - (points - i) * 60_000).toISOString(),
      cpu_pct: Math.min(100, base.cpu + Math.sin(t * 9) * 8 + spike * 45 + ((i * 7) % 5)),
      mem_pct: Math.min(100, base.mem + t * 10 + spike * 18 + ((i * 3) % 4)),
      latency_ms: base.lat + Math.cos(t * 7) * 30 + spike * 900 + ((i * 11) % 25),
    };
  });
}

export const demoAlerts: Alert[] = [
  { id: "a1", severity: "critical", status: "open", title: "camping-api: sin heartbeat", message: "Último latido: hace 9 min", opened_at: ago(6), resolved_at: null, notified_at: ago(6) },
  { id: "a2", severity: "warning", status: "acknowledged", title: "gym-mi-prod: latency_ms > 1500", message: "Valor actual 1720 durante 3 muestras", opened_at: ago(14), resolved_at: null, notified_at: ago(14) },
  { id: "a3", severity: "critical", status: "resolved", title: "barberia-prod-db: cpu_pct > 90", message: "Valor actual 95 durante 3 muestras", opened_at: ago(190), resolved_at: ago(172), notified_at: ago(190) },
  { id: "a4", severity: "warning", status: "resolved", title: "estudio-norte-db: mem_pct > 85", message: "Valor actual 87 durante 3 muestras", opened_at: ago(1500), resolved_at: ago(1460), notified_at: ago(1500) },
];

export const demoPlans: Plan[] = [
  { id: "b1000000-0000-0000-0000-000000000001", code: "ESENCIAL", name: "Abono Esencial", tier: 1, price_monthly: 50000, includes_ai: false,
    features: ["Sistema de gestión a medida", "Hosting y backups", "Soporte en horario comercial", "Monitoreo 24/7"] },
  { id: "b1000000-0000-0000-0000-000000000002", code: "PRO_IA", name: "Abono Pro + IA", tier: 2, price_monthly: 80000, includes_ai: true,
    features: ["Todo lo del plan Esencial", "Automatizaciones (WhatsApp, email, reportes)", "Asistente con IA integrado", "Soporte prioritario 4 h"] },
];

export const demoClients: ClientRow[] = [
  { id: "c1", legal_name: "Barbería Juan SRL", trade_name: "Barbería Juan", status: "active", city: "Salta", industry: "Servicios", plan_name: "Abono Esencial", plan_id: demoPlans[0].id, subscription_id: "s1", mrr: 50000, last_interaction: ago(60 * 26), owner_name: "Lucía" },
  { id: "c2", legal_name: "Club Camping Asoc. Civil", trade_name: "Club Camping", status: "active", city: "Salta", industry: "Clubes", plan_name: "Abono Pro + IA", plan_id: demoPlans[1].id, subscription_id: "s2", mrr: 80000, last_interaction: ago(60 * 3), owner_name: "Lucía" },
  { id: "c3", legal_name: "Movimiento Inteligente", trade_name: "Movimiento Inteligente", status: "active", city: "Salta", industry: "Fitness", plan_name: "Abono Pro + IA", plan_id: demoPlans[1].id, subscription_id: "s3", mrr: 80000, last_interaction: ago(60 * 50), owner_name: "Nico" },
  { id: "c4", legal_name: "Estudio Contable Norte", trade_name: "Estudio Norte", status: "active", city: "Salta", industry: "Contable", plan_name: "Abono Esencial", plan_id: demoPlans[0].id, subscription_id: "s4", mrr: 50000, last_interaction: ago(60 * 120), owner_name: "Lucía" },
  { id: "c5", legal_name: "RAVE Holding", trade_name: "RAVE", status: "active", city: "Salta", industry: "Gastronomía", plan_name: "Abono Esencial", plan_id: demoPlans[0].id, subscription_id: "s5", mrr: 50000, last_interaction: ago(60 * 8), owner_name: "Nico" },
  { id: "c6", legal_name: "Gym Norte", trade_name: "Gym Norte", status: "lead", city: "Salta", industry: "Fitness", plan_name: null, plan_id: null, subscription_id: null, mrr: null, last_interaction: ago(60 * 2), owner_name: "Lucía" },
];

export const demoContracts: Contract[] = [
  { id: "k1", code: "CTR-2026-0001", title: "Servicio · Abono Esencial", client_name: "Barbería Juan", status: "signed", start_date: inDays(-350), end_date: inDays(15), value_amount: 600000, versions: 2, current_version_path: "demo/v2.pdf" },
  { id: "k2", code: "CTR-2026-0002", title: "Servicio · Pro + IA", client_name: "Club Camping", status: "signed", start_date: inDays(-120), end_date: inDays(245), value_amount: 960000, versions: 1, current_version_path: "demo/v1.pdf" },
  { id: "k3", code: "CTR-2026-0003", title: "Desarrollo app entrenadores", client_name: "Movimiento Inteligente", status: "pending_signature", start_date: inDays(3), end_date: inDays(368), value_amount: 1450000, versions: 3, current_version_path: "demo/v3.pdf" },
  { id: "k4", code: "CTR-2026-0004", title: "Servicio · Abono Esencial", client_name: "Estudio Norte", status: "signed", start_date: inDays(-358), end_date: inDays(7), value_amount: 600000, versions: 1, current_version_path: "demo/v1.pdf" },
  { id: "k5", code: "CTR-2026-0005", title: "Propuesta menú QR + pedidos", client_name: "Gym Norte", status: "draft", start_date: null, end_date: null, value_amount: 420000, versions: 1, current_version_path: "demo/v1.pdf" },
  { id: "k6", code: "CTR-2025-0019", title: "Mantenimiento web 2025", client_name: "RAVE", status: "expired", start_date: inDays(-400), end_date: inDays(-35), value_amount: 360000, versions: 1, current_version_path: "demo/v1.pdf" },
];

export const demoSession: CashSession = {
  session_id: "cs1", register_name: "Caja Principal", status: "open", opened_at: ago(260), opened_by_name: "Lucía",
  opening_amount: 10000, cash_balance: 70000, gross_sales: 100000, movement_count: 3,
};

export const demoMovements: CashMovement[] = [
  { id: "m3", created_at: ago(20), kind: "sale", method: "transfer", amount: 20000, reference: "op 99812", user_name: "Lucía", doc_label: "Factura B 0001-00000001" },
  { id: "m2", created_at: ago(20), kind: "sale", method: "cash", amount: 40000, reference: null, user_name: "Lucía", doc_label: "Factura B 0001-00000001" },
  { id: "m1", created_at: ago(180), kind: "deposit", method: "cash", amount: 20000, reference: null, user_name: "Lucía", doc_label: "Seña 0001-00000001" },
];

const h = (n: number) => [...Array(64)].map((_, i) => "0123456789abcdef"[(n * 31 + i * 7) % 16]).join("");
export const demoAudit: AuditEvent[] = [
  { id: 1042, occurred_at: ago(19), actor_name: "Lucía", actor_role: "seller", action: "INSERT", table_name: "public.cash_movements", record_id: "m3", amount: 20000, payment_method: "transfer", ip: "181.15.22.4", changed_cols: null, hash_hex: h(1042) },
  { id: 1041, occurred_at: ago(19), actor_name: "Lucía", actor_role: "seller", action: "INSERT", table_name: "public.cash_movements", record_id: "m2", amount: 40000, payment_method: "cash", ip: "181.15.22.4", changed_cols: null, hash_hex: h(1041) },
  { id: 1040, occurred_at: ago(20), actor_name: "Lucía", actor_role: "seller", action: "INSERT", table_name: "public.sales_documents", record_id: "d2", amount: null, payment_method: null, ip: "181.15.22.4", changed_cols: null, hash_hex: h(1040) },
  { id: 1039, occurred_at: ago(95), actor_name: "Nico", actor_role: "owner", action: "UPDATE", table_name: "public.subscriptions", record_id: "s2", amount: null, payment_method: null, ip: "190.2.10.77", changed_cols: ["plan_id", "price_override"], hash_hex: h(1039) },
  { id: 1038, occurred_at: ago(180), actor_name: "Lucía", actor_role: "seller", action: "INSERT", table_name: "public.cash_movements", record_id: "m1", amount: 20000, payment_method: "cash", ip: "181.15.22.4", changed_cols: null, hash_hex: h(1038) },
  { id: 1037, occurred_at: ago(260), actor_name: "Lucía", actor_role: "seller", action: "INSERT", table_name: "public.cash_sessions", record_id: "cs1", amount: null, payment_method: null, ip: "181.15.22.4", changed_cols: null, hash_hex: h(1037) },
  { id: 1036, occurred_at: ago(600), actor_name: "Nico", actor_role: "owner", action: "UPDATE", table_name: "public.contracts", record_id: "k1", amount: null, payment_method: null, ip: "190.2.10.77", changed_cols: ["signed_at", "signed_by_name", "status"], hash_hex: h(1036) },
];

export const demoEmployees: Employee[] = [
  { id: "e1", full_name: "Nico", position: "Socio fundador", staff_type: "partner", role: "owner", is_active: true, goal: null, sales: 410000, commission: null, commission_status: null },
  { id: "e2", full_name: "Lucía Vendedora", position: "Ejecutiva comercial", staff_type: "seller", role: "seller", is_active: true, goal: 500000, sales: 635000, commission: 63500, commission_status: "pending" },
  { id: "e3", full_name: "Tomás Ruiz", position: "Vendedor junior", staff_type: "seller", role: "seller", is_active: true, goal: 300000, sales: 200000, commission: 10000, commission_status: "approved" },
  { id: "e4", full_name: "Martín Técnico", position: "DevOps", staff_type: "technician", role: "technician", is_active: true, goal: null, sales: 0, commission: null, commission_status: null },
  { id: "e5", full_name: "Sofía Díaz", position: "Administración", staff_type: "employee", role: "admin", is_active: true, goal: null, sales: 0, commission: null, commission_status: null },
];

export const demoPages: CmsPage[] = [
  { id: "p1", title: "Inicio", slug: "", kind: "page", status: "published", site: "vincular.business", views_30d: 4820, leads_30d: 12, published_at: ago(60 * 24 * 6) },
  { id: "p2", title: "Landing · Demo gratis", slug: "demo-gratis", kind: "landing", status: "published", site: "vincular.business", views_30d: 1930, leads_30d: 41, published_at: ago(60 * 24 * 12) },
  { id: "p3", title: "Landing · Barberías", slug: "barberias", kind: "landing", status: "published", site: "vincular.business", views_30d: 860, leads_30d: 19, published_at: ago(60 * 24 * 3) },
  { id: "p4", title: "Landing · Gimnasios", slug: "gimnasios", kind: "landing", status: "draft", site: "vincular.business", views_30d: 0, leads_30d: 0, published_at: null },
];

export const demoDeployments: Deployment[] = [
  { id: "d1", site: "vincular.business", status: "ready", commit_ref: "a1f9c2e", duration_ms: 41200, created_at: ago(60 * 3), url: "https://vincular.business" },
  { id: "d2", site: "vincular.business", status: "error", commit_ref: "77be010", duration_ms: 12800, created_at: ago(60 * 26), url: null },
  { id: "d3", site: "vincular.business", status: "ready", commit_ref: "4c0aa91", duration_ms: 39800, created_at: ago(60 * 74), url: "https://vincular.business" },
];

export const demoLeads: Lead[] = [
  { id: "l1", full_name: "María Gómez", email: "maria@gimnasio.com", company: "Gym Norte", page: "Landing · Demo gratis", status: "new", created_at: ago(45) },
  { id: "l2", full_name: "Carlos Fernández", email: "carlos@barberking.com", company: "Barber King", page: "Landing · Barberías", status: "contacted", created_at: ago(60 * 20) },
  { id: "l3", full_name: "Ana López", email: "ana@kiosco24.com", company: "Kiosco 24", page: "Inicio", status: "qualified", created_at: ago(60 * 52) },
];

export const demoTickets: Ticket[] = [
  { id: "t1", number: 128, subject: "No carga el turnero", status: "in_progress", priority: "urgent", category: "general", created_at: ago(35), sla_due_at: new Date(now + 3.4 * 3600_000).toISOString(), client_name: "Barbería Juan" },
  { id: "t2", number: 127, subject: "Solicitud de upgrade a Abono Pro + IA", status: "open", priority: "high", category: "upgrade", created_at: ago(60 * 5), sla_due_at: new Date(now + 19 * 3600_000).toISOString(), client_name: "Barbería Juan" },
  { id: "t3", number: 121, subject: "Agregar usuario para recepción", status: "resolved", priority: "normal", category: "general", created_at: ago(60 * 24 * 4), sla_due_at: null, client_name: "Barbería Juan" },
];

export const demoInvoices: Invoice[] = [
  { id: "i1", label: "Factura B 0001-00000001", issued_at: ago(20), total: 80000, status: "issued", cae: "76451230987412" },
  { id: "i2", label: "Seña 0001-00000001", issued_at: ago(180), total: 20000, status: "issued", cae: null },
  { id: "i3", label: "Factura B 0001-00000000", issued_at: ago(60 * 24 * 31), total: 50000, status: "issued", cae: "76321230981134" },
];
