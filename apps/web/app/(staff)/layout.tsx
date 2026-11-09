import { redirect } from "next/navigation";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { DemoBanner } from "@/components/ui/misc";
import { getContext } from "@/lib/session";
import { getKpis } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/",          label: "Resumen",          icon: "dashboard", perm: "crm.read" },
  { href: "/monitor",   label: "Infraestructura",  icon: "monitor",   perm: "monitor.read" },
  { href: "/documentos",label: "Contratos",        icon: "docs",      perm: "docs.read" },
  { href: "/crm",       label: "CRM y planes",     icon: "crm",       perm: "crm.read" },
  { href: "/caja",      label: "Caja y POS",       icon: "pos",       perm: "pos.operate" },
  { href: "/rrhh",      label: "Equipo",           icon: "hr",        perm: "hr.read" },
  { href: "/cms",       label: "Web y CMS",        icon: "cms",       perm: "cms.read" },
  { href: "/tickets",   label: "Soporte",          icon: "tickets",   perm: "tickets.read" },
  { href: "/auditoria", label: "Auditoría",        icon: "audit",     perm: "audit.read" },
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  if (ctx.portal) redirect("/portal");               // aislamiento: clientes nunca ven el backoffice

  const kpis = await getKpis(ctx.tenantId).catch(() => null);
  const items = NAV.filter((n) => ctx.perms.includes(n.perm)).map((n) => ({
    ...n,
    badge: n.icon === "monitor" ? kpis?.open_alerts : n.icon === "tickets" ? kpis?.open_tickets : undefined,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} tenant="Vincular Business" />
      <div className="min-w-0 flex-1">
        <Topbar name={ctx.name} role={ctx.role} notifications={(kpis?.open_alerts ?? 0) + (kpis?.contracts_expiring_30d ?? 0)} />
        <main className="mx-auto max-w-[1400px] px-6 py-8">
          {ctx.demo && <DemoBanner />}
          {children}
        </main>
      </div>
    </div>
  );
}
