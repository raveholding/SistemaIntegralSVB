import "server-only";
import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Cliente con la sesión del usuario: TODA consulta pasa por RLS. */
export async function createSupabaseServer() {
  const [cookieStore, h] = await Promise.all([cookies(), headers()]);
  // Contexto para la pista de auditoría (lo lee audit.request_header vía PostgREST)
  const auditHeaders: Record<string, string> = {
    "x-request-id": h.get("x-request-id") ?? crypto.randomUUID(),
  };
  const ip = h.get("x-forwarded-for") ?? h.get("x-real-ip");
  if (ip) auditHeaders["x-forwarded-for"] = ip.split(",")[0].trim();
  const ua = h.get("user-agent");
  if (ua) auditHeaders["user-agent"] = ua.slice(0, 300);

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: auditHeaders },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* llamado desde un Server Component: el middleware refresca la sesión */
        }
      },
    },
  });
}

/**
 * Cliente service_role: SOLO para jobs/webhooks del servidor (nunca en respuesta a input
 * del usuario sin validar permisos). Bypassa RLS.
 */
export function createSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
