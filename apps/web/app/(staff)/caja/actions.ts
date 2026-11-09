"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/session";

export type PosResult = { ok: boolean; message: string; id?: string };

const money = z.coerce.number().positive().max(1e10).multipleOf(0.01);

// createSupabaseServer() reenvía IP, User-Agent y request-id del usuario final:
// audit.write_event los guarda junto a cada movimiento.
const db = createSupabaseServer;

export async function openSession(_: PosResult | null, fd: FormData): Promise<PosResult> {
  const ctx = await requirePerm("pos.operate");
  const opening = z.coerce.number().min(0).parse(fd.get("opening"));
  if (ctx.demo) return { ok: true, message: "Demo: caja abierta" };
  const { data, error } = await (await db()).rpc("open_cash_session", { p_register: String(fd.get("register")), p_opening: opening });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/caja");
  return { ok: true, message: "Caja abierta", id: data as string };
}

const Sale = z.object({
  session: z.string().min(1),
  doc_type: z.enum(["invoice_a", "invoice_b", "invoice_c", "ticket", "deposit_receipt", "receipt"]),
  client: z.string().uuid().optional().or(z.literal("")),
  apply_deposit: z.string().uuid().optional().or(z.literal("")),
  items: z.array(z.object({ description: z.string().min(1), quantity: z.coerce.number().positive(), unit_price: money, tax_rate: z.coerce.number().min(0).max(27) })).min(1),
  payments: z.array(z.object({ method: z.enum(["cash", "debit", "credit", "transfer", "mercadopago", "check", "other"]), amount: money, reference: z.string().optional() })),
});

export async function issueDocument(payload: z.input<typeof Sale>): Promise<PosResult> {
  const ctx = await requirePerm("pos.operate");
  const s = Sale.parse(payload);
  if (ctx.demo) return { ok: true, message: "Demo: comprobante emitido y registrado en auditoría" };
  const { data, error } = await (await db()).rpc("issue_sales_document", {
    p_session: s.session, p_doc_type: s.doc_type, p_items: s.items, p_payments: s.payments,
    p_client: s.client || null, p_apply_deposit: s.apply_deposit || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/caja");
  return { ok: true, message: "Comprobante emitido", id: data as string };
}

export async function registerMovement(_: PosResult | null, fd: FormData): Promise<PosResult> {
  const ctx = await requirePerm("pos.operate");
  if (ctx.demo) return { ok: true, message: "Demo: movimiento registrado" };
  const { error } = await (await db()).rpc("register_cash_movement", {
    p_session: String(fd.get("session")), p_kind: String(fd.get("kind")), p_method: String(fd.get("method")),
    p_amount: money.parse(fd.get("amount")), p_reference: String(fd.get("reference") ?? ""),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/caja");
  return { ok: true, message: "Movimiento registrado" };
}

export async function closeSession(_: PosResult | null, fd: FormData): Promise<PosResult> {
  const ctx = await requirePerm("pos.operate");
  if (ctx.demo) return { ok: true, message: "Demo: caja cerrada" };
  const { data, error } = await (await db()).rpc("close_cash_session", {
    p_session: String(fd.get("session")), p_counted: z.coerce.number().min(0).parse(fd.get("counted")),
    p_notes: (fd.get("notes") as string) || null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/caja");
  const diff = Number((data as any).difference);
  return { ok: true, message: diff === 0 ? "Caja cerrada sin diferencias" : `Caja cerrada con diferencia de ${diff}` };
}
