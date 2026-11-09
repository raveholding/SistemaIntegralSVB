const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const ars2 = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("es-AR");

export const money = (v: number | null | undefined, decimals = false) =>
  v == null ? "—" : (decimals ? ars2 : ars).format(v);
export const number = (v: number | null | undefined) => (v == null ? "—" : num.format(v));
export const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v.toFixed(d)} %`);

export const dateShort = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
export const dateTime = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export function relative(v: string | Date | null | undefined) {
  if (!v) return "nunca";
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return `hace ${s} s`;
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export const daysUntil = (d: string | null | undefined) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : null;
