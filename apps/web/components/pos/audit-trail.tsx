import { Fingerprint } from "lucide-react";
import { Pill } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { dateTime, money } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

const METHOD: Record<string, string> = {
  cash: "Efectivo", transfer: "Transferencia", mercadopago: "Mercado Pago", debit: "Débito", credit: "Crédito", check: "Cheque", other: "Otro",
};
const ACTION_TONE: Record<string, "ok" | "warn" | "crit" | "info"> = { INSERT: "ok", UPDATE: "warn", DELETE: "crit" };

export function AuditTrail({ events }: { events: AuditEvent[] }) {
  return (
    <Table>
      <THead><tr><Th>#</Th><Th>Fecha y hora</Th><Th>Usuario</Th><Th>Acción</Th><Th>Entidad</Th><Th>Monto</Th><Th>Método</Th><Th>IP</Th><Th>Huella</Th></tr></THead>
      <tbody>
        {events.map((e) => (
          <Tr key={e.id}>
            <Td className="font-mono text-xs">{e.id}</Td>
            <Td className="whitespace-nowrap text-xs tabular-nums">{dateTime(e.occurred_at)}</Td>
            <Td><p className="text-fg">{e.actor_name ?? "sistema"}</p><p className="text-[11px]">{e.actor_role}</p></Td>
            <Td><Pill tone={ACTION_TONE[e.action] ?? "info"}>{e.action}</Pill></Td>
            <Td className="text-xs">
              <span className="font-mono">{e.table_name.replace("public.", "")}</span>
              {e.changed_cols?.length ? <p className="text-[11px] text-fg-subtle">Δ {e.changed_cols.join(", ")}</p> : null}
            </Td>
            <Td className="tabular-nums text-fg">{e.amount != null ? money(e.amount, true) : "—"}</Td>
            <Td className="text-xs">{e.payment_method ? METHOD[e.payment_method] ?? e.payment_method : "—"}</Td>
            <Td className="font-mono text-[11px]">{e.ip ?? "—"}</Td>
            <Td><span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-subtle" title={e.hash_hex}><Fingerprint className="h-3 w-3" />{e.hash_hex.slice(0, 10)}…</span></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
