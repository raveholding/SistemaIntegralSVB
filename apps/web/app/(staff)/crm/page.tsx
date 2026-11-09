import { Bot, Check, MessageSquarePlus, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, Field, inputCls } from "@/components/ui/button";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/misc";
import { CLIENT, Pill, StatusPill } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { UpgradeButton } from "@/components/crm/upgrade-button";
import { getClients, getPlans } from "@/lib/data/crm";
import { money, relative } from "@/lib/format";
import { requirePerm } from "@/lib/session";
import { logInteraction } from "./actions";

export const metadata = { title: "CRM y planes" };

export default async function CrmPage() {
  const ctx = await requirePerm("crm.read");
  const [clients, plans] = await Promise.all([getClients(), getPlans()]);
  const top = plans.at(-1);
  const active = clients.filter((c) => c.status === "active");
  const mrr = active.reduce((a, c) => a + (c.mrr ?? 0), 0);
  const candidates = active.filter((c) => top && c.plan_id && c.plan_id !== top.id);
  const uplift = candidates.reduce((a, c) => a + ((top?.price_monthly ?? 0) - (c.mrr ?? 0)), 0);
  const canBill = ctx.perms.includes("billing.manage");

  // prorrateo estimado del resto del mes (el valor exacto lo calcula la base)
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remaining = daysInMonth - today.getDate() + 1;

  return (
    <>
      <PageHeader eyebrow="Módulo 3" title="CRM y suscripciones multi-nivel"
        subtitle="Cartera de clientes, historial de interacciones y planes con flujo de upgrade a IA." />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Kpi label="MRR" value={money(mrr)} tone="brand" />
        <Kpi label="Clientes activos" value={active.length} tone="ok" icon={<Users className="h-4 w-4" />} />
        <Kpi label="Prospectos" value={clients.filter((c) => c.status === "lead").length} tone="info" />
        <Kpi label="Potencial de upgrade" value={money(uplift)} tone="warn" hint={`${candidates.length} clientes sin IA`} icon={<Bot className="h-4 w-4" />} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.id} className={cn("relative overflow-hidden p-6", p.includes_ai && "ring-1 ring-brand/40")}>
            {p.includes_ai && <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-fg">{p.name}</h3>
              {p.includes_ai ? <Pill tone="brand" dot>Automatizaciones + IA</Pill> : <Pill>Abono fijo</Pill>}
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-fg">{money(p.price_monthly)}<span className="text-sm font-normal text-fg-subtle"> /mes</span></p>
            <ul className="mt-4 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-fg-muted"><Check className="h-4 w-4 text-ok" /> {f}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-fg-subtle">{clients.filter((c) => c.plan_id === p.id).length} clientes en este plan</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader title="Cartera de clientes" />
          <Table>
            <THead><tr><Th>Cliente</Th><Th>Estado</Th><Th>Plan</Th><Th>Abono</Th><Th>Responsable</Th><Th>Último contacto</Th><Th /></tr></THead>
            <tbody>
              {clients.map((c) => {
                const isTop = top && c.plan_id === top.id;
                const prorated = top && c.mrr != null ? Math.round(((top.price_monthly - c.mrr) * remaining) / daysInMonth) : 0;
                return (
                  <Tr key={c.id}>
                    <Td><p className="font-medium text-fg">{c.trade_name ?? c.legal_name}</p><p className="text-xs">{c.industry} · {c.city}</p></Td>
                    <Td><StatusPill map={CLIENT} value={c.status} /></Td>
                    <Td>{c.plan_name ? <Pill tone={isTop ? "brand" : "neutral"}>{c.plan_name}</Pill> : <span className="text-fg-subtle">—</span>}</Td>
                    <Td className="tabular-nums text-fg">{money(c.mrr)}</Td>
                    <Td>{c.owner_name ?? "—"}</Td>
                    <Td className="text-xs">{relative(c.last_interaction)}</Td>
                    <Td className="text-right">
                      {canBill && top && c.subscription_id && !isTop && (
                        <UpgradeButton subscriptionId={c.subscription_id} planId={top.id} label="Upgrade a IA"
                          preview={`Prorrateo estimado este mes: ${money(prorated)}`} />
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        {ctx.perms.includes("crm.write") && (
          <Card className="max-w-3xl">
            <CardHeader title="Registrar interacción" icon={<MessageSquarePlus className="h-4 w-4" />} />
            <CardBody>
              <form action={logInteraction} className="grid gap-3 sm:grid-cols-2">
                <Field label="Cliente">
                  <select name="client_id" className={inputCls}>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.trade_name ?? c.legal_name}</option>)}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select name="kind" className={inputCls}>
                    <option value="call">Llamada</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option>
                    <option value="meeting">Reunión</option><option value="demo">Demo</option><option value="note">Nota</option>
                  </select>
                </Field>
                <Field label="Asunto"><input name="subject" required className={inputCls} placeholder="Presentación plan Pro + IA" /></Field>
                <div className="sm:col-span-2"><Field label="Detalle"><textarea name="body" rows={3} className={cn(inputCls, "h-auto py-2")} /></Field></div>
                <Button className="sm:col-span-2" variant="outline">Guardar en historial</Button>
              </form>
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
