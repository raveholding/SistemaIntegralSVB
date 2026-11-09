import "server-only";
import { isDemo } from "@/lib/env";
import { demoEmployees } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Employee } from "@/lib/types";
import { unwrap } from "./_helpers";

export const monthRange = (d = new Date()) => {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
};

export async function getTeam(): Promise<Employee[]> {
  if (isDemo) return demoEmployees;
  const db = await createSupabaseServer();
  const { start, end } = monthRange();
  const rows = unwrap(await db.from("employees")
    .select("id, full_name, position, staff_type, is_active, user_id, sales_goals(target_amount, period_start), commission_entries(sales_amount, amount, status, period_start)")
    .eq("is_active", true).order("staff_type").order("full_name")
    .eq("sales_goals.period_start", start).eq("commission_entries.period_start", start));
  const { data: members } = await db.from("memberships").select("user_id, role");
  const roles = new Map((members ?? []).map((m) => [m.user_id, m.role]));
  void end;
  return rows.map((r) => {
    const c = (r.commission_entries as any[])?.[0];
    return {
      id: r.id, full_name: r.full_name, position: r.position, staff_type: r.staff_type, is_active: r.is_active,
      role: roles.get(r.user_id) ?? null, goal: (r.sales_goals as any[])?.[0]?.target_amount ?? null,
      sales: Number(c?.sales_amount ?? 0), commission: c ? Number(c.amount) : null, commission_status: c?.status ?? null,
    } as Employee;
  });
}
