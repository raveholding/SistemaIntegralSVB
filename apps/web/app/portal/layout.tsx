import { redirect } from "next/navigation";
import { DemoBanner } from "@/components/ui/misc";
import { getContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  if (!ctx.portal && !ctx.demo) redirect("/");      // el staff usa el backoffice
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/[0.05] bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-info text-xs font-bold text-ink-950">VB</div>
            <span className="text-sm font-semibold text-fg">Portal de clientes</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-fg-muted">
            <span>{ctx.name}</span>
            <form action="/auth/signout" method="post"><button className="text-xs text-fg-subtle hover:text-fg">Salir</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {ctx.demo && <DemoBanner />}
        {children}
      </main>
      <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-fg-subtle">
        ¿Necesitás ayuda urgente? WhatsApp (387) 4484132 · vincularbusiness@gmail.com
      </footer>
    </div>
  );
}
