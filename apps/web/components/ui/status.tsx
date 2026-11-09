import { cn } from "./cn";

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral" | "brand";

const TONE: Record<Tone, { dot: string; pill: string }> = {
  ok:      { dot: "bg-ok text-ok",     pill: "bg-ok/10 text-ok ring-ok/25" },
  warn:    { dot: "bg-warn text-warn", pill: "bg-warn/10 text-warn ring-warn/25" },
  crit:    { dot: "bg-crit text-crit", pill: "bg-crit/10 text-crit ring-crit/25" },
  info:    { dot: "bg-info text-info", pill: "bg-info/10 text-info ring-info/25" },
  brand:   { dot: "bg-brand text-brand", pill: "bg-brand/10 text-brand ring-brand/25" },
  neutral: { dot: "bg-fg-subtle text-fg-subtle", pill: "bg-white/[0.04] text-fg-muted ring-white/10" },
};

/** Punto luminoso de estado (con pulso para estados que requieren atención). */
export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", TONE[tone].dot)} />}
      <span className={cn("relative h-2.5 w-2.5 rounded-full shadow-glow", TONE[tone].dot)} />
    </span>
  );
}

export function Pill({ tone = "neutral", children, dot, className }: {
  tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", TONE[tone].pill, className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />}
      {children}
    </span>
  );
}

// Mapas de estado de dominio -> tono + etiqueta en español
export const HEALTH: Record<string, [Tone, string]> = {
  operational: ["ok", "Operativo"], degraded: ["warn", "Degradado"], down: ["crit", "Caído"],
  maintenance: ["info", "Mantenimiento"], unknown: ["neutral", "Sin datos"],
};
export const SEVERITY: Record<string, [Tone, string]> = {
  critical: ["crit", "Crítica"], warning: ["warn", "Advertencia"], info: ["info", "Info"],
};
export const CONTRACT: Record<string, [Tone, string]> = {
  signed: ["ok", "Firmado"], pending_signature: ["warn", "Pendiente de firma"], draft: ["neutral", "Borrador"],
  expired: ["crit", "Vencido"], terminated: ["crit", "Rescindido"],
};
export const CLIENT: Record<string, [Tone, string]> = {
  active: ["ok", "Activo"], lead: ["info", "Prospecto"], paused: ["warn", "Pausado"], churned: ["crit", "Baja"],
};
export const TICKET: Record<string, [Tone, string]> = {
  open: ["info", "Abierto"], in_progress: ["brand", "En curso"], waiting_client: ["warn", "Esperando respuesta"],
  resolved: ["ok", "Resuelto"], closed: ["neutral", "Cerrado"],
};
export const PRIORITY: Record<string, [Tone, string]> = {
  urgent: ["crit", "Urgente"], high: ["warn", "Alta"], normal: ["info", "Normal"], low: ["neutral", "Baja"],
};

export function StatusPill({ map, value, dot = true }: { map: Record<string, [Tone, string]>; value: string; dot?: boolean }) {
  const [tone, label] = map[value] ?? ["neutral", value];
  return <Pill tone={tone} dot={dot}>{label}</Pill>;
}
