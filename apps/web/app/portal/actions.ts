"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getContext } from "@/lib/session";

export type PortalResult = { ok: boolean; message: string };

const NewTicket = z.object({
  subject: z.string().trim().min(3, "Asunto demasiado corto").max(200),
  description: z.string().trim().min(10, "Describa el problema con más detalle").max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  category: z.enum(["general", "bug", "consulta", "facturacion", "nueva_funcion"]),
});

export async function openTicket(_: PortalResult | null, fd: FormData): Promise<PortalResult> {
  const ctx = await getContext();
  const parsed = NewTicket.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (ctx.demo) return { ok: true, message: "Demo: ticket #129 creado. Te avisamos por email." };
  if (!ctx.clientId) return { ok: false, message: "Usuario sin empresa asignada" };
  const db = await createSupabaseServer();
  // tenant_id, número y SLA los asigna la base (triggers); RLS valida que sea su empresa
  const { data, error } = await db.from("support_tickets")
    .insert({ ...parsed.data, client_id: ctx.clientId, tenant_id: ctx.tenantId, opened_by: ctx.userId })
    .select("number").single();
  if (error) return { ok: false, message: error.message };
  revalidatePath("/portal");
  return { ok: true, message: `Ticket #${data.number} creado. Te avisamos por email.` };
}

export async function requestUpgrade(_: PortalResult | null, fd: FormData): Promise<PortalResult> {
  const ctx = await getContext();
  if (ctx.role !== "client_admin" && !ctx.demo) return { ok: false, message: "Sólo el administrador de tu empresa puede solicitarlo" };
  if (ctx.demo) return { ok: true, message: "Demo: solicitud enviada a tu ejecutivo de cuenta." };
  const db = await createSupabaseServer();
  const { error } = await db.rpc("request_plan_upgrade", { p_plan: String(fd.get("planId")), p_comment: (fd.get("comment") as string) || null });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/portal");
  return { ok: true, message: "Solicitud enviada. Tu ejecutivo te contactará en breve." };
}
