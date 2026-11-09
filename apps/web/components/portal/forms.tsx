"use client";
import { useActionState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { openTicket, requestUpgrade, type PortalResult } from "@/app/portal/actions";

const Msg = ({ s }: { s: PortalResult | null }) =>
  s ? <p className={s.ok ? "text-sm text-ok" : "text-sm text-crit"}>{s.message}</p> : null;

export function TicketForm() {
  const [s, action, pending] = useActionState<PortalResult | null, FormData>(openTicket, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Asunto"><input name="subject" required className={inputCls} placeholder="Ej.: no puedo emitir facturas" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select name="category" className={inputCls}>
            <option value="general">Problema general</option><option value="bug">Error del sistema</option>
            <option value="consulta">Consulta</option><option value="facturacion">Facturación</option><option value="nueva_funcion">Nueva función</option>
          </select>
        </Field>
        <Field label="Urgencia">
          <select name="priority" className={inputCls} defaultValue="normal">
            <option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente · sistema detenido</option>
          </select>
        </Field>
      </div>
      <Field label="Descripción"><textarea name="description" rows={4} required className={cn(inputCls, "h-auto py-2")} placeholder="Contanos qué pasó y desde cuándo" /></Field>
      <Button className="w-full" disabled={pending}><Send className="h-4 w-4" /> {pending ? "Enviando…" : "Enviar ticket"}</Button>
      <Msg s={s} />
    </form>
  );
}

export function UpgradeRequest({ planId, planName }: { planId: string; planName: string }) {
  const [s, action, pending] = useActionState<PortalResult | null, FormData>(requestUpgrade, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="planId" value={planId} />
      <Button variant="primary" className="w-full" disabled={pending || s?.ok}><Sparkles className="h-4 w-4" /> Quiero pasar a {planName}</Button>
      <Msg s={s} />
    </form>
  );
}
