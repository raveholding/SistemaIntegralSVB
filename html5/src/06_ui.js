<script>
/* ════════════════════ UI: iconos, componentes, router, modales ════════════════════ */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  monitor: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  docs: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  crm: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6"/>',
  pos: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  hr: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  cms: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  tickets: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24"/>',
  audit: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3 13.09H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.17.4.6.68 1.06.68H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  spark: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  install: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/>',
  cloud: '<path d="M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19z"/>',
  wa: '<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.4-1.9-1.3-2.3-2.3l.8-1-1-2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  cmd: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 0-6z"/>',
};
const icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[n] ?? ""}</svg>`;

/* Componentes */
const pill = (tone, label, dot = false) => `<span class="pill ${tone} ${dot ? "dot" : ""}">${esc(label)}</span>`;
const mapPill = (map, v, dot = true) => { const [t, l] = map[v] ?? ["", v]; return pill(t, l, dot); };
const sdot = (tone, pulse = false) => `<span class="sdot ${pulse ? "pulse" : ""} t-${tone || "subtle"}" style="${tone ? "" : "color:var(--fg-subtle)"}"></span>`;
const kpi = (label, value, hint = "", tone = "") => `<div class="card kpi ${tone}"><div class="l">${esc(label)}</div><div class="v">${value}</div>${hint ? `<div class="h">${hint}</div>` : ""}</div>`;
const card = (title, body, { sub = "", action = "", cls = "", pad = false } = {}) =>
  `<div class="card ${cls}"><div class="card-h"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ""}</div>${action}</div>${pad ? `<div class="card-b">${body}</div>` : body}</div>`;
const ph = (eyebrow, title, sub, actions = "") => `<div class="ph"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="actions">${actions}</div></div>`;
const bar = (pct, tone) => `<div class="bar"><i style="width:${clamp(pct, 0, 100)}%;--c:var(--${tone || (pct >= 100 ? "ok" : pct >= 60 ? "brand" : pct >= 30 ? "warn" : "crit")})"></i></div>`;
const table = (heads, rows, empty = "Sin registros") => `<div class="tw"><table><thead><tr>${heads.map((h) => `<th class="${h.startsWith(">") ? "right" : ""}">${esc(h.replace(/^>/, ""))}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="empty">${empty}</td></tr>`}</tbody></table></div>`;
const field = (label, input, hint = "", cls = "") => `<label class="field ${cls}"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ""}</label>`;
const opts = (pairs, sel) => pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel ?? "") ? "selected" : ""}>${esc(l)}</option>`).join("");
const btn = (label, act, { tone = "outline", sm = false, ic = "", data = {}, disabled = false, type = "button" } = {}) =>
  `<button type="${type}" class="btn ${tone} ${sm ? "sm" : ""}" ${act ? `data-act="${act}"` : ""} ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")} ${disabled ? "disabled" : ""}>${ic ? icon(ic) : ""}${label}</button>`;

/* Diálogos propios (reemplazan confirm/prompt, que varios navegadores móviles y visores bloquean) */
function ask(msg, { input = false, value = "", ok = "Aceptar", cancel = "Cancelar", danger = false, title = "Confirmar" } = {}) {
  return new Promise((resolve) => {
    const root = $("#dialog-root");
    root.innerHTML = `<div class="overlay" style="z-index:70"><div class="modal" style="max-width:460px"><div class="modal-h"><h3>${esc(title)}</h3></div>
      <div class="modal-b"><p class="muted" style="white-space:pre-line;line-height:1.5">${esc(msg)}</p>${input ? `<input class="in" id="ask-in" style="margin-top:14px" value="${esc(value)}">` : ""}</div>
      <div class="modal-f"><button type="button" class="btn ghost" id="ask-no">${esc(cancel)}</button><button type="button" class="btn ${danger ? "danger" : "primary"}" id="ask-ok">${esc(ok)}</button></div></div></div>`;
    const done = (v) => { root.innerHTML = ""; resolve(v); };
    $("#ask-ok").onclick = () => done(input ? $("#ask-in").value : true);
    $("#ask-no").onclick = () => done(input ? null : false);
    const i = $("#ask-in");
    if (i) { i.focus(); i.onkeydown = (e) => { if (e.key === "Enter") $("#ask-ok").click(); }; } else $("#ask-ok").focus();
  });
}

/* Toasts */
function toast(msg, kind = "ok") {
  const el = document.createElement("div"); el.className = `toast ${kind}`; el.textContent = msg;
  $("#toasts").appendChild(el); setTimeout(() => el.remove(), kind === "err" ? 5500 : 3200);
}

/* Modales */
let modalSubmit = null;
function openModal(title, body, { submit = null, submitLabel = "Guardar", wide = false, footer = null } = {}) {
  modalSubmit = submit;
  $("#modal-root").innerHTML = `<div class="overlay" data-act="modal-bg"><form class="modal ${wide ? "wide" : ""}" id="modal-form" novalidate>
    <div class="modal-h"><h3>${title}</h3><button type="button" class="iconbtn" data-act="modal-close" aria-label="Cerrar">${icon("x")}</button></div>
    <div class="modal-b">${body}</div>
    ${footer ?? (submit ? `<div class="modal-f">${btn("Cancelar", "modal-close", { tone: "ghost" })}<button class="btn primary" type="submit">${submitLabel}</button></div>` : "")}
  </form></div>`;
  setTimeout(() => $("#modal-form input:not([type=hidden]),#modal-form select,#modal-form textarea")?.focus(), 30);
}
const closeModal = () => { $("#modal-root").innerHTML = ""; modalSubmit = null; };
const formData = (form) => Object.fromEntries(new FormData(form).entries());

/* Ejecuta una acción con manejo de errores + re-render */
async function run(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); render(); return r; }
  catch (e) { toast(e.message || String(e), "err"); return null; }
}

/* Router */
const ROUTES = [
  { id: "dashboard", label: "Resumen", ic: "dashboard", perm: null },
  { id: "monitor", label: "Infraestructura", ic: "monitor", perm: "monitor.read" },
  { id: "documentos", label: "Contratos", ic: "docs", perm: "docs.read" },
  { id: "crm", label: "CRM y planes", ic: "crm", perm: "crm.read" },
  { id: "caja", label: "Caja y POS", ic: "pos", perm: "pos.operate" },
  { id: "rrhh", label: "Equipo", ic: "hr", perm: "hr.read" },
  { id: "cms", label: "Web y CMS", ic: "cms", perm: "cms.read" },
  { id: "atencion", label: "Atención al público", ic: "chat", perm: "inbox.manage" },
  { id: "soporte", label: "Soporte", ic: "tickets", perm: "tickets.read" },
  { id: "auditoria", label: "Auditoría", ic: "audit", perm: "audit.read" },
  { id: "ajustes", label: "Ajustes", ic: "settings", perm: "settings.manage" },
];
const route = () => (location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard");
const routeParam = (k) => new URLSearchParams(location.hash.split("?")[1] || "").get(k);
const UI = { monitorRes: null, monitorMetric: "cpu", notifOpen: false, sale: null, auditFilter: "", search: "", ticket: null };

function rerenderIf(routes, soft = false) {
  if (!currentUser()) return;
  const r = isPortalUser() ? "portal" : route();
  if (!routes.includes(r)) { if (soft) updateBadges(); return; }
  if (soft) {
    if ($("#modal-root").innerHTML) return;
    const a = document.activeElement;
    if (a && ["INPUT", "SELECT", "TEXTAREA"].includes(a.tagName)) return;
    // no borrar formularios con datos a medio cargar
    if ($$("#view input:not([type=hidden]):not([type=checkbox]):not(#gsearch), #view textarea").some((i) => i.value && i.defaultValue !== i.value)) return;
  }
  render();
}

function render() {
  const root = $("#root");
  if (route() === "contacto") { root.innerHTML = viewPublicChat(); afterRender(); return; }
  const u = currentUser();
  if (!u) { root.innerHTML = typeof Cloud !== "undefined" && Cloud.on ? viewCloudGate() : viewLogin(); afterRender(); return; }
  if (isPortalUser(u)) { root.innerHTML = viewPortal(); afterRender(); return; }
  let r = route();
  const def = ROUTES.find((x) => x.id === r);
  if (!def || (def.perm && !can(def.perm))) r = "dashboard";
  const views = { dashboard: viewDashboard, monitor: viewMonitor, documentos: viewDocs, crm: viewCrm, caja: viewCaja, rrhh: viewHr, cms: viewCms, soporte: viewSupport, atencion: viewInbox, auditoria: viewAudit, ajustes: viewSettings };
  const k = kpis();
  const nav = ROUTES.filter((x) => !x.perm || can(x.perm)).map((x) => {
    const badge = x.id === "monitor" ? k.openAlerts : x.id === "soporte" ? k.openTickets : x.id === "atencion" ? inboxUnread() : 0;
    return `<a href="#/${x.id}" class="${x.id === r ? "active" : ""}">${icon(x.ic)}<span>${x.label}</span>${badge ? `<span class="badge" data-badge="${x.id}">${badge}</span>` : ""}</a>`;
  }).join("");
  const unread = S.notifications.filter((n) => !n.read).length;
  const scroll = window.scrollY;
  const prevMain = $("#view");
  const sameRoute = prevMain && prevMain.dataset.route === r;
  root.innerHTML = `<div class="app">
    <aside class="side" id="side">
      <div class="logo"><div class="logo-mark">VB</div><div><b>Sistema Integral</b><span>${esc(S.settings.company)}</span></div></div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot">Desarrollado por ${DEV.name}<br>WhatsApp ${DEV.wa}<br>${DEV.email}</div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="iconbtn menu-toggle" data-act="menu">${icon("menu")}</button>
        <div class="search">${icon("search")}<input id="gsearch" placeholder="Buscar clientes, contratos, comprobantes…" value="${esc(UI.search)}" autocomplete="off"></div>
        <div class="top-right">
          ${cloudBadge()}
          <button class="iconbtn" data-act="palette" title="Ir a… (Ctrl+K)">${icon("cmd")}</button>
          <button class="iconbtn" data-act="theme" title="Tema claro / oscuro">${icon(themeIsLight() ? "moon" : "sun")}</button>
          ${installBtn()}
          <button class="iconbtn" data-act="notif" aria-label="Notificaciones">${icon("bell")}${unread ? '<span class="dot"></span>' : ""}</button>
          <div class="who"><b>${esc(u.name)}</b><span>${ROLES[u.role]}</span></div>
          <div class="avatar">${esc(u.name[0])}</div>
          <button class="iconbtn" data-act="logout" title="Cerrar sesión">${icon("logout")}</button>
        </div>
      </header>
      <main class="content" id="view" data-route="${r}">${UI.search ? viewSearch() : views[r]()}</main>
    </div>
  </div>${UI.notifOpen ? viewNotifications() : ""}`;
  if (sameRoute) window.scrollTo(0, scroll);
  afterRender();
}
function updateBadges() {
  const k = kpis();
  const set = (id, v) => { const el = $(`[data-badge="${id}"]`); if (el) el.textContent = v; };
  set("monitor", k.openAlerts); set("soporte", k.openTickets); set("atencion", inboxUnread());
}
const afterHooks = [];
function afterRender() { while (afterHooks.length) { try { afterHooks.shift()(); } catch (e) { console.error(e); } } }

/* Gráfico de líneas en canvas (sin librerías) */
function drawChart(canvas, data, { key, warn, crit, unit, max, color = "#7C8CFF" }) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext("2d"); g.scale(dpr, dpr);
  const pl = 44, pr = 12, pt = 10, pb = 26, w = W - pl - pr, h = H - pt - pb;
  const vals = data.map((d) => d[key]);
  const top = max ?? Math.max(crit * 1.15, ...vals, 1);
  const y = (v) => pt + h - (v / top) * h, x = (i) => pl + (data.length <= 1 ? w : (i / (data.length - 1)) * w);
  g.font = "11px Inter, system-ui, sans-serif"; g.fillStyle = "#6B768A"; g.strokeStyle = "rgba(255,255,255,.05)";
  for (let i = 0; i <= 4; i++) { const v = top * i / 4, yy = y(v); g.beginPath(); g.moveTo(pl, yy); g.lineTo(W - pr, yy); g.stroke(); g.fillText(Math.round(v) + (unit === "%" ? "" : ""), 6, yy + 4); }
  [[warn, "rgba(255,197,61,.6)"], [crit, "rgba(255,77,106,.7)"]].forEach(([v, c]) => { if (v == null || v > top) return; g.setLineDash([4, 4]); g.strokeStyle = c; g.beginPath(); g.moveTo(pl, y(v)); g.lineTo(W - pr, y(v)); g.stroke(); g.setLineDash([]); });
  if (!data.length) { g.fillText("Esperando heartbeats…", pl + w / 2 - 60, pt + h / 2); return; }
  const step = Math.max(1, Math.ceil(data.length / 6));
  data.forEach((d, i) => { if (i % step === 0) g.fillText(new Date(d.ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }), x(i) - 22, H - 8); });
  const grad = g.createLinearGradient(0, pt, 0, pt + h); grad.addColorStop(0, color + "55"); grad.addColorStop(1, color + "00");
  g.beginPath(); data.forEach((d, i) => i ? g.lineTo(x(i), y(d[key])) : g.moveTo(x(i), y(d[key])));
  g.lineTo(x(data.length - 1), pt + h); g.lineTo(x(0), pt + h); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); data.forEach((d, i) => i ? g.lineTo(x(i), y(d[key])) : g.moveTo(x(i), y(d[key]))); g.strokeStyle = color; g.lineWidth = 2; g.stroke();
}
</script>
