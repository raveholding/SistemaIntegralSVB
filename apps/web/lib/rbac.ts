import type { AppRole } from "./claims";

/** Espejo de supabase/migrations/*_rbac_catalog.sql. La autoridad final es RLS; esto sólo filtra UI. */
export type Permission =
  | "monitor.read" | "monitor.manage"
  | "docs.read" | "docs.write" | "docs.sign"
  | "crm.read" | "crm.write" | "billing.manage"
  | "pos.operate" | "pos.supervise" | "pos.void"
  | "hr.read" | "hr.manage" | "commissions.approve"
  | "cms.read" | "cms.write" | "cms.publish"
  | "tickets.read" | "tickets.manage"
  | "audit.read" | "settings.manage";

const ALL: Permission[] = [
  "monitor.read", "monitor.manage", "docs.read", "docs.write", "docs.sign", "crm.read", "crm.write",
  "billing.manage", "pos.operate", "pos.supervise", "pos.void", "hr.read", "hr.manage",
  "commissions.approve", "cms.read", "cms.write", "cms.publish", "tickets.read", "tickets.manage",
  "audit.read", "settings.manage",
];

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  owner: ALL,
  partner: ALL,
  admin: ALL.filter((p) => !["monitor.manage", "commissions.approve", "settings.manage", "cms.publish"].includes(p)),
  employee: ["crm.read", "pos.operate", "tickets.read", "cms.read", "docs.read"],
  seller: ["crm.read", "crm.write", "docs.read", "pos.operate", "cms.read", "tickets.read"],
  technician: ["monitor.read", "monitor.manage", "tickets.read", "tickets.manage", "cms.read", "cms.write", "crm.read"],
  client_admin: [],
  client_user: [],
};

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Dueño", partner: "Socio", admin: "Administración", employee: "Empleado",
  seller: "Vendedor", technician: "Técnico", client_admin: "Cliente (admin)", client_user: "Cliente",
};

export const can = (perms: readonly string[], p: Permission) => perms.includes(p);
