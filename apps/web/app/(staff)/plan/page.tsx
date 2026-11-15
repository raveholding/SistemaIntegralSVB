import { Check, Lock, MessageCircle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Pill } from "@/components/ui/status";
import { getContext } from "@/lib/session";
import { MODULE_LABEL, PACKAGES, hasModule, type ModuleKey } from "@/lib/license";
import { money } from "@/lib/format";

export const metadata = { title: "Mi plan" };

const WHATSAPP = "5493874484132"; // Vincular Business · (387) 448-4132
const ALL: ModuleKey[] = ["cms", "crm", "pos", "docs", "hr", "monitor", "portal"];

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  const ctx = await getContext();
  const { modulo } = await searchParams;
  const lic = ctx.license;
  const wanted = ALL.includes(modulo as ModuleKey) ? (modulo as ModuleKey) : null;
  const msg = encodeURIComponent(
    `Hola Vincular Business, quiero mejorar mi plan${wanted ? ` para habilitar "${MODULE_LABEL[wanted]}"` : ""}. Plan actual: ${lic.package_name ?? "sin licencia"}.`);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Licencia" title="Mi plan"
        subtitle={`Paquete actual: ${lic.package_name ?? "sin licencia"}${lic.ai ? " · Pro + IA" : ""}`} />

      {lic.status === "follow_up" && (
        <Card><CardBody>
          <p className="text-sm text-fg">Tu mantenimiento mensual está en seguimiento. Tu sistema sigue activo: el equipo de
            Vincular Business se va a comunicar para ayudarte a regularizarlo.</p>
        </CardBody></Card>
      )}
      {wanted && !hasModule(lic, wanted) && (
        <Card><CardBody>
          <p className="flex items-center gap-2 text-sm text-fg"><Lock className="h-4 w-4 text-brand" />
            «{MODULE_LABEL[wanted]}» no está incluido en tu paquete.</p>
        </CardBody></Card>
      )}

      <Card>
        <CardHeader title="Módulos de tu licencia" subtitle="Los bloqueados se habilitan mejorando el plan" />
        <CardBody>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...ALL, "ai" as ModuleKey].map((m) => {
              const on = hasModule(lic, m);
              return (
                <li key={m} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                  {on ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Lock className="h-4 w-4 text-brand" aria-hidden />}
                  <span className={on ? "text-fg" : "text-fg-subtle"}>{MODULE_LABEL[m]}</span>
                  <span className="sr-only">{on ? "incluido" : "bloqueado"}</span>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Paquetes" subtitle="Pago único + mantenimiento mensual de $ 50.000 (ARS)" />
        <CardBody>
          <div className="grid gap-3 md:grid-cols-4">
            {PACKAGES.map((p) => (
              <div key={p.code} className="rounded-xl border border-white/[0.06] p-4">
                <p className="text-sm font-semibold text-fg">{p.name} {p.code === lic.package && <Pill tone="brand">Actual</Pill>}</p>
                <p className="mt-1 text-lg text-fg">{money(p.price)}</p>
                <p className="mt-2 text-xs text-fg-subtle">{p.modules.map((m) => MODULE_LABEL[m]).join(" · ")}</p>
              </div>
            ))}
          </div>
          <a href={`https://wa.me/${WHATSAPP}?text=${msg}`} target="_blank" rel="noopener noreferrer"
             className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-ink-950">
            <MessageCircle className="h-4 w-4" aria-hidden /> Mejorar plan por WhatsApp
          </a>
        </CardBody>
      </Card>
    </div>
  );
}
