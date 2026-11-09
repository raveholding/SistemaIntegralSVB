"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/session";

export type ActionResult = { ok: boolean; message: string };

export async function changePlan(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const ctx = await requirePerm("billing.manage");
  const subscriptionId = String(formData.get("subscriptionId"));
  const planId = String(formData.get("planId"));
  if (ctx.demo) return { ok: true, message: "Demo: upgrade aplicado con prorrateo." };
  const db = await createSupabaseServer();
  const { data, error } = await db.rpc("change_subscription_plan", { p_subscription: subscriptionId, p_new_plan: planId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/crm");
  const amt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format((data as any).prorated_amount);
  return { ok: true, message: `Plan actualizado. Diferencia prorrateada a facturar: ${amt}` };
}

const Interaction = z.object({
  client_id: z.string().uuid(),
  kind: z.enum(["call", "email", "meeting", "whatsapp", "note", "demo"]),
  subject: z.string().min(2).max(200),
  body: z.string().max(4000).optional(),
});

export async function logInteraction(formData: FormData) {
  const ctx = await requirePerm("crm.write");
  if (ctx.demo) return;
  const db = await createSupabaseServer();
  const { error } = await db.from("interactions").insert(Interaction.parse(Object.fromEntries(formData)));
  if (error) throw new Error(error.message);
  revalidatePath("/crm");
}
