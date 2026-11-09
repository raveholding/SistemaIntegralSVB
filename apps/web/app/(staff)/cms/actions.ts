"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/session";

export async function publishPage(formData: FormData) {
  const ctx = await requirePerm("cms.publish");
  if (ctx.demo) return;
  const db = await createSupabaseServer();
  const { error } = await db.rpc("publish_page", { p_page: String(formData.get("pageId")) });
  if (error) throw new Error(error.message);
  revalidatePath("/cms");
}

/** Registra el despliegue y dispara el deploy hook del proveedor (Vercel/Netlify). */
export async function triggerDeploy(formData: FormData) {
  const ctx = await requirePerm("cms.publish");
  if (ctx.demo) return;
  const db = await createSupabaseServer();
  const siteId = String(formData.get("siteId"));
  const { data: dep, error } = await db.from("deployments").insert({ site_id: siteId, tenant_id: ctx.tenantId, status: "queued" }).select("id").single();
  if (error) throw new Error(error.message);
  const hook = process.env.DEPLOY_HOOK_URL;
  if (hook) {
    // El proveedor notifica el resultado a /api/webhooks/deploy (actualiza status/duración)
    await fetch(hook, { method: "POST", headers: { "x-svb-deployment": dep.id } }).catch(() => null);
  }
  revalidatePath("/cms");
}
