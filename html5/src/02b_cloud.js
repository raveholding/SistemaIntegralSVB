<script>
/* ════════════════════════════════════════════════════════════════════════════
   NUBE · Firebase (Authentication + Cloud Firestore, región São Paulo)
   - Cada registro de cada tabla es un documento de la colección svbd_<tabla>.
   - El estado en memoria S se sincroniza por diferencias: cada save() compara
     contra la última versión enviada/recibida y sube sólo lo que cambió.
   - Los cambios de otros equipos llegan en tiempo real (onSnapshot) y redibujan.
   - Sin señal: Firestore guarda en el equipo (IndexedDB) y sube al reconectar.
   ════════════════════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCIm2QWiHGuMU846qtfoSBdi4j_7tfDedA",
  authDomain: "rave-holding.firebaseapp.com",
  projectId: "rave-holding",
  storageBucket: "rave-holding.firebasestorage.app",
  messagingSenderId: "770821596165",
  appId: "1:770821596165:web:bd124af2976ccb9736686c",
};
/* Administradores raíz (también figuran en firestore.rules): pueden inicializar el sistema. */
const SUPERADMINS = ["vincularbusiness@gmail.com", "raveholding@gmail.com"];
const SYNC_COLS = ["users", "clients", "interactions", "plans", "subscriptions", "subChanges", "contracts", "contractVersions", "resources", "alertRules", "alerts", "registers", "sessions", "documents", "movements", "schemes", "employees", "goals", "commissions", "sites", "pages", "pageVersions", "deployments", "leads", "tickets", "ticketMessages", "notifications"];
const PORTAL_READ = ["clients", "subscriptions", "contracts", "contractVersions", "documents", "resources", "tickets", "ticketMessages"];
const PORTAL_WRITE = ["tickets", "ticketMessages", "notifications"];
const LOCAL_FIELDS = { resources: ["lastBeat", "fails"] };
const colRef = (c) => "svbd_" + c;
const STAFF_SET = new Set(["owner", "partner", "admin", "employee", "seller", "technician"]);

const Cloud = {
  on: true, fb: null, app: null, auth: null, db: null,
  user: null, email: "", member: null, role: null, cid: null, superadmin: false,
  ready: false, phase: "boot",          // boot · auth · loading · pending · ready · error
  error: "", unsubs: [], last: {}, metaLast: "", pubLast: "", membersLast: {}, auditSent: new Set(),
  timer: null, pushing: false, again: false, status: "idle", leader: false, leaderTimer: null,
  device: (() => { try { let d = localStorage.getItem("svb_device"); if (!d) { d = uid(); localStorage.setItem("svb_device", d); } return d; } catch { return uid(); } })(),
  get staff() { return this.superadmin || STAFF_SET.has(this.role); },
  get portal() { return !this.superadmin && (this.role === "client_admin" || this.role === "client_user"); },
  get manager() { return this.superadmin || this.role === "owner" || this.role === "partner"; },
};

function emptyState() {
  const s = { version: 1, demo: false, createdAt: nowISO(), session: { userId: null }, settings: { company: "Vincular Business", cuit: "", heartbeatSec: 60, telegram: { token: "", chatId: "", minSeverity: "warning", enabled: false }, simulate: false, channels: {} }, rolePerms: structuredClone(DEFAULT_ROLE_PERMS), metrics: {}, samples: {}, seq: {}, audit: [] };
  for (const c of SYNC_COLS) s[c] = [];
  return s;
}
function cidOf(c, row) {
  if (c === "clients") return row.id;
  if (row.clientId) return row.clientId;
  if (c === "ticketMessages") return S.tickets.find((t) => t.id === row.ticketId)?.clientId ?? null;
  if (c === "contractVersions") return S.contracts.find((k) => k.id === row.contractId)?.clientId ?? null;
  if (c === "notifications" && Cloud.portal) return Cloud.cid;
  return null;
}
function cloudRow(c, row) {
  const o = JSON.parse(JSON.stringify(row));
  for (const k of LOCAL_FIELDS[c] ?? []) delete o[k];
  return o;
}
const metaOf = () => JSON.stringify({ settings: S.settings, rolePerms: S.rolePerms, seq: S.seq, metrics: S.metrics, createdAt: S.createdAt });

/* ───── arranque ───── */
function cloudBoot() {
  const go = () => {
    if (!window.FB) { Cloud.phase = "error"; Cloud.error = "No se pudo conectar con la nube. Revisá tu conexión a internet y volvé a intentar."; render(); return; }
    try {
      const { app, auth, fs } = window.FB; Cloud.fb = window.FB;
      Cloud.app = app.initializeApp(FIREBASE_CONFIG);
      Cloud.auth = auth.getAuth(Cloud.app);
      auth.useDeviceLanguage(Cloud.auth);
      try {
        Cloud.db = fs.initializeFirestore(Cloud.app, { ignoreUndefinedProperties: true, localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
      } catch (e) { console.warn("Caché local no disponible", e); Cloud.db = fs.getFirestore(Cloud.app); }
      Cloud.phase = "auth";
      auth.onAuthStateChanged(Cloud.auth, (u) => cloudUser(u).catch((e) => { console.error(e); Cloud.phase = "error"; Cloud.error = e.message || String(e); render(); }));
      // resultado de un ingreso con Google por redirección (celulares)
      auth.getRedirectResult(Cloud.auth).catch((e) => toast(authMsg(e), "err"));
    } catch (e) { console.error(e); Cloud.phase = "error"; Cloud.error = e.message; render(); }
  };
  if (window.FB !== undefined) go(); else window.addEventListener("fb-ready", go, { once: true });
}

function cloudStop() {
  Cloud.unsubs.forEach((f) => { try { f(); } catch { } }); Cloud.unsubs = [];
  clearInterval(Cloud.leaderTimer); clearInterval(monitorTimer); clearTimeout(Cloud.timer);
  Cloud.ready = false; Cloud.leader = false; Cloud.last = {}; Cloud.metaLast = ""; Cloud.pubLast = ""; Cloud.membersLast = {}; Cloud.auditSent = new Set();
}

async function cloudUser(u) {
  cloudStop();
  S = emptyState();
  Cloud.user = u; Cloud.member = null; Cloud.role = null; Cloud.cid = null;
  if (!u) { Cloud.phase = "auth"; render(); return; }
  const { fs } = Cloud.fb;
  Cloud.email = (u.email || "").toLowerCase();
  Cloud.superadmin = !!u.emailVerified && SUPERADMINS.includes(Cloud.email);
  Cloud.phase = "loading"; render();
  let m = null;
  try { const snap = await fs.getDoc(fs.doc(Cloud.db, "svb_members", Cloud.email)); m = snap.exists() ? snap.data() : null; }
  catch (e) { if (!Cloud.superadmin) { Cloud.phase = "pending"; render(); return; } }
  if ((!m || m.active === false) && !Cloud.superadmin) { Cloud.phase = "pending"; render(); return; }
  Cloud.member = m; Cloud.role = Cloud.superadmin ? "owner" : m.role; Cloud.cid = m?.clientId || null;

  if (Cloud.staff) {
    const meta = await fs.getDoc(fs.doc(Cloud.db, "svb_meta", "main")).catch(() => null);
    if (!meta || !meta.exists()) {
      if (!Cloud.manager) { Cloud.phase = "pending"; Cloud.error = "El sistema todavía no fue inicializado por un administrador."; render(); return; }
      await cloudBootstrap(u);
    }
  }
  await cloudSubscribe();
  // vincular el usuario del sistema con la cuenta que ingresó
  let me = S.users.find((x) => (x.email || "").toLowerCase() === Cloud.email);
  if (!me && Cloud.superadmin) {
    me = db.insert("users", { name: u.displayName || Cloud.email.split("@")[0], email: Cloud.email, role: "owner", clientId: null, overrides: {}, active: true });
  }
  if (!me || me.active === false) { Cloud.phase = "pending"; render(); return; }
  if (Cloud.superadmin && me.role !== "owner") me.role = "owner";
  S.session.userId = me.id;
  Cloud.ready = true; Cloud.phase = "ready";
  window.__svbStarted = true;
  audit("LOGIN", "users", me.id, null, { role: me.role, via: u.providerData?.[0]?.providerId || "password" });
  cloudPush();
  if (Cloud.staff) { leaderLoop(); try { processExpirations(); } catch (e) { console.error(e); } }
  startMonitor();
  if (!location.hash || location.hash === "#" || location.hash.startsWith("#/acceso")) location.hash = isPortalUser() ? "" : "#/dashboard";
  render();
  inboxListen();
}

/* Primera vez: crea la configuración y carga los clientes iniciales */
async function cloudBootstrap(u) {
  const st = realState({ ownerName: u.displayName || "Administrador", ownerEmail: (u.email || "").toLowerCase() });
  S = st;
  audit("SYSTEM_INIT", "system", null, null, { company: S.settings.company, cloud: "firebase" });
  Cloud.ready = true;                    // permite el envío inicial
  await cloudPush(true);
  Cloud.ready = false;
  S = emptyState(); Cloud.last = {}; Cloud.metaLast = ""; Cloud.pubLast = ""; Cloud.auditSent = new Set(); Cloud.membersLast = {};
}

function cloudSubscribe() {
  const { fs } = Cloud.fb;
  const waits = [];
  const listen = (q, onSnap) => new Promise((ok) => {
    let first = true;
    const un = fs.onSnapshot(q, { includeMetadataChanges: false }, (snap) => { onSnap(snap, first); if (first) { first = false; ok(); } }, (err) => { console.warn("Lectura rechazada", err.code, err.message); if (first) { first = false; ok(); } });
    Cloud.unsubs.push(un);
  });
  const cols = Cloud.staff ? SYNC_COLS : PORTAL_READ;
  for (const c of cols) {
    Cloud.last[c] = new Map();
    const ref = fs.collection(Cloud.db, colRef(c));
    const q = Cloud.staff ? ref : fs.query(ref, fs.where("_cid", "==", Cloud.cid));
    waits.push(listen(q, (snap, first) => applySnap(c, snap, first)));
  }
  if (Cloud.portal) { for (const c of PORTAL_WRITE) if (!Cloud.last[c]) Cloud.last[c] = new Map(); }
  // planes: visibles para todos los usuarios con acceso
  if (!Cloud.staff) { Cloud.last.plans = new Map(); waits.push(listen(fs.collection(Cloud.db, colRef("plans")), (snap) => applySnap("plans", snap))); }
  if (Cloud.staff) {
    waits.push(listen(fs.doc(Cloud.db, "svb_meta", "main"), (snap) => {
      if (!snap.exists()) return; const d = snap.data();
      const j = JSON.stringify({ settings: d.settings, rolePerms: d.rolePerms, seq: d.seq ?? {}, metrics: d.metrics ?? {}, createdAt: d.createdAt });
      if (j === Cloud.metaLast) return; Cloud.metaLast = j;
      const o = JSON.parse(j); S.settings = { ...emptyState().settings, ...o.settings }; S.rolePerms = { ...DEFAULT_ROLE_PERMS, ...o.rolePerms }; S.seq = o.seq; S.metrics = o.metrics; S.createdAt = o.createdAt || S.createdAt;
      S.rolePerms.owner = ALL_PERMS; S.rolePerms.partner = ALL_PERMS;
      remoteRender();
    }));
    waits.push(listen(fs.query(fs.collection(Cloud.db, "svb_audit"), fs.orderBy("id")), (snap) => {
      for (const ch of snap.docChanges()) {
        if (ch.type !== "added") continue;
        const e = ch.doc.data(); if (Cloud.auditSent.has(e.hash)) continue;
        Cloud.auditSent.add(e.hash); if (!S.audit.some((x) => x.hash === e.hash)) S.audit.push(e);
      }
      S.audit.sort((a, b) => a.id - b.id || String(a.ts).localeCompare(String(b.ts)));
      remoteRender(["auditoria"]);
    }));
    waits.push(listen(fs.doc(Cloud.db, "svb_meta", "samples"), (snap) => {
      if (!snap.exists() || Cloud.leader) return; const d = snap.data().data || {};
      S.samples = d; for (const r of S.resources) { const a = d[r.id]; if (a && a.length) r.lastBeat = a[a.length - 1].ts; }
      remoteRender(["dashboard", "monitor"]);
    }));
  } else {
    waits.push(listen(fs.doc(Cloud.db, "svb_meta", "public"), (snap) => { if (snap.exists()) { S.settings.company = snap.data().company || S.settings.company; remoteRender(); } }));
  }
  return Promise.all(waits);
}

function applySnap(c, snap) {
  const last = Cloud.last[c] || (Cloud.last[c] = new Map());
  let changed = false;
  for (const ch of snap.docChanges()) {
    const id = ch.doc.id;
    if (ch.type === "removed") {
      last.delete(id);
      const i = S[c].findIndex((x) => x.id === id); if (i >= 0) { S[c].splice(i, 1); changed = true; }
      continue;
    }
    const d = ch.doc.data(); delete d._cid; delete d._by; delete d._at;
    const j = JSON.stringify(d);
    if (last.get(id) === j) continue;
    last.set(id, j);
    const i = S[c].findIndex((x) => x.id === id);
    if (i >= 0) { const keep = {}; for (const k of LOCAL_FIELDS[c] ?? []) if (S[c][i][k] !== undefined) keep[k] = S[c][i][k]; S[c][i] = Object.assign(d, keep); }
    else S[c].push(d);
    changed = true;
  }
  if (changed) {
    if (c === "notifications") S.notifications.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    remoteRender();
  }
}

let rrTimer = null;
function remoteRender(routes) {
  if (!Cloud.ready) return;
  clearTimeout(rrTimer);
  rrTimer = setTimeout(() => { try { rerenderIf(routes || ROUTES.map((r) => r.id).concat(["portal"]), true); } catch (e) { console.error(e); } }, 120);
}

/* ───── envío de cambios (diferencial) ───── */
function cloudSchedule() { if (!Cloud.ready) return; clearTimeout(Cloud.timer); Cloud.timer = setTimeout(cloudPush, 500); }
async function cloudPush(force = false) {
  if (!Cloud.ready || !Cloud.db) return;
  if (Cloud.pushing) { Cloud.again = true; return; }
  Cloud.pushing = true; clearTimeout(Cloud.timer);
  const { fs } = Cloud.fb; const ops = [];
  try {
    const cols = Cloud.staff ? SYNC_COLS : PORTAL_WRITE;
    for (const c of cols) {
      const last = Cloud.last[c] || (Cloud.last[c] = new Map());
      if (c === "users" && !Cloud.manager && !force) continue;
      const seen = new Set();
      for (const row of S[c]) {
        if (!row || !row.id) continue;
        seen.add(row.id);
        const o = cloudRow(c, row), j = JSON.stringify(o);
        if (last.get(row.id) === j) continue;
        last.set(row.id, j);
        ops.push(["set", fs.doc(Cloud.db, colRef(c), String(row.id)), { ...o, _cid: cidOf(c, row), _by: Cloud.email, _at: Date.now() }]);
      }
      if (Cloud.staff) for (const id of [...last.keys()]) if (!seen.has(id)) { last.delete(id); ops.push(["del", fs.doc(Cloud.db, colRef(c), String(id))]); }
    }
    if (Cloud.staff) {
      const m = metaOf();
      if (m !== Cloud.metaLast) { Cloud.metaLast = m; ops.push(["set", fs.doc(Cloud.db, "svb_meta", "main"), { ...JSON.parse(m), updatedAt: Date.now(), by: Cloud.email }]); }
      const pub = JSON.stringify({ company: S.settings.company, channels: S.settings.channels || {} });
      if (pub !== Cloud.pubLast) { Cloud.pubLast = pub; ops.push(["set", fs.doc(Cloud.db, "svb_meta", "public"), JSON.parse(pub)]); }
    }
    if (Cloud.manager) {
      const cur = {};
      for (const u of S.users) if (u.email) cur[u.email.toLowerCase()] = JSON.stringify({ role: u.role, clientId: u.clientId || null, active: u.active !== false, name: u.name });
      for (const [em, j] of Object.entries(cur)) if (Cloud.membersLast[em] !== j) { Cloud.membersLast[em] = j; ops.push(["set", fs.doc(Cloud.db, "svb_members", em), { ...JSON.parse(j), updatedAt: Date.now() }]); }
      for (const em of Object.keys(Cloud.membersLast)) if (!cur[em]) { delete Cloud.membersLast[em]; ops.push(["del", fs.doc(Cloud.db, "svb_members", em)]); }
    }
    for (const e of S.audit) if (!Cloud.auditSent.has(e.hash)) { Cloud.auditSent.add(e.hash); ops.push(["set", fs.doc(Cloud.db, "svb_audit", e.hash.slice(0, 40)), JSON.parse(JSON.stringify(e))]); }
    if (!ops.length) { setSync("ok"); return; }
    setSync("sync");
    for (let i = 0; i < ops.length; i += 400) {
      const b = fs.writeBatch(Cloud.db);
      for (const [k, ref, data] of ops.slice(i, i + 400)) k === "set" ? b.set(ref, data) : b.delete(ref);
      await b.commit();
    }
    setSync("ok");
  } catch (e) {
    console.error("Error al guardar en la nube", e);
    setSync("err", e.code === "permission-denied" ? "Sin permiso para guardar ese cambio en la nube" : e.message);
  } finally {
    Cloud.pushing = false;
    if (Cloud.again) { Cloud.again = false; cloudSchedule(); }
  }
}
function setSync(st, msg = "") {
  const prev = Cloud.status; Cloud.status = st;
  const el = document.getElementById("sync-ind");
  if (el) { el.className = "sync " + st + (navigator.onLine ? "" : " off"); el.title = syncTitle(); }
  if (st === "err" && prev !== "err") toast("Nube: " + msg, "err");
}
const syncTitle = () => !navigator.onLine ? "Sin conexión · los cambios se guardan en el equipo y se suben al volver la señal" : Cloud.status === "sync" ? "Guardando en la nube…" : Cloud.status === "err" ? "Hubo un error al guardar. Revisá tu conexión o permisos." : "Todo guardado en la nube";
window.addEventListener("online", () => { setSync(Cloud.status); toast("Conexión recuperada: sincronizando"); cloudSchedule(); });
window.addEventListener("offline", () => { setSync(Cloud.status); toast("Sin conexión: seguís trabajando y se sube al volver la señal", "warn"); });

/* ───── equipo «líder»: un solo equipo corre chequeos, vencimientos y muestras ───── */
function leaderLoop() {
  const { fs } = Cloud.fb; const ref = fs.doc(Cloud.db, "svb_meta", "leader");
  const tick = async () => {
    try {
      const s = await fs.getDoc(ref); const d = s.exists() ? s.data() : null;
      const mine = !d || d.device === Cloud.device || Date.now() - (d.beat || 0) > 150000;
      if (mine) await fs.setDoc(ref, { device: Cloud.device, beat: Date.now(), by: Cloud.email });
      if (mine !== Cloud.leader) { Cloud.leader = mine; if (mine) startMonitor(); }
    } catch (e) { console.warn("líder", e.message); }
  };
  tick(); clearInterval(Cloud.leaderTimer); Cloud.leaderTimer = setInterval(tick, 60000);
}
let samplesLastPush = 0;
function pushSamples() {
  if (!Cloud.ready || !Cloud.leader || Date.now() - samplesLastPush < 115000) return;
  samplesLastPush = Date.now(); const { fs } = Cloud.fb; const data = {};
  for (const [k, v] of Object.entries(S.samples)) data[k] = v.slice(-60);
  fs.setDoc(fs.doc(Cloud.db, "svb_meta", "samples"), { data: JSON.parse(JSON.stringify(data)), at: Date.now() }).catch((e) => console.warn(e.message));
}

/* ───── archivos (PDF de contratos) en Firestore, en partes de 700 KB ───── */
const CloudFiles = {
  async put(key, blob, cid = null) {
    if (!Cloud.ready) return;
    const { fs } = Cloud.fb;
    const b64 = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => ko(r.error); r.readAsDataURL(blob); });
    const N = 700000, parts = Math.ceil(b64.length / N) || 1;
    for (let i = 0; i < parts; i++) await fs.setDoc(fs.doc(Cloud.db, "svb_files", `${key}__${i}`), { key, i, parts, type: blob.type || "application/pdf", data: b64.slice(i * N, (i + 1) * N), _cid: cid, at: Date.now() });
  },
  async get(key) {
    if (!Cloud.ready) return null;
    const { fs } = Cloud.fb;
    const first = await fs.getDoc(fs.doc(Cloud.db, "svb_files", `${key}__0`)); if (!first.exists()) return null;
    const f = first.data(); let b64 = f.data;
    for (let i = 1; i < f.parts; i++) { const p = await fs.getDoc(fs.doc(Cloud.db, "svb_files", `${key}__${i}`)); b64 += p.data().data; }
    const bin = atob(b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: f.type });
  },
};

/* ───── autenticación ───── */
function authMsg(e) {
  const m = { "auth/invalid-credential": "Email o contraseña incorrectos", "auth/wrong-password": "Contraseña incorrecta", "auth/user-not-found": "No existe una cuenta con ese email", "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos o restablecé la contraseña", "auth/email-already-in-use": "Ese email ya tiene cuenta: ingresá o restablecé la contraseña", "auth/weak-password": "La contraseña debe tener al menos 6 caracteres", "auth/invalid-email": "Email inválido", "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar", "auth/network-request-failed": "Sin conexión a internet", "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase" };
  return m[e?.code] || e?.message || String(e);
}
const CloudAuth = {
  async google() {
    const { auth } = Cloud.fb; const p = new auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
    try { await auth.signInWithPopup(Cloud.auth, p); }
    catch (e) { if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) return auth.signInWithRedirect(Cloud.auth, p); throw new Error(authMsg(e)); }
  },
  async email(email, pass) { try { await Cloud.fb.auth.signInWithEmailAndPassword(Cloud.auth, email.trim(), pass); } catch (e) { throw new Error(authMsg(e)); } },
  async signup(email, pass) { try { await Cloud.fb.auth.createUserWithEmailAndPassword(Cloud.auth, email.trim(), pass); } catch (e) { throw new Error(authMsg(e)); } },
  async reset(email) { try { await Cloud.fb.auth.sendPasswordResetEmail(Cloud.auth, email.trim()); } catch (e) { throw new Error(authMsg(e)); } },
  async logout() { try { audit("LOGOUT", "users", currentUser()?.id, null, null); await cloudPush(); } catch { } await Cloud.fb.auth.signOut(Cloud.auth); location.hash = ""; },
  /* Crea la cuenta de acceso de otra persona sin cerrar la sesión actual (app secundaria) */
  async createFor(email, pass) {
    const { app, auth } = Cloud.fb;
    const sec = app.getApps().find((a) => a.name === "alta") || app.initializeApp(FIREBASE_CONFIG, "alta");
    const a2 = auth.getAuth(sec);
    try { await auth.createUserWithEmailAndPassword(a2, email.trim(), pass); await auth.signOut(a2); return true; }
    catch (e) { if (e.code === "auth/email-already-in-use") return false; throw new Error(authMsg(e)); }
  },
};
</script>
