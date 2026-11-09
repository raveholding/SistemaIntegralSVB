import { ExternalLink, Globe, Inbox, Rocket } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Kpi } from "@/components/ui/kpi";
import { PageHeader } from "@/components/ui/misc";
import { Pill } from "@/components/ui/status";
import { Table, THead, Th, Tr, Td } from "@/components/ui/table";
import { getDeployments, getLeads, getPages } from "@/lib/data/cms";
import { number, relative } from "@/lib/format";
import { requirePerm } from "@/lib/session";
import { publishPage, triggerDeploy } from "./actions";

export const metadata = { title: "Web y CMS" };

const DEPLOY: Record<string, ["ok" | "crit" | "warn" | "info" | "neutral", string]> = {
  ready: ["ok", "Publicado"], error: ["crit", "Error"], building: ["warn", "Compilando"], queued: ["info", "En cola"], canceled: ["neutral", "Cancelado"],
};
const LEAD: Record<string, ["ok" | "info" | "warn" | "brand" | "neutral", string]> = {
  new: ["info", "Nuevo"], contacted: ["warn", "Contactado"], qualified: ["brand", "Calificado"], converted: ["ok", "Convertido"], discarded: ["neutral", "Descartado"],
};

export default async function CmsPage() {
  const ctx = await requirePerm("cms.read");
  const [pages, deployments, leads] = await Promise.all([getPages(), getDeployments(), getLeads()]);
  const views = pages.reduce((a, p) => a + p.views_30d, 0);
  const totalLeads = pages.reduce((a, p) => a + p.leads_30d, 0);
  const ok = deployments.filter((d) => d.status === "ready");
  const avgBuild = ok.length ? Math.round(ok.reduce((a, d) => a + (d.duration_ms ?? 0), 0) / ok.length / 1000) : null;
  const canPublish = ctx.perms.includes("cms.publish");

  return (
    <>
      <PageHeader eyebrow="Módulo 6" title="Gestor web y CMS"
        subtitle="Sitio corporativo, landing pages de captación y métricas de despliegue."
        actions={canPublish && (
          <form action={triggerDeploy}>
            <input type="hidden" name="siteId" value="5e000000-0000-0000-0000-000000000001" />
            <Button><Rocket className="h-4 w-4" /> Desplegar sitio</Button>
          </form>
        )} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Kpi label="Visitas 30 días" value={number(views)} tone="brand" icon={<Globe className="h-4 w-4" />} />
        <Kpi label="Leads 30 días" value={totalLeads} tone="ok" icon={<Inbox className="h-4 w-4" />} />
        <Kpi label="Conversión" value={views ? `${((totalLeads / views) * 100).toFixed(2)} %` : "—"} tone="info" />
        <Kpi label="Build promedio" value={avgBuild ? `${avgBuild} s` : "—"} hint={`${deployments.filter((d) => d.status === "error").length} despliegues fallidos`} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Páginas y landings" />
        <Table>
          <THead><tr><Th>Página</Th><Th>Tipo</Th><Th>Estado</Th><Th className="text-right">Visitas</Th><Th className="text-right">Leads</Th><Th className="text-right">Conv.</Th><Th>Publicada</Th><Th /></tr></THead>
          <tbody>
            {pages.map((p) => (
              <Tr key={p.id}>
                <Td><p className="font-medium text-fg">{p.title}</p><p className="font-mono text-[11px]">{p.site}/{p.slug}</p></Td>
                <Td><Pill tone={p.kind === "landing" ? "brand" : "neutral"}>{p.kind === "landing" ? "Landing" : "Página"}</Pill></Td>
                <Td><Pill tone={p.status === "published" ? "ok" : "neutral"} dot>{p.status === "published" ? "Publicada" : "Borrador"}</Pill></Td>
                <Td className="text-right tabular-nums">{number(p.views_30d)}</Td>
                <Td className="text-right tabular-nums text-fg">{p.leads_30d}</Td>
                <Td className="text-right tabular-nums">{p.views_30d ? `${((p.leads_30d / p.views_30d) * 100).toFixed(1)} %` : "—"}</Td>
                <Td className="text-xs">{relative(p.published_at)}</Td>
                <Td className="text-right">
                  {canPublish && p.status !== "published" && (
                    <form action={publishPage}><input type="hidden" name="pageId" value={p.id} /><Button size="sm" variant="success">Publicar</Button></form>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Despliegues" icon={<Rocket className="h-4 w-4" />} />
          <Table>
            <THead><tr><Th>Commit</Th><Th>Estado</Th><Th>Duración</Th><Th>Cuándo</Th><Th /></tr></THead>
            <tbody>
              {deployments.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-mono text-xs text-fg">{d.commit_ref ?? "—"}</Td>
                  <Td><Pill tone={DEPLOY[d.status]?.[0] ?? "neutral"} dot>{DEPLOY[d.status]?.[1] ?? d.status}</Pill></Td>
                  <Td className="tabular-nums">{d.duration_ms ? `${(d.duration_ms / 1000).toFixed(1)} s` : "—"}</Td>
                  <Td className="text-xs">{relative(d.created_at)}</Td>
                  <Td>{d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-fg-subtle hover:text-fg"><ExternalLink className="h-4 w-4" /></a>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Leads captados" subtitle="Formularios de landing → CRM" icon={<Inbox className="h-4 w-4" />} />
          <Table>
            <THead><tr><Th>Contacto</Th><Th>Origen</Th><Th>Estado</Th><Th>Cuándo</Th></tr></THead>
            <tbody>
              {leads.map((l) => (
                <Tr key={l.id}>
                  <Td><p className="text-fg">{l.full_name}</p><p className="text-[11px]">{l.company ?? l.email}</p></Td>
                  <Td className="text-xs">{l.page ?? "—"}</Td>
                  <Td><Pill tone={LEAD[l.status]?.[0] ?? "neutral"}>{LEAD[l.status]?.[1] ?? l.status}</Pill></Td>
                  <Td className="text-xs">{relative(l.created_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
