import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { AuditTrail } from "@/components/pos/audit-trail";
import { getAuditFeed, verifyAudit } from "@/lib/data/pos";
import { number } from "@/lib/format";
import { requirePerm } from "@/lib/session";

export const metadata = { title: "Auditoría" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const ctx = await requirePerm("audit.read");
  const { t } = await searchParams;
  const [events, check] = await Promise.all([getAuditFeed(ctx.tenantId, t, 200), verifyAudit(ctx.tenantId)]);

  return (
    <>
      <PageHeader eyebrow="Seguridad" title="Pista de auditoría"
        subtitle="Registro append-only con encadenamiento SHA-256 por tenant. Cualquier alteración rompe la cadena." />
      <Card className={check.ok ? "mb-6 flex items-center gap-4 px-5 py-4 ring-1 ring-ok/30" : "mb-6 flex items-center gap-4 px-5 py-4 ring-1 ring-crit/40"}>
        {check.ok ? <ShieldCheck className="h-8 w-8 text-ok" /> : <ShieldAlert className="h-8 w-8 text-crit" />}
        <div>
          <p className={check.ok ? "font-semibold text-ok" : "font-semibold text-crit"}>
            {check.ok ? "Integridad verificada" : `Cadena rota en el evento #${check.broken_event_id}`}
          </p>
          <p className="text-xs text-fg-muted">{check.ok ? `${number(check.events_checked)} eventos recalculados sin diferencias.` : check.reason}</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Eventos" subtitle="Filtrar: ?t=public.cash_movements · public.contracts · public.subscriptions" />
        <AuditTrail events={events} />
      </Card>
    </>
  );
}
