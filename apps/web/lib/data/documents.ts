import "server-only";
import { isDemo } from "@/lib/env";
import { demoContracts } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Contract } from "@/lib/types";
import { unwrap } from "./_helpers";

export async function getContracts(): Promise<Contract[]> {
  if (isDemo) return demoContracts;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.from("contracts")
    .select("id, code, title, status, start_date, end_date, value_amount, clients(trade_name, legal_name), contract_versions!contract_versions_contract_id_fkey(id, storage_path, version_no), current_version_id")
    .order("end_date", { ascending: true, nullsFirst: false }));
  return rows.map((r) => {
    const c = r.clients as unknown as { trade_name: string | null; legal_name: string };
    const versions = (r.contract_versions ?? []) as { id: string; storage_path: string }[];
    return {
      id: r.id, code: r.code, title: r.title, status: r.status, start_date: r.start_date, end_date: r.end_date,
      value_amount: r.value_amount, client_name: c?.trade_name ?? c?.legal_name ?? "—", versions: versions.length,
      current_version_path: versions.find((v) => v.id === r.current_version_id)?.storage_path ?? null,
    } as Contract;
  });
}
