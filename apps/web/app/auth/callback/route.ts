import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Retorno de magic link / invitación de usuarios (staff y clientes). */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) await (await createSupabaseServer()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL("/", req.url));
}
