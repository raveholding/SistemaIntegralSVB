"use client";
import { useActionState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui/button";
import { closeSession, openSession, registerMovement, type PosResult } from "@/app/(staff)/caja/actions";

const Msg = ({ s }: { s: PosResult | null }) =>
  s ? <p className={s.ok ? "text-xs text-ok" : "text-xs text-crit"}>{s.message}</p> : null;

export function OpenSessionForm({ registers }: { registers: { id: string; name: string }[] }) {
  const [s, action, pending] = useActionState<PosResult | null, FormData>(openSession, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3 sm:items-end">
      <Field label="Caja">
        <select name="register" className={inputCls}>{registers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </Field>
      <Field label="Fondo inicial (efectivo)"><input name="opening" type="number" min={0} step="0.01" defaultValue={10000} className={inputCls} /></Field>
      <Button variant="success" disabled={pending}><Unlock className="h-4 w-4" /> Abrir caja</Button>
      <div className="sm:col-span-3"><Msg s={s} /></div>
    </form>
  );
}

export function MovementForm({ sessionId, canSupervise }: { sessionId: string; canSupervise: boolean }) {
  const [s, action, pending] = useActionState<PosResult | null, FormData>(registerMovement, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="session" value={sessionId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select name="kind" className={inputCls}>
            <option value="income">Ingreso</option>
            {canSupervise && <><option value="expense">Egreso / gasto</option><option value="withdrawal">Retiro</option></>}
          </select>
        </Field>
        <Field label="Medio">
          <select name="method" className={inputCls}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select>
        </Field>
      </div>
      <Field label="Importe"><input name="amount" type="number" min={0.01} step="0.01" required className={inputCls} /></Field>
      <Field label="Concepto"><input name="reference" required minLength={3} className={inputCls} placeholder="Ej.: compra insumos" /></Field>
      <Button variant="outline" className="w-full" disabled={pending}>Registrar</Button>
      <Msg s={s} />
    </form>
  );
}

export function CloseSessionForm({ sessionId, expected }: { sessionId: string; expected: number }) {
  const [s, action, pending] = useActionState<PosResult | null, FormData>(closeSession, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="session" value={sessionId} />
      <Field label="Efectivo contado (arqueo)" hint={`Esperado según sistema: $ ${expected.toLocaleString("es-AR")}`}>
        <input name="counted" type="number" min={0} step="0.01" required className={inputCls} />
      </Field>
      <Field label="Observaciones" hint="Obligatorio si hay diferencia de arqueo">
        <input name="notes" className={inputCls} />
      </Field>
      <Button variant="danger" className="w-full" disabled={pending}><Lock className="h-4 w-4" /> Cerrar caja</Button>
      <Msg s={s} />
    </form>
  );
}
