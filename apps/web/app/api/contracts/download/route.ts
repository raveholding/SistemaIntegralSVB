import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Descarga segura: genera una URL firmada de 60 s con la sesión del usuario.
 * Las políticas de storage.objects deciden si puede verlo (staff con docs.read o
 * el cliente dueño del contrato firmado). Se registra el evento en auditoría.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path requerido" }, { status: 400 });
  if (isDemo) return NextResponse.json({ demo: true, path });

  const db = await createSupabaseServer();
  const { data, error } = await db.storage.from("contracts").createSignedUrl(path, 60, { download: true });
  if (error || !data) return NextResponse.json({ error: "No autorizado o inexistente" }, { status: 403 });

  const tenantId = path.split("/")[0];
  await db.rpc("audit_business_event", {
    p_tenant: tenantId, p_action: "DOWNLOAD", p_entity: "storage.contracts", p_record: path, p_payload: {},
  });
  return NextResponse.redirect(data.signedUrl);
}
