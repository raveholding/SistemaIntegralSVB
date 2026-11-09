import "server-only";
import { isDemo } from "@/lib/env";
import { demoDeployments, demoLeads, demoPages } from "@/lib/demo";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { CmsPage, Deployment, Lead } from "@/lib/types";
import { unwrap } from "./_helpers";

export async function getPages(): Promise<CmsPage[]> {
  if (isDemo) return demoPages;
  const db = await createSupabaseServer();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const rows = unwrap(await db.from("pages")
    .select("id, title, slug, kind, status, published_at, sites(domain, name), page_metrics_daily(views, leads, day)")
    .gte("page_metrics_daily.day", since).order("kind").order("title"));
  return rows.map((r) => {
    const m = (r.page_metrics_daily ?? []) as { views: number; leads: number }[];
    const s = r.sites as any;
    return {
      id: r.id, title: r.title, slug: r.slug, kind: r.kind, status: r.status, published_at: r.published_at,
      site: s?.domain ?? s?.name ?? "—",
      views_30d: m.reduce((a, x) => a + x.views, 0), leads_30d: m.reduce((a, x) => a + x.leads, 0),
    } as CmsPage;
  });
}

export async function getDeployments(): Promise<Deployment[]> {
  if (isDemo) return demoDeployments;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.from("deployments")
    .select("id, status, commit_ref, duration_ms, created_at, url, sites(domain, name)")
    .order("created_at", { ascending: false }).limit(10));
  return rows.map((r) => ({ ...r, site: (r.sites as any)?.domain ?? (r.sites as any)?.name ?? "—" })) as Deployment[];
}

export async function getLeads(): Promise<Lead[]> {
  if (isDemo) return demoLeads;
  const db = await createSupabaseServer();
  const rows = unwrap(await db.from("leads")
    .select("id, full_name, email, company, status, created_at, pages(title)")
    .order("created_at", { ascending: false }).limit(20));
  return rows.map((r) => ({ ...r, page: (r.pages as any)?.title ?? null })) as Lead[];
}
