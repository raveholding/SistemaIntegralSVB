#!/usr/bin/env node
/**
 * SVB Monitor Agent — se instala en cada servidor del cliente.
 * Cada HEARTBEAT_INTERVAL segundos envía CPU, memoria, disco y latencia (sonda HTTP
 * opcional al servicio del cliente) al servicio de alertas. Sin dependencias.
 *
 *   SVB_ENDPOINT=https://alertas.vincular.business  SVB_RESOURCE_ID=uuid  SVB_TOKEN=...
 *   PROBE_URL=https://api.cliente.com/health  HEARTBEAT_INTERVAL=60  node agent.mjs
 */
import os from "node:os";
import { statfs } from "node:fs/promises";

const cfg = {
  endpoint: process.env.SVB_ENDPOINT ?? "http://localhost:8080",
  resourceId: process.env.SVB_RESOURCE_ID,
  token: process.env.SVB_TOKEN,
  probeUrl: process.env.PROBE_URL,
  interval: Number(process.env.HEARTBEAT_INTERVAL ?? 60) * 1000,
  diskPath: process.env.DISK_PATH ?? "/",
};
if (!cfg.resourceId || !cfg.token) {
  console.error("Faltan SVB_RESOURCE_ID y/o SVB_TOKEN");
  process.exit(1);
}

const snapshot = () => os.cpus().reduce((a, c) => {
  const t = Object.values(c.times).reduce((x, y) => x + y, 0);
  return { idle: a.idle + c.times.idle, total: a.total + t };
}, { idle: 0, total: 0 });

async function cpuPct(ms = 1000) {
  const a = snapshot();
  await new Promise((r) => setTimeout(r, ms));
  const b = snapshot();
  const total = b.total - a.total;
  return total ? round(100 * (1 - (b.idle - a.idle) / total)) : null;
}

async function diskPct() {
  try {
    const s = await statfs(cfg.diskPath);
    return round(100 * (1 - s.bavail / s.blocks));
  } catch { return null; }
}

async function probe() {
  if (!cfg.probeUrl) return { latency_ms: null, ok: null };
  const t0 = performance.now();
  try {
    const r = await fetch(cfg.probeUrl, { signal: AbortSignal.timeout(10_000) });
    return { latency_ms: round(performance.now() - t0), ok: r.ok, status: r.status };
  } catch (e) {
    return { latency_ms: 10_000, ok: false, error: String(e.message ?? e) };
  }
}

const round = (n) => Math.round(n * 10) / 10;

async function beat() {
  const [cpu, disk, p] = await Promise.all([cpuPct(), diskPct(), probe()]);
  const metrics = {
    ts: new Date().toISOString(),
    cpu_pct: cpu,
    mem_pct: round(100 * (1 - os.freemem() / os.totalmem())),
    disk_pct: disk,
    latency_ms: p.latency_ms,
    extra: { host: os.hostname(), load: os.loadavg().map(round), uptime_s: Math.round(os.uptime()), probe_ok: p.ok, probe_status: p.status ?? null },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(`${cfg.endpoint}/v1/heartbeat`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.token}` },
        body: JSON.stringify({ resource_id: cfg.resourceId, metrics }),
        signal: AbortSignal.timeout(10_000),
      });
      if (r.status === 401) { console.error("Token rechazado: rotarlo desde el panel"); return; }
      if (r.ok) { const j = await r.json(); console.log(`[${metrics.ts}] ${j.status} cpu=${cpu}% mem=${metrics.mem_pct}% lat=${p.latency_ms ?? "-"}ms`); return; }
    } catch (e) {
      console.warn(`intento ${attempt} falló: ${e.message ?? e}`);
    }
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));   // backoff (el ts mantiene idempotencia)
  }
}

await beat();
if (!process.argv.includes("--once")) setInterval(beat, cfg.interval);
