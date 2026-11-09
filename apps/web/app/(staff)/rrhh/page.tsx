import { Calculator, ShieldCheck, Target, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader, Progress } from "@/components/ui/misc";
import { Pill } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { getTeam } from "@/lib/data/hr";
import { money } from "@/lib/format";
import { ROLE_LABEL, ROLE_PERMISSIONS, type Permission } from "@/lib/rbac";
import type { AppRole } from "@/lib/claims";
import { requirePerm } from "@/lib/session";
import { approveCommission, runCommissions } from "./actions";

export const metadata = { title: "Equipo" };

const STAFF: Record<string, [string, "brand" | "info" | "ok" | "neutral"]> = {
  partner: ["Socio", "brand"], seller: ["Vendedor", "info"], technician: ["Técnico", "ok"], employee: ["Empleado", "neutral"],
};
const MATRIX_ROLES: AppRole[] = ["owner", "partner", "admin", "seller", "technician", "employee"];
const MATRIX_PERMS: Permission[] = [
  "monitor.manage", "docs.sign", "billing.manage", "pos.operate", "pos.supervise", "pos.void",
  "hr.manage", "commissions.approve", "cms.publish", "tickets.manage", "audit.read", "settings.manage",
];

export default async function HrPage() {
  const ctx = await requirePerm("hr.read");
  const team = await getTeam();
  const sellers = team.filter((e) => e.goal);
  const totalSales = sellers.reduce((a, e) => a + e.sales, 0);
  const totalGoal = sellers.reduce((a, e) => a + (e.goal ?? 0), 0);
  const commissions = team.reduce((a, e) => a + (e.commission ?? 0), 0);
  const month = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader eyebrow="Módulo 5" title="Recursos humanos y rendimiento"
        subtitle={`Equipo interno, metas de venta y comisiones automáticas por tramos · ${month}`}
        actions={ctx.perms.includes("hr.manage") && (
          <form action={runCommissions}><Button variant="primary"><Calculator className="h-4 w-4" /> Recalcular comisiones</Button></form>
        )} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Kpi label="Integrantes" value={team.length} icon={<Users className="h-4 w-4" />} />
        <Kpi label="Ventas del equipo" value={money(totalSales)} tone="brand" />
        <Kpi label="Cumplimiento global" value={totalGoal ? `${Math.round((totalSales / totalGoal) * 100)} %` : "—"} tone={totalSales >= totalGoal ? "ok" : "warn"} icon={<Target className="h-4 w-4" />} />
        <Kpi label="Comisiones del mes" value={money(commissions)} tone="ok" hint="Tramos: 5 % · 8 % ≥100 % · 10 % ≥120 %" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Equipo y metas" />
        <Table>
          <THead><tr><Th>Integrante</Th><Th>Perfil</Th><Th>Rol de acceso</Th><Th className="w-64">Meta del mes</Th><Th>Comisión</Th><Th /></tr></THead>
          <tbody>
            {team.map((e) => {
              const pct = e.goal ? (e.sales / e.goal) * 100 : null;
              const [label, tone] = STAFF[e.staff_type];
              return (
                <Tr key={e.id}>
                  <Td><p className="font-medium text-fg">{e.full_name}</p><p className="text-xs">{e.position}</p></Td>
                  <Td><Pill tone={tone}>{label}</Pill></Td>
                  <Td className="text-xs">{e.role ? ROLE_LABEL[e.role as AppRole] : "—"}</Td>
                  <Td>
                    {pct == null ? <span className="text-fg-subtle">—</span> : (
                      <div className="space-y-1">
                        <Progress value={pct} />
                        <p className="flex justify-between text-[11px] tabular-nums"><span>{money(e.sales)} / {money(e.goal)}</span><span className={cn(pct >= 100 ? "text-ok" : "text-fg-muted")}>{pct.toFixed(0)} %</span></p>
                      </div>
                    )}
                  </Td>
                  <Td>
                    {e.commission != null ? (
                      <div><p className="font-semibold tabular-nums text-fg">{money(e.commission)}</p>
                        <Pill tone={e.commission_status === "pending" ? "warn" : e.commission_status === "paid" ? "ok" : "info"}>
                          {e.commission_status === "pending" ? "Pendiente" : e.commission_status === "approved" ? "Aprobada" : e.commission_status === "paid" ? "Pagada" : e.commission_status}
                        </Pill></div>
                    ) : <span className="text-fg-subtle">—</span>}
                  </Td>
                  <Td className="text-right">
                    {ctx.perms.includes("commissions.approve") && e.commission_status === "pending" && (
                      <form action={approveCommission}><input type="hidden" name="employeeId" value={e.id} /><Button size="sm" variant="success">Aprobar</Button></form>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Matriz de control de acceso (RBAC)" subtitle="Permisos por rol aplicados por RLS en la base · admite excepciones por persona" icon={<ShieldCheck className="h-4 w-4" />} />
        <Table>
          <THead><tr><Th>Permiso</Th>{MATRIX_ROLES.map((r) => <Th key={r} className="text-center">{ROLE_LABEL[r]}</Th>)}</tr></THead>
          <tbody>
            {MATRIX_PERMS.map((p) => (
              <Tr key={p}>
                <Td className="font-mono text-xs text-fg">{p}</Td>
                {MATRIX_ROLES.map((r) => (
                  <Td key={r} className="text-center">
                    {ROLE_PERMISSIONS[r].includes(p)
                      ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-ok shadow-glow text-ok" />
                      : <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/[0.08]" />}
                  </Td>
                ))}
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
