import { Download, FilePlus2, FileText, History } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button, Field, inputCls } from "@/components/ui/button";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/misc";
import { CONTRACT, StatusPill, Pill } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { ContractUploader } from "@/components/documents/contract-uploader";
import { getContracts } from "@/lib/data/documents";
import { getClients } from "@/lib/data/crm";
import { dateShort, daysUntil, money } from "@/lib/format";
import { requirePerm } from "@/lib/session";
import { createContract, signContract } from "./actions";

export const metadata = { title: "Contratos" };

function ExpiryBadge({ end, status }: { end: string | null; status: string }) {
  if (status !== "signed" || !end) return <span className="text-fg-subtle">—</span>;
  const d = daysUntil(end)!;
  if (d < 0) return <Pill tone="crit">Vencido</Pill>;
  if (d <= 7) return <Pill tone="crit" dot>{d} días</Pill>;
  if (d <= 30) return <Pill tone="warn" dot>{d} días</Pill>;
  return <Pill tone="ok">{d} días</Pill>;
}

export default async function DocumentsPage() {
  const ctx = await requirePerm("docs.read");
  const [contracts, clients] = await Promise.all([getContracts(), getClients()]);
  const editable = contracts.filter((c) => c.status === "draft" || c.status === "pending_signature");
  const signed = contracts.filter((c) => c.status === "signed");
  const expiring = signed.filter((c) => (daysUntil(c.end_date) ?? 999) <= 30);
  const clientIds = Object.fromEntries(contracts.map((c) => [c.id, clients.find((x) => (x.trade_name ?? x.legal_name) === c.client_name)?.id ?? ""]));

  return (
    <>
      <PageHeader eyebrow="Módulo 2" title="Gestor documental y de contratos"
        subtitle="Repositorio cifrado en la nube, versionado inmutable con huella SHA-256 y alertas de vencimiento." />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Kpi label="Firmados" value={signed.length} tone="ok" />
        <Kpi label="Borradores / en firma" value={editable.length} tone="neutral" />
        <Kpi label="Vencen en 30 días" value={expiring.length} tone={expiring.length ? "warn" : "ok"} hint="Aviso automático a 30/15/7 días" />
        <Kpi label="Valor bajo contrato" value={money(signed.reduce((a, c) => a + (c.value_amount ?? 0), 0))} tone="brand" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Contratos" icon={<FileText className="h-4 w-4" />} />
          <Table>
            <THead><tr><Th>Código</Th><Th>Cliente</Th><Th>Estado</Th><Th>Vigencia</Th><Th>Vence</Th><Th>Versiones</Th><Th /></tr></THead>
            <tbody>
              {contracts.map((c) => (
                <Tr key={c.id}>
                  <Td><p className="font-mono text-xs text-fg">{c.code}</p><p className="text-xs">{c.title}</p></Td>
                  <Td className="text-fg">{c.client_name}</Td>
                  <Td><StatusPill map={CONTRACT} value={c.status} /></Td>
                  <Td className="text-xs">{dateShort(c.start_date)} → {dateShort(c.end_date)}</Td>
                  <Td><ExpiryBadge end={c.end_date} status={c.status} /></Td>
                  <Td><span className="inline-flex items-center gap-1 text-xs"><History className="h-3.5 w-3.5" /> v{c.versions}</span></Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.current_version_path && (
                        <a href={`/api/contracts/download?path=${encodeURIComponent(c.current_version_path)}`}
                          className="rounded-lg p-2 text-fg-muted hover:bg-white/[0.05] hover:text-fg" title="Descargar PDF">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {ctx.perms.includes("docs.sign") && c.status === "pending_signature" && (
                        <form action={signContract}>
                          <input type="hidden" name="id" value={c.id} />
                          <Button size="sm" variant="success">Marcar firmado</Button>
                        </form>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <div className="space-y-6">
          {ctx.perms.includes("docs.write") && (
            <>
              <Card>
                <CardHeader title="Subir versión" subtitle="Bucket privado · sólo PDF" icon={<FilePlus2 className="h-4 w-4" />} />
                <CardBody><ContractUploader contracts={editable} tenantId={ctx.tenantId} clientIds={clientIds} /></CardBody>
              </Card>
              <Card>
                <CardHeader title="Nuevo contrato" />
                <CardBody>
                  <form action={createContract} className="space-y-3">
                    <Field label="Cliente">
                      <select name="client_id" className={inputCls} required>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.trade_name ?? c.legal_name}</option>)}
                      </select>
                    </Field>
                    <Field label="Título"><input name="title" className={inputCls} required placeholder="Contrato de servicio · Pro + IA" /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Inicio"><input type="date" name="start_date" className={inputCls} /></Field>
                      <Field label="Fin"><input type="date" name="end_date" className={inputCls} /></Field>
                    </div>
                    <Field label="Valor total (ARS)"><input type="number" name="value_amount" min={0} step="0.01" className={inputCls} /></Field>
                    <label className="flex items-center gap-2 text-xs text-fg-muted">
                      <input type="checkbox" name="auto_renew" value="true" className="accent-brand" /> Renovación automática anual
                    </label>
                    <Button className="w-full" variant="outline">Crear borrador</Button>
                  </form>
                </CardBody>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
