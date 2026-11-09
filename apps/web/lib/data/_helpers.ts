import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";

export type Db = Awaited<ReturnType<typeof createSupabaseServer>>;

/** Los FKs a usuarios apuntan a auth.users: resolvemos nombres vía profiles en un solo query. */
export async function nameMap(db: Db, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Map<string, string>();
  const { data } = await db.from("profiles").select("id, full_name, email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name ?? p.email ?? "—") as string]));
}

export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
