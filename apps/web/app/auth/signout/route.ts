import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  if (!isDemo) await (await createSupabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
