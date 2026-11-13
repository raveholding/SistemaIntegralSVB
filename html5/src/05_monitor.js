<script>
/* ════════════════════ MOTOR DE MONITOREO (heartbeat + reglas + watchdog) ════════════════════
   En producción los latidos llegan del agente instalado en cada servidor (services/monitor-agent);
   acá se simulan con una caminata aleatoria para que el sistema funcione sin backend.
   Botones por recurso: "Simular caída" (deja de latir) y "Estrés" (dispara CPU/memoria/latencia). */
const MAX_SAMPLES = 120;
const METRIC_LABEL = { cpu: "CPU", mem: "Memoria", lat: "Latencia" };
const HEALTH = { operational: ["ok", "Operativo"], degraded: ["warn", "Degradado"], down: ["crit", "Caído"], maintenance: ["info", "Mantenimiento"], unknown: ["", "Sin datos"] };
const SEV = { critical: ["crit", "Crítica"], warning: ["warn", "Advertencia"], info: ["info", "Info"] };

function nextSample(r) {
  const arr = S.samples[r.id] ?? [];
  const last = arr[arr.length - 1] ?? { cpu: r.base.cpu, mem: r.base.mem, lat: r.base.lat };
  const walk = (v, base, span, min, max) => clamp(v + (Math.random() - 0.5) * span + (base - v) * 0.15, min, max);
  let cpu = walk(last.cpu, r.base.cpu, 10, 1, 100), mem = walk(last.mem, r.base.mem, 4, 3, 100), lat = walk(last.lat, r.base.lat, r.base.lat * 0.25, 5, 10000);
  if (r.stress) { cpu = clamp(cpu + 6 + Math.random() * 6, 0, 99.5); mem = clamp(mem + 3, 0, 97); lat = Math.min(lat * 1.35 + 120, 4000); }
  return { ts: nowISO(), cpu: r2(cpu), mem: r2(mem), lat: Math.round(lat) };
}

function breaches(rule, samples) {
  const last = samples.slice(-rule.samples);
  if (last.length < rule.samples) return false;
  const cmp = { ">": (a, b) => a > b, ">=": (a, b) => a >= b, "<": (a, b) => a < b, "<=": (a, b) => a <= b }[rule.op];
  return last.every((s) => cmp(s[rule.metric], rule.threshold));
}

function openAlert(r, fingerprint, severity, title, message, value = null, ruleId = null) {
  if (S.alerts.some((a) => a.fingerprint === fingerprint && a.status !== "resolved")) return null;
  const a = db.insert("alerts", { resourceId: r.id, ruleId, fingerprint, severity, status: "open", title, message, value, openedAt: nowISO(), resolvedAt: null, ackBy: null, notified: false });
  notify({ kind: "alert", title, body: `${message}${r.clientId ? " · " + clientName(r.clientId) : ""}`, severity, link: "#/monitor" });
  sendTelegram(severity, `${severity === "critical" ? "CRÍTICA" : "ADVERTENCIA"} · ${title}\n${message}${r.clientId ? "\nCliente: " + clientName(r.clientId) : ""}`)
    .then((res) => { if (res?.ok) { db.update("alerts", a.id, { notified: true }, { silent: true }); rerenderIf(["monitor"]); } });
  return a;
}
function resolveAlerts(fingerprint) {
  for (const a of S.alerts.filter((a) => a.fingerprint === fingerprint && a.status !== "resolved")) {
    db.update("alerts", a.id, { status: "resolved", resolvedAt: nowISO() });
    sendTelegram("ok", `RESUELTA · ${a.title}`);
  }
}

function setStatus(r, status) {
  if (r.status === status) return;
  if (r.status === "down") r.uptimeDownMs = (r.uptimeDownMs ?? 0) + (Date.now() - new Date(r.statusSince).getTime());
  r.status = status; r.statusSince = nowISO();
}

function heartbeat(r) {
  const s = nextSample(r);
  S.samples[r.id] = [...(S.samples[r.id] ?? []), s].slice(-MAX_SAMPLES);
  r.lastBeat = s.ts;
  resolveAlerts("hb:" + r.id);
  let status = "operational";
  for (const rule of S.alertRules.filter((x) => x.active)) {
    const fp = `rule:${rule.id}:${r.id}`;
    if (breaches(rule, S.samples[r.id])) {
      status = rule.severity === "critical" ? "down" : status === "operational" ? "degraded" : status;
      const unit = rule.metric === "lat" ? " ms" : " %";
      openAlert(r, fp, rule.severity, `${r.name}: ${METRIC_LABEL[rule.metric]} ${rule.op} ${rule.threshold}${unit}`, `Valor actual ${s[rule.metric]}${unit} durante ${rule.samples} muestras`, s[rule.metric], rule.id);
    } else resolveAlerts(fp);
  }
  if (r.status !== "maintenance") setStatus(r, status);
}

function watchdog() {
  const interval = S.settings.heartbeatSec * 1000;
  for (const r of S.resources.filter((r) => r.active && r.status !== "maintenance")) {
    const last = r.lastBeat ? new Date(r.lastBeat).getTime() : 0;
    if (r.paused && Date.now() - last > interval * r.missedBeats && r.status !== "down") {
      setStatus(r, "down");
      openAlert(r, "hb:" + r.id, "critical", `${r.name}: sin heartbeat`, `Último latido ${r.lastBeat ? fmt.dt(r.lastBeat) : "nunca"}`);
    }
  }
}

function uptime30(r) {
  let down = r.uptimeDownMs ?? 0;
  if (r.status === "down") down += Date.now() - new Date(r.statusSince).getTime();
  const span = Math.min(30 * 864e5, Date.now() - new Date(S.createdAt).getTime() + 30 * 864e5);
  return clamp(r2(100 - down / span * 100), 0, 100);
}

let monitorTimer = null;
/* Chequeo REAL de disponibilidad: pide la página (sin leer su contenido) y mide la latencia.
   Sirve para sitios en GitHub Pages, APIs y proyectos Supabase. 2 fallas seguidas ⇒ Caído. */
const isHttpRes = (r) => /^https?:\/\//i.test(r.endpoint || "");
async function checkHttp(url) {
  const ctl = window.AbortController ? new AbortController() : null; const t0 = performance.now();
  const to = setTimeout(() => ctl && ctl.abort(), 12000);
  try { await fetch(url + (url.includes("?") ? "&" : "?") + "svbcheck=" + Date.now(), { mode: "no-cors", cache: "no-store", signal: ctl?.signal, redirect: "follow" }); return { ok: true, lat: Math.round(performance.now() - t0) }; }
  catch (e) { return { ok: false, error: e.name === "AbortError" ? "Sin respuesta en 12 s" : "No responde" }; }
  finally { clearTimeout(to); }
}
async function realCheck(r) {
  const res = await checkHttp(r.endpoint);
  if (!db.get("resources", r.id)) return;
  const ts = nowISO();
  if (res.ok) {
    r.fails = 0; r.lastBeat = ts;
    S.samples[r.id] = [...(S.samples[r.id] ?? []), { ts, cpu: null, mem: null, lat: res.lat }].slice(-MAX_SAMPLES);
    resolveAlerts("hb:" + r.id);
    let status = "operational";
    for (const rule of S.alertRules.filter((x) => x.active && x.metric === "lat")) {
      const fp = `rule:${rule.id}:${r.id}`;
      if (breaches(rule, S.samples[r.id])) { status = rule.severity === "critical" ? "down" : "degraded"; openAlert(r, fp, rule.severity, `${r.name}: latencia ${rule.op} ${rule.threshold} ms`, `Respuesta en ${res.lat} ms durante ${rule.samples} chequeos`, res.lat, rule.id); }
      else resolveAlerts(fp);
    }
    if (r.status !== "maintenance" && r.status !== status) db.update("resources", r.id, (() => { const o = { status, statusSince: ts }; if (r.status === "down") o.uptimeDownMs = (r.uptimeDownMs ?? 0) + (Date.now() - new Date(r.statusSince).getTime()); return o; })(), { silent: true });
  } else {
    r.fails = (r.fails ?? 0) + 1;
    if (r.fails >= 2 && r.status !== "down" && r.status !== "maintenance") {
      db.update("resources", r.id, { status: "down", statusSince: ts }, { silent: true });
      openAlert(r, "hb:" + r.id, "critical", `${r.name}: no responde`, `${res.error} · ${r.endpoint}`);
    }
  }
}
function startMonitor() {
  clearInterval(monitorTimer);
  const cloud = typeof Cloud !== "undefined" && Cloud.on;
  const tick = () => {
    if (cloud && (!Cloud.ready || !Cloud.leader)) { rerenderIf(["dashboard", "monitor", "portal"], true); return; }
    const act = S.resources.filter((r) => r.active && r.status !== "maintenance");
    if (S.settings.simulate) { for (const r of act.filter((r) => !r.paused && !isHttpRes(r))) heartbeat(r); watchdog(); save(); }
    Promise.all(act.filter(isHttpRes).map((r) => realCheck(r).catch(() => { }))).then(() => {
      save(); if (cloud) pushSamples();
      rerenderIf(["dashboard", "monitor", "portal"], true);
    });
  };
  tick();
  monitorTimer = setInterval(tick, Math.max(S.settings.simulate ? 2 : 30, S.settings.heartbeatSec || 60) * 1000);
}
</script>
