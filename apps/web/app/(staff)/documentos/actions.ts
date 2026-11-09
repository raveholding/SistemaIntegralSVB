"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/session";

const NewContract = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  value_amount: z.coerce.number().nonnegative().optional(),
  auto_renew: z.coerce.boolean().default(false),
});

export async function createContract(formData: FormData) {
  const ctx = await requirePerm("docs.write");
  if (ctx.demo) return;
  const input = NewContract.parse(Object.fromEntries(formData));
  const db = await createSupabaseServer();
  const { count } = await db.from("contracts").select("id", { count: "exact", head: true });
  const code = `CTR-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;
  const { error } = await db.from("contracts").insert({
    ...input, tenant_id: ctx.tenantId, code, status: "draft",
    start_date: input.start_date || null, end_date: input.end_date || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

export async function signContract(formData: FormData) {
  const ctx = await requirePerm("docs.sign");
  if (ctx.demo) return;
  const db = await createSupabaseServer();
  const { error } = await db.rpc("sign_contract", {
    p_contract: String(formData.get("id")), p_signed_by: String(formData.get("signed_by") ?? ctx.name),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}
