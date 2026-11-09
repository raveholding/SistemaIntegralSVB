import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC = ["/login", "/auth", "/api/public"];

/**
 * 1) Refresca la sesión de Supabase en cada request.
 * 2) Enruta por audiencia usando los claims del JWT (custom access token hook):
 *    clientes corporativos -> /portal (nunca ven el backoffice); staff -> backoffice.
 * La autorización de datos la hace RLS; esto es aislamiento de UX y defensa en profundidad.
 */
export async function middleware(request: NextRequest) {
  if (isDemo) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const { response, user, claims } = await updateSession(request);

  if (PUBLIC.some((p) => pathname.startsWith(p))) return response;
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/");
  const isApi = pathname.startsWith("/api/");
  if (claims?.portal && !isPortalPath && !isApi) return NextResponse.redirect(new URL("/portal", request.url));
  if (claims && !claims.portal && isPortalPath) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
