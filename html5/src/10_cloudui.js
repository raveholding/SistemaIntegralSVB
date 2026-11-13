<script>
/* ════════════════════════════════════════════════════════════════════════════
   v2 · Acceso con Firebase, canal de atención al público, instalación (PWA),
   tema claro/oscuro, paleta de comandos (Ctrl+K) e indicador de nube.
   ════════════════════════════════════════════════════════════════════════════ */

/* ───── Tema ───── */
function applyTheme() {
  let mode = "dark"; try { mode = localStorage.getItem("svb_theme") || "dark"; } catch { }
  const light = mode === "light" || (mode === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? "#F4F6FB" : "#07090D";
}
const themeIsLight = () => document.documentElement.dataset.theme === "light";
applyTheme();

/* ───── Instalar app (PWA) ───── */
let deferredInstall = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; $$(".install-slot").forEach((x) => x.innerHTML = installBtn(x.dataset.big === "1")); });
window.addEventListener("appinstalled", () => { deferredInstall = null; toast("¡Sistema instalado! Lo encontrás en tu pantalla de inicio"); render(); });
function installBtn(big = false) {
  if (isStandalone()) return "";
  return big ? `<button class="gbtn install-btn" data-act="install">${icon("install")} Instalar la app en este equipo</button>`
    : `<button class="iconbtn install-btn" data-act="install" title="Instalar la app">${icon("install")}</button>`;
}
async function doInstall() {
  if (deferredInstall) { deferredInstall.prompt(); const r = await deferredInstall.userChoice.catch(() => null); deferredInstall = null; if (r?.outcome === "accepted") toast("Instalando…"); return; }
  const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  openModal("Instalar Sistema Integral SVB", `<p class="small muted mb">Queda como una app más: ícono propio, pantalla completa y acceso directo.</p>
    <ol class="small" style="line-height:1.9;padding-left:18px">${ios
      ? `<li>Abrí esta página en <b>Safari</b>.</li><li>Tocá el botón <b>Compartir</b> (cuadrado con flecha ↑).</li><li>Elegí <b>«Agregar a inicio»</b> y confirmá.</li>`
      : /android/i.test(ua) ? `<li>Abrí esta página en <b>Chrome</b>.</li><li>Tocá el menú <b>⋮</b> arriba a la derecha.</li><li>Elegí <b>«Instalar app»</b> o <b>«Agregar a la pantalla principal»</b>.</li>`
      : `<li>Abrí esta página en <b>Chrome</b> o <b>Edge</b>.</li><li>Hacé clic en el ícono de <b>instalar</b> (monitor con flecha) a la derecha de la barra de direcciones, o en el menú <b>⋮ → Transmitir, guardar y compartir → Instalar página como app</b>.</li><li>Confirmá con <b>Instalar</b>.</li>`}</ol>`, { footer: "" });
}
if ("serviceWorker" in navigator && location.protocol === "https:") window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW", e.message)));

/* ───── Indicador de nube ───── */
function cloudBadge() {
  if (typeof Cloud === "undefined" || !Cloud.on) return "";
  const st = Cloud.status === "idle" ? "ok" : Cloud.status;
  return `<span id="sync-ind" class="sync ${st}${navigator.onLine ? "" : " off"}" title="${esc(syncTitle())}"><i></i>${icon("cloud")}<b>${navigator.onLine ? (st === "sync" ? "Guardando" : st === "err" ? "Error" : "En la nube") : "Sin señal"}</b></span>`;
}

/* ───── Pantallas de acceso ───── */
const GATE = { mode: "login", busy: false, email: "" };
const DEV_LINE = () => `<div class="xs subtle center" style="margin-top:14px;text-align:center">Desarrollado por ${DEV.name} · WhatsApp ${DEV.wa} · ${DEV.email}</div>`;
const G_ICON = `<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
function viewCloudGate() {
  const head = (t, s) => `<div class="gate-logo">VB</div><h1>${t}</h1><p class="small muted">${s}</p>`;
  const help = `<a class="fab" href="#/contacto">${icon("chat")} Atención al público</a>`;
  if (Cloud.phase === "boot" || Cloud.phase === "loading") return `<div class="gate"><div class="gate-card" style="text-align:center"><div class="gate-logo" style="margin:0 auto 16px">VB</div><div class="spin"></div><b>${Cloud.phase === "boot" ? "Conectando con la nube…" : "Cargando tus datos…"}</b><p class="xs subtle" style="margin-top:6px">Sistema Integral SVB · Vincular Business</p></div></div>`;
  if (Cloud.phase === "error") return `<div class="gate"><div class="gate-card">${head("No pudimos conectar", esc(Cloud.error || "Error desconocido"))}<div style="margin-top:18px">${btn("Reintentar", "reload", { tone: "primary" })}</div>${DEV_LINE()}</div></div>${help}`;
  if (Cloud.phase === "pending") return `<div class="gate"><div class="gate-card">${head("Acceso pendiente", `La cuenta <b>${esc(Cloud.email)}</b> todavía no tiene acceso al sistema.`)}
    <p class="small muted" style="margin-top:14px">${esc(Cloud.error || "Pedile al administrador que te dé de alta en Ajustes → Usuarios con este mismo email. Después volvé a ingresar.")}</p>
    <div class="gate-foot">${btn("Reintentar", "reload", { tone: "primary" })}${btn("Ingresar con otra cuenta", "logout")}</div>${DEV_LINE()}</div></div>${help}`;
  const m = GATE.mode;
  return `<div class="gate"><div class="gate-card">
    ${head(m === "signup" ? "Crear mi acceso" : m === "reset" ? "Restablecer contraseña" : "Sistema Integral SVB", m === "signup" ? "Usá el email con el que te dieron de alta." : m === "reset" ? "Te enviamos un enlace a tu email para elegir una nueva contraseña." : "Ingresá para gestionar clientes, sistemas, caja y soporte.")}
    ${m === "login" ? `<div style="margin-top:20px"><button class="gbtn" data-act="g-login" ${GATE.busy ? "disabled" : ""}>${G_ICON} Continuar con Google</button></div><div class="or">o con tu email</div>` : '<div style="height:18px"></div>'}
    <form id="gate-form" autocomplete="on">
      <input class="in" name="email" type="email" placeholder="tu@email.com" autocomplete="username" required value="${esc(GATE.email)}">
      ${m !== "reset" ? `<input class="in" name="pass" type="password" placeholder="${m === "signup" ? "Elegí una contraseña (mín. 6)" : "Contraseña"}" autocomplete="${m === "signup" ? "new-password" : "current-password"}" required minlength="6">` : ""}
      <button class="btn primary" style="width:100%;height:44px" ${GATE.busy ? "disabled" : ""}>${GATE.busy ? "Un momento…" : m === "signup" ? "Crear acceso" : m === "reset" ? "Enviar enlace" : "Ingresar"}</button>
    </form>
    <div class="links">${m === "login" ? `<a data-act="gate-mode" data-id="reset">Olvidé mi contraseña</a><a data-act="gate-mode" data-id="signup">Primer ingreso: crear contraseña</a>` : `<a data-act="gate-mode" data-id="login">← Volver a ingresar</a>`}</div>
    <div class="gate-foot"><span class="install-slot" data-big="1">${installBtn(true)}</span><a class="gbtn" href="#/contacto" style="text-decoration:none">${icon("chat")} ¿Necesitás ayuda? Escribinos</a></div>
    ${DEV_LINE()}</div></div>`;
}
async function gateSubmit(f) {
  const d = formData(f); GATE.email = d.email || ""; GATE.busy = true; render();
  try {
    if (GATE.mode === "reset") { await CloudAuth.reset(d.email); toast("Te enviamos el enlace. Revisá tu correo (y la carpeta de spam)."); GATE.mode = "login"; }
    else if (GATE.mode === "signup") { await CloudAuth.signup(d.email, d.pass); toast("Acceso creado"); }
    else await CloudAuth.email(d.email, d.pass);
  } catch (e) { toast(e.message, "err"); }
  GATE.busy = false; if (!currentUser()) render();
}

/* ───── Canal de atención al público (página pública #/contacto) ───── */
const PUB = { id: null, doc: null, unsub: null, meta: null, metaLoading: false, sending: false };
try { PUB.id = localStorage.getItem("svb_chat_id"); } catch { }
const TOPICS = { sistema: "Quiero un sistema para mi negocio", soporte: "Soy cliente: necesito soporte", facturacion: "Facturación y pagos", otro: "Otra consulta" };
const pubCh = () => PUB.meta?.channels || {};
const waLink = (num, text = "") => `https://wa.me/${String(num || "").replace(/\D/g, "")}${text ? "?text=" + encodeURIComponent(text) : ""}`;
function pubEnsure() {
  if (!Cloud.db) { window.addEventListener("fb-ready", () => setTimeout(() => route() === "contacto" && render(), 300), { once: true }); return false; }
  const { fs } = Cloud.fb;
  if (!PUB.meta && !PUB.metaLoading) { PUB.metaLoading = true; fs.getDoc(fs.doc(Cloud.db, "svb_meta", "public")).then((s) => { PUB.meta = s.exists() ? s.data() : { company: "Vincular Business", channels: {} }; render(); }).catch(() => { PUB.meta = { company: "Vincular Business", channels: {} }; render(); }); }
  if (PUB.id && !PUB.unsub) {
    PUB.unsub = fs.onSnapshot(fs.doc(Cloud.db, "svb_inbox", PUB.id), (s) => {
      if (!s.exists()) { pubForget(); return render(); }
      const prev = PUB.doc?.messages?.length || 0; PUB.doc = s.data();
      if (PUB.doc.unreadVisitor && route() === "contacto" && document.visibilityState === "visible") fs.updateDoc(s.ref, { unreadVisitor: false }).catch(() => { });
      if (route() === "contacto") { const a = document.activeElement; const typing = a && a.id === "pub-msg" && a.value; if (!typing) render(); else pubRenderThread(); if (PUB.doc.messages.length > prev && prev && PUB.doc.lastFrom === "staff") beep(); }
    }, () => { pubForget(); render(); });
  }
  return true;
}
function pubForget() { try { localStorage.removeItem("svb_chat_id"); } catch { } if (PUB.unsub) PUB.unsub(); PUB.unsub = null; PUB.id = null; PUB.doc = null; }
const msgHtml = (m, mine) => `<div class="msg ${m.from === "sys" ? "sys" : m.from === mine ? "me" : "them"}">${esc(m.body)}<small>${m.from === "staff" ? esc(m.name || "Equipo") + " · " : ""}${new Date(m.at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></div>`;
function pubRenderThread() { const el = $("#pub-thread"); if (el && PUB.doc) { el.innerHTML = PUB.doc.messages.map((m) => msgHtml(m, "visitor")).join(""); el.scrollTop = el.scrollHeight; } }
function viewPublicChat() {
  const ok = pubEnsure();
  const meta = PUB.meta, ch = pubCh(), company = meta?.company || "Vincular Business";
  afterHooks.push(() => { const el = $("#pub-thread"); if (el) el.scrollTop = el.scrollHeight; });
  const chans = [
    ch.whatsapp && `<a class="chan wa" target="_blank" rel="noopener" href="${waLink(ch.whatsapp, "Hola " + company + ", quería hacer una consulta")}">${icon("wa")} WhatsApp</a>`,
    ch.email && `<a class="chan mail" href="mailto:${esc(ch.email)}">${icon("mail")} Email</a>`,
    ch.instagram && `<a class="chan ig" target="_blank" rel="noopener" href="https://instagram.com/${esc(String(ch.instagram).replace(/^@/, ""))}">${icon("spark")} Instagram</a>`,
    ch.facebook && `<a class="chan fb" target="_blank" rel="noopener" href="https://facebook.com/${esc(ch.facebook)}">${icon("cms")} Facebook</a>`,
    ch.telegram && `<a class="chan" target="_blank" rel="noopener" href="https://t.me/${esc(String(ch.telegram).replace(/^@/, ""))}">${icon("send")} Telegram</a>`,
  ].filter(Boolean).join("");
  let body;
  if (window.FB === null) body = `<div class="card" style="padding:28px;text-align:center"><b>No pudimos abrir el chat en este momento.</b><p class="small muted">Escribinos directamente:</p><div class="chans"><a class="chan wa" target="_blank" rel="noopener" href="${waLink("549" + DEV.wa.replace(/\D/g, ""), "Hola, quería hacer una consulta")}">${icon("wa")} WhatsApp</a><a class="chan mail" href="mailto:${DEV.email}">${icon("mail")} Email</a></div></div>`;
  else if (!ok || !meta) body = `<div class="card" style="padding:40px;text-align:center"><div class="spin"></div>Cargando…</div>`;
  else if (PUB.id && !PUB.doc) body = `<div class="card" style="padding:40px;text-align:center"><div class="spin"></div>Abriendo tu conversación…</div>`;
  else if (PUB.doc) {
    const d = PUB.doc;
    body = `<div class="card"><div class="card-h row between" style="padding:14px 16px;border-bottom:1px solid var(--line)"><div><b>Tu consulta</b><div class="xs subtle">${esc(TOPICS[d.topic] || "Consulta")} · ${d.status === "resolved" ? "Resuelta" : "Te respondemos por acá y por tus datos de contacto"}</div></div>${btn("Nueva consulta", "pub-new", { sm: true, tone: "ghost" })}</div>
      <div class="chat" id="pub-thread">${d.messages.map((m) => msgHtml(m, "visitor")).join("")}</div>
      <form id="pub-reply" class="composer"><textarea class="in" id="pub-msg" name="body" rows="1" placeholder="Escribí tu mensaje…" maxlength="2000" required></textarea><button class="btn primary" ${PUB.sending ? "disabled" : ""}>${icon("send")}</button></form></div>`;
  } else body = `<div class="card" style="padding:20px">
      <p class="small muted" style="margin:0 0 14px">${esc(ch.welcome || "Contanos en qué te ayudamos y te respondemos a la brevedad.")}</p>
      <form id="pub-form" class="fgrid">
        ${field("Tu nombre *", `<input class="in" name="name" required maxlength="80" autocomplete="name">`)}
        ${field("WhatsApp / teléfono", `<input class="in" name="phone" maxlength="40" inputmode="tel" autocomplete="tel" placeholder="387 …">`)}
        ${field("Email", `<input class="in" name="email" type="email" maxlength="120" autocomplete="email">`)}
        ${field("Tu negocio o empresa", `<input class="in" name="business" maxlength="100">`)}
        ${field("Motivo", `<select class="in" name="topic">${opts(Object.entries(TOPICS))}</select>`, "", "full")}
        ${field("Mensaje *", `<textarea class="in" name="body" rows="4" required maxlength="2000" placeholder="Contanos tu consulta"></textarea>`, "", "full")}
        <div class="full row between wrap"><span class="xs subtle">Dejanos al menos un teléfono o email para responderte.</span><button class="btn primary" ${PUB.sending ? "disabled" : ""}>${icon("send")} ${PUB.sending ? "Enviando…" : "Enviar consulta"}</button></div>
      </form></div>`;
  return `<div class="pub"><div class="pub-wrap">
    <div class="pub-head"><div class="gate-logo" style="margin:0">VB</div><div><div class="eyebrow">Atención al público</div><h1 style="margin:2px 0 0;font-size:22px">${esc(company)}</h1>${ch.hours ? `<div class="xs subtle">${esc(ch.hours)}</div>` : ""}</div>
      <div style="margin-left:auto" class="row">${currentUser() ? `<a class="btn sm ghost" href="#/${isPortalUser() ? "" : "atencion"}">Volver al sistema</a>` : `<a class="btn sm ghost" href="#/">Ingresar</a>`}</div></div>
    ${chans ? `<div class="chans">${chans}</div>` : ""}
    ${body}
    ${DEV_LINE()}</div></div>`;
}
async function pubCreate(f) {
  const d = formData(f);
  if (!d.name || d.name.trim().length < 2) return toast("Ingresá tu nombre", "err");
  if (!d.phone && !d.email) return toast("Dejanos un teléfono o un email para responderte", "err");
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return toast("Email inválido", "err");
  if (!d.body || d.body.trim().length < 3) return toast("Escribí tu consulta", "err");
  const { fs } = Cloud.fb; const now = Date.now();
  PUB.sending = true; render();
  try {
    const ref = await fs.addDoc(fs.collection(Cloud.db, "svb_inbox"), {
      name: d.name.trim(), phone: (d.phone || "").trim(), email: (d.email || "").trim().toLowerCase(), business: (d.business || "").trim(), topic: TOPICS[d.topic] ? d.topic : "otro",
      status: "new", channel: "web", createdAt: now, updatedAt: now, lastFrom: "visitor", unreadStaff: true, unreadVisitor: false, assignedTo: null,
      messages: [{ from: "visitor", name: d.name.trim(), body: d.body.trim(), at: now }],
    });
    PUB.id = ref.id; try { localStorage.setItem("svb_chat_id", ref.id); } catch { }
    toast("¡Recibimos tu consulta! Te respondemos por acá.");
  } catch (e) { console.error(e); toast("No se pudo enviar. Probá de nuevo o escribinos por WhatsApp.", "err"); }
  PUB.sending = false; render();
}
async function pubReply(f) {
  const body = (formData(f).body || "").trim(); if (!body || !PUB.doc) return;
  const { fs } = Cloud.fb; const now = Date.now();
  try {
    await fs.updateDoc(fs.doc(Cloud.db, "svb_inbox", PUB.id), { messages: [...PUB.doc.messages, { from: "visitor", name: PUB.doc.name, body, at: now }], updatedAt: now, lastFrom: "visitor", unreadStaff: true });
    const t = $("#pub-msg"); if (t) t.value = "";
  } catch (e) { toast("No se pudo enviar el mensaje", "err"); }
}

/* ───── Bandeja de atención (equipo) ───── */
const INBOX = { list: [], loaded: false, sel: null, filter: "open", q: "", unsub: null, seen: new Map() };
const inboxUnread = () => INBOX.list.filter((c) => c.unreadStaff && c.status !== "resolved").length;
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.08, a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .35); o.start(); o.stop(a.currentTime + .36); } catch { } }
function inboxListen() {
  if (INBOX.unsub || !Cloud.ready || !can("inbox.manage")) return;
  const { fs } = Cloud.fb;
  INBOX.unsub = fs.onSnapshot(fs.query(fs.collection(Cloud.db, "svb_inbox"), fs.orderBy("updatedAt", "desc"), fs.limit(400)), (snap) => {
    const first = !INBOX.loaded;
    INBOX.list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    for (const c of INBOX.list) {
      const n = c.messages?.length || 0, prev = INBOX.seen.get(c.id);
      if (!first && c.lastFrom === "visitor" && (prev === undefined || n > prev)) {
        beep(); toast(`💬 ${c.name}: ${String(c.messages[n - 1]?.body || "").slice(0, 70)}`);
        notify({ kind: "inbox", title: `Atención al público · ${c.name}`, body: String(c.messages[n - 1]?.body || "").slice(0, 140), link: "#/atencion?c=" + c.id, dedupe: `inbox:${c.id}:${n}`, telegram: Cloud.leader });
        try { if (document.visibilityState !== "visible" && window.Notification && Notification.permission === "granted") new Notification("Nueva consulta · " + c.name, { body: String(c.messages[n - 1]?.body || "").slice(0, 120), icon: "icon-192.png", tag: c.id }); } catch { }
      }
      INBOX.seen.set(c.id, n);
    }
    INBOX.loaded = true; Cloud.unsubs.push(() => { });
    updateBadges(); rerenderIf(["atencion"], route() === "atencion" && !!$("#ib-msg")?.value);
  }, (e) => console.warn("bandeja", e.message));
  Cloud.unsubs.push(() => { INBOX.unsub && INBOX.unsub(); INBOX.unsub = null; INBOX.loaded = false; INBOX.list = []; INBOX.seen = new Map(); });
}
const IB_ST = { new: ["info", "Nueva"], open: ["warn", "En curso"], resolved: ["ok", "Resuelta"] };
function viewInbox() {
  if (!INBOX.unsub) inboxListen();
  const ch = S.settings.channels || {};
  const want = routeParam("c"); if (want) INBOX.sel = want;
  const q = INBOX.q.toLowerCase();
  const list = INBOX.list.filter((c) => (INBOX.filter === "all" || (INBOX.filter === "open" ? c.status !== "resolved" : c.status === INBOX.filter)) && (!q || [c.name, c.phone, c.email, c.business].join(" ").toLowerCase().includes(q)));
  const sel = INBOX.list.find((c) => c.id === INBOX.sel) || null;
  if (sel && sel.unreadStaff) { const { fs } = Cloud.fb; fs.updateDoc(fs.doc(Cloud.db, "svb_inbox", sel.id), { unreadStaff: false }).catch(() => { }); }
  const link = location.origin + location.pathname + "#/contacto";
  afterHooks.push(() => { const t = $("#ib-thread"); if (t) t.scrollTop = t.scrollHeight; });
  const k = { new: INBOX.list.filter((c) => c.status === "new").length, open: INBOX.list.filter((c) => c.status === "open").length, today: INBOX.list.filter((c) => Date.now() - c.createdAt < 864e5).length, unread: inboxUnread() };
  const quick = ["¡Hola! Gracias por escribirnos. ¿En qué te podemos ayudar?", "Ya lo estamos revisando, te aviso apenas esté.", "¿Te parece si coordinamos una llamada? Pasame un horario.", "¡Listo! Quedó resuelto. Cualquier cosa nos escribís."];
  return ph("Canal de atención", "Atención al público", "Consultas que llegan desde la página pública, en tiempo real. Respondé desde acá, por WhatsApp o email, y convertilas en prospecto o ticket.",
    `<button class="btn outline" data-act="ib-copy" data-id="${esc(link)}">${icon("send")} Copiar enlace público</button><a class="btn outline" href="#/contacto" target="_blank">${icon("eye")} Ver página pública</a>${btn("Canales", "ib-channels", { ic: "settings", tone: "primary" })}`) +
  `<div class="grid g4 mb">${kpi("Sin leer", k.unread, "", k.unread ? "warn" : "ok")}${kpi("Nuevas", k.new)}${kpi("En curso", k.open)}${kpi("Últimas 24 h", k.today)}</div>
  <div class="inbox">
    <div class="card"><div style="padding:12px;border-bottom:1px solid var(--line)"><div class="tabs mb" style="margin-bottom:10px">${[["open", "Abiertas"], ["new", "Nuevas"], ["resolved", "Resueltas"], ["all", "Todas"]].map(([kk, l]) => `<button data-act="ib-filter" data-id="${kk}" class="${INBOX.filter === kk ? "on" : ""}">${l}</button>`).join("")}</div>
      <input class="in" id="ib-q" placeholder="Buscar por nombre, teléfono, email…" value="${esc(INBOX.q)}" autocomplete="off"></div>
      <div class="inbox-list">${!INBOX.loaded ? `<div class="empty" style="padding:30px;text-align:center"><div class="spin"></div></div>` : list.length ? list.map((c) => `<a class="conv ${c.id === INBOX.sel ? "on" : ""} ${c.unreadStaff && c.status !== "resolved" ? "unread" : ""}" data-act="ib-open" data-id="${c.id}">
        <div class="n"><span>${esc(c.name)}${c.business ? ` <span class="xs subtle">· ${esc(c.business)}</span>` : ""}</span></div>
        <div class="p">${c.lastFrom === "staff" ? "Vos: " : ""}${esc(c.messages?.[c.messages.length - 1]?.body || "")}</div>
        <div class="row between" style="margin-top:6px">${mapPill(IB_ST, c.status)}<span class="xs subtle">${fmt.rel(new Date(c.updatedAt).toISOString())}</span></div></a>`).join("") : `<div class="empty" style="padding:30px;text-align:center">Sin consultas${INBOX.filter !== "all" ? " en este filtro" : ""}.<div class="xs subtle" style="margin-top:6px">Compartí el enlace público en tu WhatsApp, Instagram o sitio.</div></div>`}</div></div>
    ${sel ? `<div class="card"><div class="row between wrap" style="padding:14px 16px;border-bottom:1px solid var(--line);gap:10px">
        <div><b>${esc(sel.name)}</b> ${mapPill(IB_ST, sel.status)}<div class="xs subtle">${esc(TOPICS[sel.topic] || "Consulta")}${sel.business ? " · " + esc(sel.business) : ""} · ${sel.phone ? esc(sel.phone) + " · " : ""}${esc(sel.email || "")} · desde ${fmt.dt(new Date(sel.createdAt).toISOString())}</div></div>
        <div class="row wrap">${sel.phone ? `<a class="btn sm outline" target="_blank" rel="noopener" href="${waLink(sel.phone.replace(/^0/, "").startsWith("54") ? sel.phone : "549" + sel.phone.replace(/\D/g, "").replace(/^0/, ""), "Hola " + sel.name + ", te escribimos de " + S.settings.company + " por tu consulta.")}">${icon("wa")} WhatsApp</a>` : ""}${sel.email ? `<a class="btn sm outline" href="mailto:${esc(sel.email)}?subject=${encodeURIComponent("Tu consulta a " + S.settings.company)}">${icon("mail")} Email</a>` : ""}
          ${can("crm.write") ? btn("→ Prospecto", "ib-lead", { sm: true, data: { id: sel.id } }) : ""}${can("tickets.manage") ? btn("→ Ticket", "ib-ticket", { sm: true, data: { id: sel.id } }) : ""}
          ${sel.status === "resolved" ? btn("Reabrir", "ib-status", { sm: true, data: { id: sel.id, st: "open" } }) : btn("Marcar resuelta", "ib-status", { sm: true, tone: "success", data: { id: sel.id, st: "resolved" } })}</div></div>
      <div class="chat" id="ib-thread" style="max-height:calc(100vh - 420px)">${(sel.messages || []).map((m) => msgHtml(m, "staff")).join("")}</div>
      <div class="row wrap" style="gap:6px;padding:0 12px">${quick.map((t, i) => `<button class="pill" style="cursor:pointer" data-act="ib-quick" data-id="${i}">${esc(t.slice(0, 34))}…</button>`).join("")}</div>
      <form id="ib-reply" class="composer"><textarea class="in" id="ib-msg" name="body" rows="2" placeholder="Escribí la respuesta (Ctrl+Enter para enviar)" maxlength="2000"></textarea><button class="btn primary">${icon("send")} Enviar</button></form></div>`
      : `<div class="card" style="padding:40px;text-align:center"><div class="muted">Elegí una conversación de la lista.</div>
        <div class="xs subtle" style="margin-top:10px">Enlace público para compartir:<br><span class="mono">${esc(link)}</span></div>
        <img alt="Código QR del canal de atención" style="margin-top:16px;border-radius:12px;background:#fff;padding:8px" width="180" height="180" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(link)}">
        <div class="xs subtle" style="margin-top:8px">Imprimilo para el mostrador o compartilo en redes.</div></div>`}
  </div>`;
}
INBOX.quick = ["¡Hola! Gracias por escribirnos. ¿En qué te podemos ayudar?", "Ya lo estamos revisando, te aviso apenas esté.", "¿Te parece si coordinamos una llamada? Pasame un horario.", "¡Listo! Quedó resuelto. Cualquier cosa nos escribís."];
async function inboxReply(id, body) {
  need("inbox.manage");
  const c = INBOX.list.find((x) => x.id === id); if (!c) throw new Error("Conversación no encontrada");
  body = (body || "").trim(); if (!body) throw new Error("Escribí un mensaje");
  const { fs } = Cloud.fb; const now = Date.now(), u = currentUser();
  await fs.updateDoc(fs.doc(Cloud.db, "svb_inbox", id), { messages: [...(c.messages || []), { from: "staff", name: u.name.split(" ")[0], body, at: now }], updatedAt: now, lastFrom: "staff", unreadVisitor: true, unreadStaff: false, status: "open", assignedTo: c.assignedTo || u.id });
  audit("REPLY", "inbox", id, null, { chars: body.length });
}
async function inboxStatus(id, status) {
  need("inbox.manage"); const { fs } = Cloud.fb;
  const c = INBOX.list.find((x) => x.id === id);
  const extra = status === "resolved" ? { messages: [...(c?.messages || []), { from: "sys", body: "Consulta marcada como resuelta por " + currentUser().name.split(" ")[0], at: Date.now() }] } : {};
  await fs.updateDoc(fs.doc(Cloud.db, "svb_inbox", id), { status, updatedAt: Date.now(), unreadStaff: false, ...extra });
  audit("UPDATE", "inbox", id, { status: c?.status }, { status });
}

/* ───── Paleta de comandos (Ctrl+K) ───── */
const PAL = { open: false, q: "", i: 0 };
function palItems() {
  const q = PAL.q.toLowerCase().trim(), out = [];
  for (const r of ROUTES.filter((x) => !x.perm || can(x.perm))) out.push({ ic: r.ic, t: r.label, hint: "Ir", go: "#/" + r.id });
  if (can("crm.read")) for (const c of S.clients) out.push({ ic: "crm", t: c.tradeName || c.legalName, hint: "Cliente", go: "#/crm", client: c.id });
  out.push({ ic: "chat", t: "Página pública de atención", hint: "Abrir", go: "#/contacto" });
  out.push({ ic: themeIsLight() ? "moon" : "sun", t: "Cambiar tema claro/oscuro", hint: "Acción", act: "theme" });
  if (!isStandalone()) out.push({ ic: "install", t: "Instalar la app", hint: "Acción", act: "install" });
  out.push({ ic: "logout", t: "Cerrar sesión", hint: "Acción", act: "logout" });
  return (q ? out.filter((x) => x.t.toLowerCase().includes(q)) : out).slice(0, 12);
}
function palRender() {
  let el = $("#pal-root"); if (!el) { el = document.createElement("div"); el.id = "pal-root"; document.body.appendChild(el); }
  if (!PAL.open) { el.innerHTML = ""; return; }
  const items = palItems(); PAL.i = Math.min(PAL.i, Math.max(0, items.length - 1));
  const had = $("#pal-in");
  el.innerHTML = `<div class="pal" data-act="pal-close"><div class="pal-box" onclick="event.stopPropagation()"><input id="pal-in" placeholder="Buscá una sección, un cliente o una acción…" value="${esc(PAL.q)}" autocomplete="off"><ul>${items.map((x, i) => `<li class="${i === PAL.i ? "on" : ""}" data-act="pal-go" data-id="${i}">${icon(x.ic)}${esc(x.t)}<span>${x.hint}</span></li>`).join("") || '<li class="subtle">Sin resultados</li>'}</ul></div></div>`;
  const inp = $("#pal-in"); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
}
function palGo(i) {
  const x = palItems()[i]; if (!x) return;
  PAL.open = false; PAL.q = ""; palRender();
  if (x.act) return A[x.act]();
  if (x.client) { location.hash = x.go; setTimeout(() => clientModal(x.client), 80); } else location.hash = x.go;
}
document.addEventListener("keydown", (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k" && currentUser() && !isPortalUser()) { ev.preventDefault(); PAL.open = !PAL.open; PAL.i = 0; palRender(); return; }
  if (PAL.open) {
    if (ev.key === "Escape") { PAL.open = false; palRender(); }
    else if (ev.key === "ArrowDown") { ev.preventDefault(); PAL.i++; palRender(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); PAL.i = Math.max(0, PAL.i - 1); palRender(); }
    else if (ev.key === "Enter") { ev.preventDefault(); palGo(PAL.i); }
  }
  if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey) && ev.target.id === "ib-msg") { ev.preventDefault(); $("#ib-reply")?.requestSubmit(); }
  if (ev.key === "Enter" && !ev.shiftKey && ev.target.id === "pub-msg") { ev.preventDefault(); $("#pub-reply")?.requestSubmit(); }
});
document.addEventListener("input", (ev) => {
  if (ev.target.id === "pal-in") { PAL.q = ev.target.value; PAL.i = 0; palRender(); }
  if (ev.target.id === "ib-q") { clearTimeout(INBOX._t); INBOX._t = setTimeout(() => { INBOX.q = ev.target.value; render(); const s = $("#ib-q"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 250); }
});
document.addEventListener("submit", (ev) => {
  const f = ev.target;
  if (f.id === "gate-form") gateSubmit(f);
  else if (f.id === "pub-form") pubCreate(f);
  else if (f.id === "pub-reply") pubReply(f);
  else if (f.id === "ib-reply") { const v = $("#ib-msg").value; inboxReply(INBOX.sel, v).then(() => { const t = $("#ib-msg"); if (t) t.value = ""; }).catch((e) => toast(e.message, "err")); }
});

/* ───── Acciones ───── */
Object.assign(A, {
  reload: () => location.reload(),
  logout: () => { if (Cloud.on) { UI.notifOpen = false; CloudAuth.logout().catch((e) => toast(e.message, "err")); } else { S.session.userId = null; save(); render(); } },
  "g-login": () => { GATE.busy = true; render(); CloudAuth.google().catch((e) => toast(e.message, "err")).finally(() => { GATE.busy = false; if (!currentUser()) render(); }); },
  "gate-mode": (el) => { GATE.mode = el.dataset.id; render(); },
  install: () => doInstall(),
  theme: () => { const next = themeIsLight() ? "dark" : "light"; try { localStorage.setItem("svb_theme", next); } catch { } applyTheme(); render(); },
  palette: () => { PAL.open = true; PAL.i = 0; palRender(); },
  "pal-close": () => { PAL.open = false; palRender(); },
  "pal-go": (el) => palGo(Number(el.dataset.id)),
  "pub-new": async () => { if (!(await ask("Vas a empezar una consulta nueva. La anterior queda registrada.", { title: "Nueva consulta", ok: "Empezar" }))) return; pubForget(); render(); },
  "ib-open": (el) => { INBOX.sel = el.dataset.id; if (routeParam("c")) history.replaceState(null, "", "#/atencion"); render(); if (window.Notification && Notification.permission === "default") Notification.requestPermission().catch(() => { }); },
  "ib-filter": (el) => { INBOX.filter = el.dataset.id; render(); },
  "ib-quick": (el) => { const t = $("#ib-msg"); if (t) { t.value = INBOX.quick[Number(el.dataset.id)]; t.focus(); } },
  "ib-status": (el) => inboxStatus(el.dataset.id, el.dataset.st).then(() => toast(el.dataset.st === "resolved" ? "Consulta resuelta" : "Consulta reabierta")).catch((e) => toast(e.message, "err")),
  "ib-copy": (el) => { const t = el.dataset.id; (navigator.clipboard?.writeText(t) || Promise.reject()).then(() => toast("Enlace copiado: pegalo en WhatsApp, Instagram o tu web")).catch(() => ask("Copiá el enlace:", { input: true, value: t, title: "Enlace público" })); },
  "ib-lead": (el) => run(() => {
    need("crm.write"); const c = INBOX.list.find((x) => x.id === el.dataset.id);
    if (S.leads.some((l) => l.inboxId === c.id)) throw new Error("Esta consulta ya es un prospecto");
    db.insert("leads", { pageId: null, inboxId: c.id, name: c.name, email: c.email, phone: c.phone, company: c.business, message: (c.messages || []).filter((m) => m.from === "visitor").map((m) => m.body).join("\n").slice(0, 1500), source: "Atención al público", status: "new", at: nowISO() });
  }, "Prospecto creado en Web y CMS → Leads"),
  "ib-ticket": (el) => {
    const c = INBOX.list.find((x) => x.id === el.dataset.id);
    const guess = S.clients.find((k) => (c.email && k.email && k.email.toLowerCase() === c.email) || (c.business && (k.tradeName || k.legalName).toLowerCase().includes(c.business.toLowerCase())));
    openModal("Crear ticket de soporte", `<div class="fgrid">${field("Cliente *", `<select class="in" name="clientId">${opts(S.clients.map((k) => [k.id, k.tradeName || k.legalName]), guess?.id)}</select>`)}
      ${field("Prioridad", `<select class="in" name="priority">${opts([["normal", "Normal"], ["high", "Alta"], ["urgent", "Urgente"], ["low", "Baja"]])}</select>`)}
      ${field("Asunto *", `<input class="in" name="subject" value="${esc(TOPICS[c.topic] || "Consulta de atención al público")}">`, "", "full")}
      ${field("Descripción *", `<textarea class="in" name="description" rows="4">${esc((c.messages || []).filter((m) => m.from === "visitor").map((m) => m.body).join("\n"))}</textarea>`, "", "full")}</div>`,
      { submit: (f) => { const d = formData(f); const t = createTicket({ ...d, category: "general" }); return `Ticket #${t.number} creado`; } });
  },
  "ib-channels": () => {
    const ch = S.settings.channels || {};
    openModal("Canales de atención", `<p class="small muted mb">Se muestran en la página pública y en los botones de contacto.</p><div class="fgrid">
      ${field("WhatsApp (con código de país)", `<input class="in" name="whatsapp" value="${esc(ch.whatsapp)}" placeholder="5493874484132">`)}${field("Email", `<input class="in" name="email" type="email" value="${esc(ch.email)}">`)}
      ${field("Instagram (usuario)", `<input class="in" name="instagram" value="${esc(ch.instagram)}" placeholder="vincularbusiness">`)}${field("Facebook (página)", `<input class="in" name="facebook" value="${esc(ch.facebook)}">`)}
      ${field("Telegram (usuario)", `<input class="in" name="telegram" value="${esc(ch.telegram)}">`)}${field("Horario de atención", `<input class="in" name="hours" value="${esc(ch.hours)}">`)}
      ${field("Mensaje de bienvenida", `<textarea class="in" name="welcome" rows="2">${esc(ch.welcome)}</textarea>`, "", "full")}</div>`,
      { submit: (f) => { need("inbox.manage"); const d = formData(f); const old = S.settings.channels; S.settings.channels = { ...ch, ...d, whatsapp: (d.whatsapp || "").replace(/\D/g, "") }; audit("UPDATE", "settings", "channels", old, S.settings.channels); save(); PUB.meta = null; return "Canales guardados"; } });
  },
  "res-edit": (el) => {
    const r = db.get("resources", el.dataset.id);
    openModal("Editar recurso", `<div class="fgrid">
      ${field("Nombre técnico", `<input class="in" name="name" value="${esc(r.name)}">`)}${field("Nombre para el cliente", `<input class="in" name="publicName" value="${esc(r.publicName)}">`)}
      ${field("Cliente", `<select class="in" name="clientId">${opts([["", "Interno"], ...S.clients.map((c) => [c.id, c.tradeName || c.legalName])], r.clientId || "")}</select>`)}${field("Región", `<input class="in" name="region" value="${esc(r.region)}">`)}
      ${field("URL o host", `<input class="in" name="endpoint" value="${esc(r.endpoint)}">`, "Si empieza con https:// se chequea de verdad.", "full")}
      <label class="row small muted full"><input type="checkbox" name="active" ${r.active ? "checked" : ""}> Monitorear este recurso</label></div>`,
      { submit: (f) => { need("monitor.manage"); const d = formData(f); if (!/^[a-z0-9-]{3,}$/.test(d.name)) throw new Error("Nombre técnico: minúsculas, números y guiones"); db.update("resources", r.id, { name: d.name, publicName: d.publicName, clientId: d.clientId || null, region: d.region, endpoint: d.endpoint.trim(), active: !!d.active }); startMonitor(); return "Recurso actualizado"; } });
  },
});
</script>
