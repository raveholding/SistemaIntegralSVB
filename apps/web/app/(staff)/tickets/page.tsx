import { LifeBuoy } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { PRIORITY, StatusPill, TICKET, Pill } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { getTickets } from "@/lib/data/portal";
import { relative } from "@/lib/format";
import { requirePerm } from "@/lib/session";

export const metadata = { title: "Soporte" };

export default async function TicketsPage() {
  await requirePerm("tickets.read");
  const tickets = await getTickets();
  return (
    <>
      <PageHeader eyebrow="Mesa de ayuda" title="Tickets de soporte" subtitle="Abiertos desde el portal de clientes, ordenados por vencimiento de SLA." />
      <Card>
        <CardHeader title="Cola activa" icon={<LifeBuoy className="h-4 w-4" />} />
        <Table>
          <THead><tr><Th>#</Th><Th>Asunto</Th><Th>Cliente</Th><Th>Prioridad</Th><Th>Estado</Th><Th>SLA</Th><Th>Abierto</Th></tr></THead>
          <tbody>
            {tickets.map((t) => {
              const left = t.sla_due_at ? (new Date(t.sla_due_at).getTime() - Date.now()) / 3600_000 : null;
              return (
                <Tr key={t.id}>
                  <Td className="font-mono text-xs">#{t.number}</Td>
                  <Td className="text-fg">{t.subject}{t.category === "upgrade" && <Pill tone="brand" className="ml-2">Upgrade</Pill>}</Td>
                  <Td>{t.client_name}</Td>
                  <Td><StatusPill map={PRIORITY} value={t.priority} /></Td>
                  <Td><StatusPill map={TICKET} value={t.status} /></Td>
                  <Td>{left == null ? "—" : <Pill tone={left < 0 ? "crit" : left < 4 ? "warn" : "ok"}>{left < 0 ? "Vencido" : `${left.toFixed(1)} h`}</Pill>}</Td>
                  <Td className="text-xs">{relative(t.created_at)}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
