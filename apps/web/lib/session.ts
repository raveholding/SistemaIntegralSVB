import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isDemo } from "./env";
import { decodeClaims, type AppRole } from "./claims";
import { ROLE_PERMISSIONS, type Permission } from "./rbac";
import { createSupabaseServer } from "./supabase/server";
import { demoUser } from "./demo";
import { DEMO_LICENSE, hasModule, permModule, type License } from "./license";

export interface AppContext {
  demo: boolean;
  userId: string;
  name: string;
  email: string;
  tenantId: string;
  role: AppRole;
  clientId: string | null;
  portal: boolean;
  perms: string[];
  license: License;
}

const DEMO_TENANT = "11111111-1111-1111-1111-111111111111";

/** Contexto del request (cacheado por render). Redirige a /login si no hay sesión. */
export const getContext = cache(async (): Promise<AppContext> => {
  if (isDemo) {
    return {
      demo: true, userId: demoUser.id, name: demoUser.name, email: demoUser.email, tenantId: DEMO_TENANT,
      role: "owner", clientId: "c1", portal: false, perms: ROLE_PERMISSIONS.owner, license: DEMO_LICENSE,
    };
  }
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: { session } } = await supabase.auth.getSession();
  const claims = session ? decodeClaims(session.access_token) : null;
  if (!claims) redirect("/login?error=sin-membresia");

  // Permisos efectivos desde la base (incluye overrides por miembro)
  const { data: perms } = await supabase.rpc("my_permissions", { p_tenant: claims.tenant_id });
  const { data: lic } = await supabase.rpc("my_license", { p_tenant: claims.tenant_id });
  const license: License = (lic as License | null) ?? { package: null, ai: false, status: "none", modules: [] };
  return {
    demo: false,
    userId: user.id,
    name: (user.user_metadata?.full_name as string) ?? user.email ?? "Usuario",
    email: user.email ?? "",
    tenantId: claims.tenant_id,
    role: claims.role,
    clientId: claims.client_id,
    portal: claims.portal,
    perms: (perms as string[] | null) ?? [],
    license,
  };
});

/** Guard de servidor para páginas y server actions. */
export async function requirePerm(p: Permission) {
  const ctx = await getContext();
  const mod = permModule(p);
  if (!hasModule(ctx.license, mod)) redirect("/plan?modulo=" + mod);   // candado de licencia → Mejorar plan
  if (!ctx.perms.includes(p)) redirect("/?denegado=" + encodeURIComponent(p));
  return ctx;
}
