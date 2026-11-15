/** Espejo de supabase/migrations/*_licenses.sql. La autoridad final es la base (tenants_with / RLS). */
export type ModuleKey = "cms" | "crm" | "pos" | "docs" | "hr" | "monitor" | "portal" | "ai";

export interface License {
  package: string | null;
  package_name?: string;
  tier?: number;
  ai: boolean;
  status: "active" | "follow_up" | "none";
  follow_up_since?: string | null;
  modules: ModuleKey[];
}

export const PACKAGES = [
  { code: "menu",         name: "Menú",           price: 100000,  modules: ["cms"] as ModuleKey[] },
  { code: "crm_pos",      name: "Menú + CRM/POS", price: 400000,  modules: ["cms", "crm", "pos"] as ModuleKey[] },
  { code: "completo",     name: "Completo",       price: 700000,  modules: ["cms", "crm", "pos", "docs", "hr", "monitor"] as ModuleKey[] },
  { code: "completo_app", name: "Completo + App", price: 1200000, modules: ["cms", "crm", "pos", "docs", "hr", "monitor", "portal"] as ModuleKey[] },
];

export const MODULE_LABEL: Record<ModuleKey, string> = {
  cms: "Web y menú", crm: "CRM y planes", pos: "Caja y POS", docs: "Contratos",
  hr: "Equipo y comisiones", monitor: "Infraestructura", portal: "App del cliente y soporte", ai: "Asistente con IA (Pro + IA)",
};

/** Módulo que gobierna cada permiso (espejo de public.perm_module). null = siempre disponible. */
export function permModule(perm: string): ModuleKey | null {
  const m = perm.split(".")[0];
  const map: Record<string, ModuleKey> = {
    cms: "cms", crm: "crm", pos: "pos", docs: "docs", hr: "hr", commissions: "hr", monitor: "monitor", tickets: "portal",
  };
  return map[m] ?? null;
}

export const hasModule = (l: License, m: ModuleKey | null) => m === null || l.modules.includes(m);

export const DEMO_LICENSE: License = {
  package: "completo_app", package_name: "Completo + App", tier: 4, ai: true, status: "active",
  modules: ["cms", "crm", "pos", "docs", "hr", "monitor", "portal", "ai"],
};
