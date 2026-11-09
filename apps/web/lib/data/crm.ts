import "server-only";
import { isDemo } from "@/lib/env";
import { demoClients, demoPlans } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { ClientRow, Plan } from "@/lib/types";
import { nameMap, unwrap } from "./_helpers";

export async function getPlans(): Promise<Plan[]> {
  if (isDemo) return demoPlans;
  const db = await createSupabaseServer();
  return unwrap(await db.from("plans").select("id, code, name, tier, price_monthly, includes_ai, features")
    .eq("is_active", true).order("tier")) as Plan[];
}

export async function getClients(): Promise<ClientRow[]> {
  if (isDemo) return demoClients;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.from("clients")
    .select("id, legal_name, trade_name, status, city, industry, owner_id, subscriptions(id, status, price_override, plans(id, name, price_monthly)), interactions(occurred_at)")
    .order("legal_name")
    .order("occurred_at", { referencedTable: "interactions", ascending: false })
    .limit(1, { referencedTable: "interactions" }));
  const names = await nameMap(db, rows.map((r) => r.owner_id));
  return rows.map((r) => {
    const sub = ((r.subscriptions ?? []) as any[]).find((s) => s.status !== "canceled");
    return {
      id: r.id, legal_name: r.legal_name, trade_name: r.trade_name, status: r.status, city: r.city, industry: r.industry,
      plan_name: sub?.plans?.name ?? null, plan_id: sub?.plans?.id ?? null, subscription_id: sub?.id ?? null,
      mrr: sub ? Number(sub.price_override ?? sub.plans?.price_monthly) : null,
      last_interaction: (r.interactions as any[])?.[0]?.occurred_at ?? null,
      owner_name: names.get(r.owner_id as string) ?? null,
    } satisfies ClientRow;
  });
}
