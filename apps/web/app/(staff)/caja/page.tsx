import { ArrowDownLeft, ArrowUpRight, ScrollText, ShoppingCart, Wallet } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/misc";
import { Pill, StatusDot } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { SaleForm } from "@/components/pos/sale-form";
import { CloseSessionForm, MovementForm, OpenSessionForm } from "@/components/pos/session-forms";
import { AuditTrail } from "@/components/pos/audit-trail";
import { getAuditFeed, getMovements, getOpenSession, getRegisters } from "@/lib/data/pos";
import { getClients, getPlans } from "@/lib/data/crm";
import { dateTime, money, relative } from "@/lib/format";
import { requirePerm } from "@/lib/session";

export const metadata = { title: "Caja y POS" };

const KIND: Record<string, string> = {
  sale: "Venta", deposit: "Seña", refund: "Devolución", income: "Ingreso", expense: "Egreso", withdrawal: "Retiro", reversal: "Reversión",
};

export default async function CajaPage() {
  const ctx = await requirePerm("pos.operate");
  const [session, registers, clients, plans] = await Promise.all([getOpenSession(), getRegisters(), getClients(), getPlans()]);
  const movements = session ? await getMovements(session.session_id) : [];
  const audit = ctx.perms.includes("audit.read") ? await getAuditFeed(ctx.tenantId, "public.cash_movements", 25).catch(() => []) : [];
  const byMethod = movements.reduce<Record<string, number>>((a, m) => ((a[m.method] = (a[m.method] ?? 0) + m.amount), a), {});

  return (
    <>
      <PageHeader eyebrow="Módulo 4" title="Punto de venta, caja y auditoría"
        subtitle="Apertura, saldo y cierre diario. Cada movimiento queda firmado en una cadena de auditoría inmutable." />

      {!session ? (
        <Card className="mb-6">
          <CardHeader title="No hay caja abierta" subtitle="Abra la caja para comenzar a operar" icon={<Wallet className="h-4 w-4" />} />
          <CardBody><OpenSessionForm registers={registers} /></CardBody>
        </Card>
      ) : (
        <>
          <Card className="mb-6 flex flex-wrap items-center gap-4 px-5 py-4">
            <StatusDot tone="ok" pulse />
            <p className="text-sm text-fg"><span className="font-semibold">{session.register_name}</span> abierta por {session.opened_by_name}</p>
            <Pill tone="neutral">{relative(session.opened_at)} · {dateTime(session.opened_at)}</Pill>
            <span className="ml-auto text-xs text-fg-subtle">{session.movement_count} movimientos</span>
          </Card>

          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Kpi label="Fondo inicial" value={money(session.opening_amount)} />
            <Kpi label="Saldo en efectivo" value={money(session.cash_balance)} tone="ok" icon={<Wallet className="h-4 w-4" />} hint="Esperado en el cajón" />
            <Kpi label="Ventas + señas" value={money(session.gross_sales)} tone="brand" />
            <Kpi label="Medios electrónicos" value={money(Object.entries(byMethod).filter(([k]) => k !== "cash").reduce((a, [, v]) => a + v, 0))} tone="info" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Nueva venta" subtitle="Factura, ticket, recibo o seña · pagos mixtos" icon={<ShoppingCart className="h-4 w-4" />} />
              <CardBody>
                <SaleForm sessionId={session.session_id}
                  clients={clients.map((c) => ({ id: c.id, name: c.trade_name ?? c.legal_name }))}
                  plans={plans.map((p) => ({ name: p.name, price: p.price_monthly }))} />
              </CardBody>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Ingreso / egreso manual" />
                <CardBody><MovementForm sessionId={session.session_id} canSupervise={ctx.perms.includes("pos.supervise")} /></CardBody>
              </Card>
              <Card>
                <CardHeader title="Cierre y arqueo" />
                <CardBody><CloseSessionForm sessionId={session.session_id} expected={session.cash_balance} /></CardBody>
              </Card>
            </div>
          </div>

          <Card className="mt-6">
            <CardHeader title="Movimientos de la sesión" subtitle="Libro inmutable: las correcciones se registran como reversión" />
            <Table>
              <THead><tr><Th>Hora</Th><Th>Tipo</Th><Th>Comprobante</Th><Th>Método</Th><Th>Referencia</Th><Th>Usuario</Th><Th className="text-right">Importe</Th></tr></THead>
              <tbody>
                {movements.map((m) => (
                  <Tr key={m.id}>
                    <Td className="text-xs tabular-nums">{dateTime(m.created_at)}</Td>
                    <Td><span className="inline-flex items-center gap-1.5 text-fg">{m.amount >= 0 ? <ArrowDownLeft className="h-3.5 w-3.5 text-ok" /> : <ArrowUpRight className="h-3.5 w-3.5 text-crit" />}{KIND[m.kind] ?? m.kind}</span></Td>
                    <Td className="font-mono text-xs">{m.doc_label ?? "—"}</Td>
                    <Td className="text-xs">{m.method}</Td>
                    <Td className="text-xs">{m.reference ?? "—"}</Td>
                    <Td>{m.user_name}</Td>
                    <Td className={cn("text-right font-semibold tabular-nums", m.amount >= 0 ? "text-ok" : "text-crit")}>{money(m.amount, true)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {audit.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Pista de auditoría · caja" subtitle="Usuario, monto, hora, método e IP de cada transacción (SHA-256 encadenado)" icon={<ScrollText className="h-4 w-4" />} />
          <AuditTrail events={audit} />
        </Card>
      )}
    </>
  );
}
