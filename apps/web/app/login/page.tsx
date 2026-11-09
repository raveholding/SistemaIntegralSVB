import { redirect } from "next/navigation";
import { Button, Field, inputCls } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isDemo } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Ingresar" };

async function signIn(formData: FormData) {
  "use server";
  if (isDemo) redirect("/");
  const db = await createSupabaseServer();
  const { error } = await db.auth.signInWithPassword({
    email: String(formData.get("email")), password: String(formData.get("password")),
  });
  if (error) redirect("/login?error=credenciales");
  redirect("/");      // el middleware deriva a /portal si el usuario es cliente
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-info font-bold text-ink-950">VB</div>
          <div>
            <p className="font-semibold text-fg">Sistema Integral SVB</p>
            <p className="text-xs text-fg-subtle">Equipo y clientes de Vincular Business</p>
          </div>
        </div>
        <form action={signIn} className="space-y-4">
          <Field label="Email"><input name="email" type="email" required autoComplete="email" className={inputCls} /></Field>
          <Field label="Contraseña"><input name="password" type="password" required autoComplete="current-password" className={inputCls} /></Field>
          {error && <p className="text-xs text-crit">{error === "sin-membresia" ? "Tu usuario no tiene acceso asignado." : "Email o contraseña incorrectos."}</p>}
          <Button className="w-full">Ingresar</Button>
        </form>
        {isDemo && <p className="mt-4 text-center text-xs text-warn">Modo demo: cualquier dato ingresa.</p>}
      </Card>
    </div>
  );
}
