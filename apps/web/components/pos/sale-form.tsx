"use client";
import { useMemo, useState, useTransition } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { money } from "@/lib/format";
import { issueDocument, type PosResult } from "@/app/(staff)/caja/actions";

const DOC_TYPES = [
  ["invoice_b", "Factura B"], ["invoice_a", "Factura A"], ["invoice_c", "Factura C"],
  ["ticket", "Ticket"], ["receipt", "Recibo"], ["deposit_receipt", "Recibo de seña / anticipo"],
] as const;
const METHODS = [
  ["cash", "Efectivo"], ["transfer", "Transferencia"], ["mercadopago", "Mercado Pago"],
  ["debit", "Débito"], ["credit", "Crédito"], ["check", "Cheque"],
] as const;

type Item = { description: string; quantity: number; unit_price: number; tax_rate: number };
type Pay = { method: string; amount: number; reference?: string };

export function SaleForm({ sessionId, clients, plans }: {
  sessionId: string; clients: { id: string; name: string }[]; plans: { name: string; price: number }[];
}) {
  const [docType, setDocType] = useState<string>("invoice_b");
  const [client, setClient] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: plans[0]?.name ?? "", quantity: 1, unit_price: plans[0]?.price ?? 0, tax_rate: 21 }]);
  const [pays, setPays] = useState<Pay[]>([{ method: "cash", amount: plans[0]?.price ?? 0 }]);
  const [res, setRes] = useState<PosResult | null>(null);
  const [pending, start] = useTransition();

  const totals = useMemo(() => {
    const sub = items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
    const tax = docType === "invoice_c" ? 0 : items.reduce((a, i) => {
      const line = i.quantity * i.unit_price;
      return a + (docType === "invoice_a" ? (line * i.tax_rate) / 100 : line - line / (1 + i.tax_rate / 100));
    }, 0);
    const total = docType === "invoice_a" ? sub + tax : sub;
    const paid = pays.reduce((a, p) => a + (Number(p.amount) || 0), 0);
    return { sub, tax, total, paid, diff: Math.round((total - paid) * 100) / 100 };
  }, [items, pays, docType]);

  const upd = <T,>(arr: T[], i: number, patch: Partial<T>) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x));

  const submit = () => start(async () => {
    setRes(await issueDocument({
      session: sessionId, doc_type: docType as any, client, items,
      payments: pays.filter((p) => p.amount > 0) as any,
    }));
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Comprobante">
          <select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Cliente">
          <select className={inputCls} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="">Consumidor final</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-fg-muted">Ítems</p>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input className={cn(inputCls, "col-span-5")} value={it.description} placeholder="Descripción"
              onChange={(e) => setItems(upd(items, i, { description: e.target.value }))} />
            <input className={cn(inputCls, "col-span-1 px-2")} type="number" min={1} value={it.quantity}
              onChange={(e) => setItems(upd(items, i, { quantity: Number(e.target.value) }))} />
            <input className={cn(inputCls, "col-span-3")} type="number" min={0} step="0.01" value={it.unit_price}
              onChange={(e) => setItems(upd(items, i, { unit_price: Number(e.target.value) }))} />
            <select className={cn(inputCls, "col-span-2 px-2")} value={it.tax_rate}
              onChange={(e) => setItems(upd(items, i, { tax_rate: Number(e.target.value) }))}>
              <option value={21}>21 %</option><option value={10.5}>10,5 %</option><option value={0}>0 %</option>
            </select>
            <button className="col-span-1 grid place-items-center text-fg-subtle hover:text-crit" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Quitar">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0, tax_rate: 21 }])}>
          <Plus className="h-3.5 w-3.5" /> Ítem
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-fg-muted">Medios de pago</p>
        {pays.map((p, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <select className={cn(inputCls, "col-span-4")} value={p.method} onChange={(e) => setPays(upd(pays, i, { method: e.target.value }))}>
              {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input className={cn(inputCls, "col-span-4")} type="number" min={0} step="0.01" value={p.amount}
              onChange={(e) => setPays(upd(pays, i, { amount: Number(e.target.value) }))} />
            <input className={cn(inputCls, "col-span-3")} placeholder="Ref." value={p.reference ?? ""}
              onChange={(e) => setPays(upd(pays, i, { reference: e.target.value }))} />
            <button className="col-span-1 grid place-items-center text-fg-subtle hover:text-crit" onClick={() => setPays(pays.filter((_, j) => j !== i))} aria-label="Quitar">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPays([...pays, { method: "transfer", amount: Math.max(0, totals.diff) }])}>
            <Plus className="h-3.5 w-3.5" /> Medio de pago
          </Button>
          {totals.diff !== 0 && pays.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setPays(upd(pays, pays.length - 1, { amount: (pays.at(-1)!.amount || 0) + totals.diff }))}>
              Completar saldo
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-ink-900 p-4 text-sm">
        <div className="flex justify-between text-fg-muted"><span>Neto</span><span className="tabular-nums">{money(docType === "invoice_a" ? totals.sub : totals.sub - totals.tax, true)}</span></div>
        <div className="flex justify-between text-fg-muted"><span>IVA {docType === "invoice_a" ? "discriminado" : "incluido"}</span><span className="tabular-nums">{money(totals.tax, true)}</span></div>
        <div className="mt-2 flex justify-between text-base font-semibold text-fg"><span>Total</span><span className="tabular-nums">{money(totals.total, true)}</span></div>
        <div className={cn("mt-1 flex justify-between text-xs", totals.diff === 0 ? "text-ok" : "text-warn")}>
          <span>{totals.diff === 0 ? "Pagos completos" : totals.diff > 0 ? "Falta cobrar" : "Excedente"}</span>
          <span className="tabular-nums">{money(Math.abs(totals.diff), true)}</span>
        </div>
      </div>

      <Button className="w-full" variant="success" disabled={pending || totals.diff !== 0 || totals.total <= 0} onClick={submit}>
        <Receipt className="h-4 w-4" /> {pending ? "Emitiendo…" : "Emitir comprobante"}
      </Button>
      {res && <p className={res.ok ? "text-xs text-ok" : "text-xs text-crit"}>{res.message}</p>}
    </div>
  );
}
