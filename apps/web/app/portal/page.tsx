import { CheckCircle2, Download, FileText, LifeBuoy, Receipt } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { HEALTH, Pill, StatusDot, StatusPill, TICKET, CONTRACT } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { TicketForm, UpgradeRequest } from "@/components/portal/forms";
import { getPortalOverview } from "@/lib/data/portal";
import { getPlans } from "@/lib/data/crm";
import { dateShort, daysUntil, money, relative } from "@/lib/format";

export const metadata = { title: "Mi servicio" };

export default async function PortalHome() {
  const [o, plans] = await Promise.all([getPortalOverview(), getPlans()]);
  const allOk = o.services.every((s) => s.status === "operational" || s.status === "maintenance");
  const upgrade = o.plan && !o.plan.includes_ai ? plans.find((p) => p.includes_ai) : null;
  const days = daysUntil(o.contract?.end_date);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{o.clientName}</h1>
      <p className="mt-1 text-sm text-fg-muted">Estado de tu servicio, contrato, facturas y soporte.</p>

      {/* Estado operativo: simple y en verde, sin detalles técnicos */}
      <Card className={allOk ? "mt-6 overflow-hidden ring-1 ring-ok/25" : "mt-6 overflow-hidden ring-1 ring-warn/30"}>
        <div className="flex items-center gap-4 px-6 py-5">
          {allOk ? <CheckCircle2 className="h-10 w-10 text-ok drop-shadow-[0_0_12px_rgba(34,227,155,0.6)]" /> : <StatusDot tone="warn" pulse />}
          <div>
            <p className={allOk ? "text-lg font-semibold text-ok" : "text-lg font-semibold text-warn"}>
              {allOk ? "Todos tus servicios funcionan correctamente" : "Estamos trabajando en un inconveniente"}
            </p>
            <p className="text-xs text-fg-subtle">Monitoreo 24/7 · actualizado {relative(new Date().toISOString())}</p>
          </div>
        </div>
        <div className="grid gap-px bg-white/[0.04] sm:grid-cols-2">
          {o.services.map((s) => (
            <div key={s.resource_id} className="flex items-center gap-3 bg-ink-850 px-6 py-3">
              <StatusDot tone={HEALTH[s.status][0]} />
              <span className="flex-1 text-sm text-fg">{s.service_name}</span>
              <span className="text-xs tabular-nums text-fg-subtle">{Number(s.uptime_30d).toFixed(2)} % · 30 d</span>
              <StatusPill map={HEALTH} value={s.status} dot={false} />
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Mi contrato" icon={<FileText className="h-4 w-4" />}
            action={o.contract && <StatusPill map={CONTRACT} value={o.contract.status} />} />
          <CardBody className="space-y-3 text-sm">
            {o.contract ? (
              <>
                <p className="font-medium text-fg">{o.contract.title}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-fg-muted">
                  <span>Código <span className="block font-mono text-fg">{o.contract.code}</span></span>
                  <span>Vigencia <span className="block text-fg">{dateShort(o.contract.start_date)} → {dateShort(o.contract.end_date)}</span></span>
                </div>
                {days != null && days <= 30 && days >= 0 && <Pill tone="warn" dot>Renovación en {days} días</Pill>}
                {o.contract.path && (
                  <a href={`/api/contracts/download?path=${encodeURIComponent(o.contract.path)}`} className="inline-flex items-center gap-2 text-xs text-brand hover:underline">
                    <Download className="h-3.5 w-3.5" /> Descargar PDF firmado
                  </a>
                )}
              </>
            ) : <p className="text-fg-subtle">Sin contrato vigente.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mi plan" />
          <CardBody className="space-y-3">
            {o.plan && (
              <div className="flex items-baseline justify-between">
                <p className="font-medium text-fg">{o.plan.name}</p>
                <p className="text-xl font-semibold tabular-nums text-fg">{money(o.plan.price)}<span className="text-xs font-normal text-fg-subtle"> /mes</span></p>
              </div>
            )}
            {upgrade && (
              <div className="rounded-xl border border-brand/20 bg-brand/[0.06] p-4">
                <p className="text-sm font-medium text-fg">Sumá automatizaciones e IA</p>
                <p className="mb-3 mt-1 text-xs text-fg-muted">{upgrade.features.slice(1).join(" · ")} — {money(upgrade.price_monthly)}/mes</p>
                <UpgradeRequest planId={upgrade.id} planName={upgrade.name} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Mis facturas y recibos" icon={<Receipt className="h-4 w-4" />} />
        <Table>
          <THead><tr><Th>Comprobante</Th><Th>Fecha</Th><Th>CAE</Th><Th className="text-right">Total</Th></tr></THead>
          <tbody>
            {o.invoices.map((i) => (
              <Tr key={i.id}>
                <Td className="font-mono text-xs text-fg">{i.label}{i.status === "voided" && <Pill tone="crit" className="ml-2">Anulado</Pill>}</Td>
                <Td className="text-xs">{dateShort(i.issued_at)}</Td>
                <Td className="font-mono text-[11px]">{i.cae ?? "—"}</Td>
                <Td className="text-right font-semibold tabular-nums text-fg">{money(i.total, true)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader title="Mis tickets" icon={<LifeBuoy className="h-4 w-4" />} />
          <ul className="divide-y divide-white/[0.04]">
            {o.tickets.length === 0 && <li className="px-5 py-6 text-sm text-fg-subtle">No tenés tickets.</li>}
            {o.tickets.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span className="font-mono text-xs text-fg-subtle">#{t.number}</span>
                <span className="flex-1 truncate text-sm text-fg">{t.subject}</span>
                <span className="text-[11px] text-fg-subtle">{relative(t.created_at)}</span>
                <StatusPill map={TICKET} value={t.status} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader title="Abrir un ticket" subtitle="Respuesta según urgencia: 4 h a 5 días" />
          <CardBody><TicketForm /></CardBody>
        </Card>
      </div>
    </>
  );
}
