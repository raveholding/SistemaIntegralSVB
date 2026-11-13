<script>
"use strict";
/* ════════════════════════════════════════════════════════════════════════════
   SISTEMA INTEGRAL SVB · Vincular Business
   Versión HTML5 autónoma (un solo archivo, sin servidor ni dependencias).
   Persistencia: localStorage (datos) + IndexedDB (PDF de contratos).
   Desarrollador: Vincular Business · WhatsApp (387) 4484132 · vincularbusiness@gmail.com
   ════════════════════════════════════════════════════════════════════════════ */

const APP_KEY = "svb_integral_v1";
const DEV = { name: "Vincular Business", wa: "(387) 4484132", email: "vincularbusiness@gmail.com" };

/* ───────────── Utilidades ───────────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nowISO = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const fmt = {
  money: (v, dec = false) => v == null || isNaN(v) ? "—" : new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: dec ? 2 : 0 }).format(v),
  num: (v) => v == null ? "—" : new Intl.NumberFormat("es-AR").format(v),
  date: (v) => v ? new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—",
  dt: (v) => v ? new Date(v).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—",
  rel(v) {
    if (!v) return "nunca";
    const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
    if (s < 0) { const f = -s; return f < 3600 ? `en ${Math.round(f / 60)} min` : f < 86400 ? `en ${Math.round(f / 3600)} h` : `en ${Math.round(f / 86400)} d`; }
    if (s < 60) return `hace ${s} s`; if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`; return `hace ${Math.round(s / 86400)} d`;
  },
  daysUntil: (d) => d ? Math.ceil((new Date(d + "T23:59:59").getTime() - Date.now()) / 86400000) : null,
  docNo: (pos, n) => `${String(pos).padStart(4, "0")}-${String(n).padStart(8, "0")}`,
};

/* ───────────── SHA-256 síncrono (auditoría encadenada, funciona también en file://) ───────────── */
const SHA = (() => {
  const K = [], H0 = [];
  let n = 2, c = 0;
  const isPrime = (x) => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; };
  while (c < 64) { if (isPrime(n)) { if (c < 8) H0[c] = (Math.pow(n, 0.5) % 1) * 4294967296 | 0; K[c] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0; c++; } n++; }
  const rotr = (x, k) => (x >>> k) | (x << (32 - k));
  function bytes(data) {
    const len = data.length, bitLen = len * 8;
    const total = ((len + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(total); m.set(data); m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 4, bitLen >>> 0); dv.setUint32(total - 8, Math.floor(bitLen / 4294967296));
    const H = H0.slice(), W = new Int32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getInt32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, b, cc, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & cc) ^ (b & cc);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  return { hex: (str) => bytes(new TextEncoder().encode(str)), bytes };
})();
async function sha256File(buf) {
  if (crypto.subtle) { const d = await crypto.subtle.digest("SHA-256", buf); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  return SHA.bytes(new Uint8Array(buf));
}

/* ───────────── RBAC ───────────── */
const PERMS = [
  ["monitor.read", "Ver telemetría y alertas"], ["monitor.manage", "Recursos, reglas, canales y ACK"],
  ["docs.read", "Ver contratos"], ["docs.write", "Crear contratos y subir versiones"], ["docs.sign", "Firmar contratos"],
  ["crm.read", "Ver clientes y suscripciones"], ["crm.write", "Editar clientes e interacciones"], ["billing.manage", "Planes y cambios de suscripción"],
  ["pos.operate", "Operar caja y emitir comprobantes"], ["pos.supervise", "Egresos, retiros y todas las cajas"], ["pos.void", "Anular comprobantes"],
  ["hr.read", "Ver equipo y metas"], ["hr.manage", "Editar equipo, metas y calcular comisiones"], ["commissions.approve", "Aprobar y pagar comisiones"],
  ["cms.read", "Ver sitio y métricas"], ["cms.write", "Editar páginas"], ["cms.publish", "Publicar y desplegar"],
  ["tickets.read", "Ver tickets"], ["tickets.manage", "Responder y cerrar tickets"], ["inbox.manage", "Atención al público (bandeja y canales)"],
  ["audit.read", "Consultar auditoría"], ["settings.manage", "Usuarios, roles y configuración"],
];
const ALL_PERMS = PERMS.map((p) => p[0]);
const ROLES = {
  owner: "Dueño", partner: "Socio", admin: "Administración", employee: "Empleado", seller: "Vendedor", technician: "Técnico",
  client_admin: "Cliente (admin)", client_user: "Cliente",
};
const STAFF_ROLES = ["owner", "partner", "admin", "employee", "seller", "technician"];
const DEFAULT_ROLE_PERMS = {
  owner: ALL_PERMS, partner: ALL_PERMS,
  admin: ALL_PERMS.filter((p) => !["monitor.manage", "commissions.approve", "settings.manage", "cms.publish"].includes(p)),
  employee: ["crm.read", "pos.operate", "tickets.read", "cms.read", "docs.read", "inbox.manage"],
  seller: ["crm.read", "crm.write", "docs.read", "pos.operate", "cms.read", "tickets.read", "inbox.manage"],
  technician: ["monitor.read", "monitor.manage", "tickets.read", "tickets.manage", "cms.read", "cms.write", "crm.read", "inbox.manage"],
  client_admin: [], client_user: [],
};

/* ───────────── Estado + persistencia ───────────── */
let S = null;
let saveTimer = null;
/* Con la nube activa los datos NO se guardan en localStorage: viven en Firestore (con la caché local de Firestore para trabajar sin señal). */
function save() { if (typeof Cloud !== "undefined" && Cloud.on) return cloudSchedule(); clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(APP_KEY, JSON.stringify(S)); } catch (e) { toast("No se pudo guardar localmente: " + e.message, "err"); } }, 150); }
function saveNow() { if (typeof Cloud !== "undefined" && Cloud.on) return cloudPush(); clearTimeout(saveTimer); localStorage.setItem(APP_KEY, JSON.stringify(S)); }

const AUDITED = new Set(["clients", "users", "contracts", "contractVersions", "plans", "subscriptions", "subChanges", "sessions", "documents", "movements", "employees", "goals", "commissions", "pages", "sites", "resources", "alertRules", "alerts", "tickets", "leads", "interactions", "rolePerms", "deployments"]);
const IMMUTABLE = new Set(["movements", "contractVersions", "pageVersions", "audit"]);

/* Pista de auditoría: append-only, encadenada con SHA-256 */
function audit(action, table, recordId, oldData, newData, amount = null, method = null) {
  const prev = S.audit.length ? S.audit[S.audit.length - 1].hash : "";
  const u = currentUser();
  const ev = {
    id: S.audit.length ? S.audit[S.audit.length - 1].id + 1 : 1,
    ts: nowISO(), actorId: u?.id ?? null, actorName: u?.name ?? "sistema", actorRole: u?.role ?? "system",
    action, table, recordId: recordId ?? null,
    changed: oldData && newData ? Object.keys(newData).filter((k) => JSON.stringify(newData[k]) !== JSON.stringify(oldData[k])) : null,
    oldData: oldData ?? null, newData: newData ?? null, amount, method,
    ua: navigator.userAgent.slice(0, 120), prev,
  };
  ev.hash = SHA.hex(prev + "|" + auditPayload(ev));
  S.audit.push(ev);
}
function auditPayload(e) {
  return JSON.stringify([e.id, e.ts, e.actorId, e.actorRole, e.action, e.table, e.recordId, e.oldData, e.newData, e.amount, e.method]);
}
function verifyAudit() {
  let prev = "";
  for (const e of S.audit) {
    if (e.prev !== prev) return { ok: false, id: e.id, reason: "Eslabón faltante o reordenado" };
    if (SHA.hex(prev + "|" + auditPayload(e)) !== e.hash) return { ok: false, id: e.id, reason: "Contenido alterado" };
    prev = e.hash;
  }
  return { ok: true, count: S.audit.length };
}

const db = {
  all: (c) => S[c],
  get: (c, id) => S[c].find((x) => x.id === id),
  where: (c, fn) => S[c].filter(fn),
  insert(c, obj, { silent = false, amount = null, method = null } = {}) {
    const row = { id: obj.id ?? uid(), createdAt: nowISO(), ...obj };
    S[c].push(row);
    if (AUDITED.has(c) && !silent) audit("INSERT", c, row.id, null, structuredClone(row), amount ?? row.amount ?? null, method ?? row.method ?? null);
    save(); return row;
  },
  update(c, id, patch, { silent = false } = {}) {
    if (IMMUTABLE.has(c)) throw new Error(`Registro inmutable (${c})`);
    const row = db.get(c, id); if (!row) throw new Error("Registro inexistente");
    const old = structuredClone(row); Object.assign(row, patch, { updatedAt: nowISO() });
    if (AUDITED.has(c) && !silent) audit("UPDATE", c, id, old, structuredClone(row));
    save(); return row;
  },
  remove(c, id) {
    if (IMMUTABLE.has(c)) throw new Error(`Registro inmutable (${c})`);
    const i = S[c].findIndex((x) => x.id === id); if (i < 0) return;
    const [old] = S[c].splice(i, 1);
    if (AUDITED.has(c)) audit("DELETE", c, id, old, null);
    save();
  },
};

/* ───────────── Sesión y permisos ───────────── */
function currentUser() { return S?.session?.userId ? S.users.find((u) => u.id === S.session.userId) : null; }
function permsOf(u) {
  if (!u) return [];
  if (u.role === "owner") return ALL_PERMS;
  const base = new Set(S.rolePerms[u.role] ?? []);
  for (const [p, g] of Object.entries(u.overrides ?? {})) g ? base.add(p) : base.delete(p);
  return [...base];
}
const can = (p) => permsOf(currentUser()).includes(p);
const isPortalUser = (u = currentUser()) => u && (u.role === "client_admin" || u.role === "client_user");
function need(p) { if (!can(p)) throw new Error(`Permiso denegado: ${p}`); }

/* ───────────── IndexedDB para PDFs ───────────── */
const Files = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error("IndexedDB no disponible"));
    const r = indexedDB.open("svb_files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction("files", mode); const st = t.objectStore("files"); const q = fn(st); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
  const local = {
    put: (key, blob) => tx("readwrite", (s) => s.put(blob, key)),
    get: (key) => tx("readonly", (s) => s.get(key)),
    clear: () => tx("readwrite", (s) => s.clear()),
  };
  return {
    async put(key, blob) {
      await local.put(key, blob).catch(() => { });
      if (typeof Cloud !== "undefined" && Cloud.ready) { const v = S.contractVersions.find((x) => x.id === key); await CloudFiles.put(key, blob, v ? cidOf("contractVersions", v) : null); }
    },
    async get(key) {
      const b = await local.get(key).catch(() => null); if (b) return b;
      if (typeof Cloud !== "undefined" && Cloud.ready) { const c = await CloudFiles.get(key); if (c) { local.put(key, c).catch(() => { }); return c; } }
      return null;
    },
    clear: local.clear,
  };
})();
</script>
