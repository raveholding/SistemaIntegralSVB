import "server-only";
import { isDemo } from "@/lib/env";
import { demoKpis } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Kpis } from "@/lib/types";
import { unwrap } from "./_helpers";

export async function getKpis(tenantId: string): Promise<Kpis> {
  if (isDemo) return demoKpis;
  const db = await createSupabaseServer();
  return unwrap(await db.rpc("dashboard_kpis", { p_tenant: tenantId })) as Kpis;
}
