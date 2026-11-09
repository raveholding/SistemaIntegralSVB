"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requirePerm } from "@/lib/session";
import { monthRange } from "@/lib/data/hr";

export async function runCommissions() {
  const ctx = await requirePerm("hr.manage");
  if (ctx.demo) return;
  const { start, end } = monthRange();
  const db = await createSupabaseServer();
  const { error } = await db.rpc("calculate_commissions", { p_tenant: ctx.tenantId, p_start: start, p_end: end });
  if (error) throw new Error(error.message);
  revalidatePath("/rrhh");
}

export async function approveCommission(formData: FormData) {
  const ctx = await requirePerm("commissions.approve");
  if (ctx.demo) return;
  const db = await createSupabaseServer();
  const { start } = monthRange();
  const { error } = await db.from("commission_entries")
    .update({ status: "approved", approved_by: ctx.userId, approved_at: new Date().toISOString() })
    .eq("employee_id", String(formData.get("employeeId"))).eq("period_start", start).eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/rrhh");
}
