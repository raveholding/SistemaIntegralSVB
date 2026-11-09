"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/session";

export async function acknowledgeAlert(formData: FormData) {
  const ctx = await requirePerm("monitor.manage");
  if (ctx.demo) return;
  const db = await createSupabaseServer();
  const { error } = await db.rpc("acknowledge_alert", { p_alert: String(formData.get("alertId")) });
  if (error) throw new Error(error.message);
  revalidatePath("/monitor");
}

/** Devuelve el token en claro UNA vez para configurar el agente en el servidor del cliente. */
export async function rotateAgentToken(resourceId: string): Promise<{ token?: string; error?: string }> {
  const ctx = await requirePerm("monitor.manage");
  if (ctx.demo) return { token: "demo-" + crypto.randomUUID().replace(/-/g, "") };
  const db = await createSupabaseServer();
  const { data, error } = await db.rpc("rotate_agent_token", { p_resource: resourceId });
  return error ? { error: error.message } : { token: data as string };
}
