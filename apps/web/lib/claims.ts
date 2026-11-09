export type AppRole =
  | "owner" | "partner" | "admin" | "employee" | "seller" | "technician"
  | "client_admin" | "client_user";

export interface SvbClaims {
  tenant_id: string;
  role: AppRole;
  client_id: string | null;
  portal: boolean;
}

/** Decodifica (sin verificar: ya lo hizo auth.getUser) el bloque `svb` del JWT. */
export function decodeClaims(jwt: string): SvbClaims | null {
  try {
    const payload = jwt.split(".")[1];
    const json = JSON.parse(
      typeof atob === "function"
        ? atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(payload, "base64url").toString("utf8"),
    );
    return (json.svb as SvbClaims) ?? null;
  } catch {
    return null;
  }
}
