<script>
/* ════════════════════ LÓGICA DE NEGOCIO ════════════════════ */

const clientName = (id) => { const c = db.get("clients", id); return c ? (c.tradeName || c.legalName) : "—"; };
const userName = (id) => db.get("users", id)?.name ?? (id && isPortalUser() ? "Equipo de soporte" : "—");
const planOf = (sub) => sub ? db.get("plans", sub.planId) : null;
const subPrice = (sub) => sub ? (sub.priceOverride ?? planOf(sub)?.price ?? 0) : 0;
const activeSub = (clientId) => S.subscriptions.find((s) => s.clientId === clientId && s.status !== "canceled");

/* ───────── Notificaciones + Telegram ───────── */
function strHash(t) { let h1 = 0x811c9dc5, h2 = 5381; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = (Math.imul(h2, 33) + c) | 0; } return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36); }
function notify({ kind, title, body = "", link = "", dedupe = null, severity = "info", telegram = false }) {
  if (dedupe && S.notifications.some((n) => n.dedupe === dedupe)) return null;
  const n = { id: dedupe ? "n_" + strHash(dedupe) : uid(), kind, title, body, link, dedupe, severity, at: nowISO(), read: false };
  S.notifications.unshift(n); S.notifications = S.notifications.slice(0, 200); save();
  if (telegram) sendTelegram(severity, `${title}${body ? "\n" + body : ""}`);
  return n;
}
const SEV_RANK = { info: 0, warning: 1, critical: 2 };
let tgErrorShown = false;
async function sendTelegram(severity, text) {
  const tg = S.settings.telegram;
  if (!tg.enabled || !tg.token || !tg.chatId) return { skipped: true };
  if (SEV_RANK[severity] < SEV_RANK[tg.minSeverity]) return { skipped: true };
  const icon = { critical: "🔴", warning: "🟡", info: "🔵", ok: "✅" }[severity] ?? "🔵";
  try {
    const r = await fetch(`https://api.telegram.org/bot${encodeURIComponent(tg.token)}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tg.chatId, text: `${icon} ${text}\n— Sistema Integral SVB`, disable_web_page_preview: true }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.description || "Error de Telegram");
    return { ok: true };
  } catch (e) {
    if (!tgErrorShown) { toast("Telegram: " + e.message, "err"); tgErrorShown = true; }
    return { ok: false, error: e.message };
  }
}

/* ───────── POS · CAJA ───────── */
const DOC_TYPES = { invoice_a: "Factura A", invoice_b: "Factura B", invoice_c: "Factura C", ticket: "Ticket", receipt: "Recibo", deposit_receipt: "Recibo de seña", credit_note: "Nota de crédito" };
const METHODS = { cash: "Efectivo", transfer: "Transferencia", mercadopago: "Mercado Pago", debit: "Débito", credit: "Crédito", check: "Cheque", other: "Otro" };
const MOV_KINDS = { sale: "Venta", deposit: "Seña", refund: "Devolución", income: "Ingreso", expense: "Egreso", withdrawal: "Retiro", reversal: "Reversión" };
const docLabel = (d) => `${DOC_TYPES[d.type]} ${fmt.docNo(d.pos, d.number)}`;

function openSession(registerId, opening) {
  need("pos.operate");
  opening = r2(opening);
  if (!(opening >= 0)) throw new Error("Fondo inicial inválido");
  if (S.sessions.some((s) => s.registerId === registerId && s.status === "open")) throw new Error("Ya existe una caja abierta para esta registradora");
  return db.insert("sessions", { registerId, status: "open", openedBy: currentUser().id, openedAt: nowISO(), opening, closedBy: null, closedAt: null });
}
const openSessionOf = () => S.sessions.find((s) => s.status === "open" && (can("pos.supervise") || s.openedBy === currentUser().id)) ?? S.sessions.find((s) => s.status === "open");

function sessionBalance(sid) {
  const s = db.get("sessions", sid); const mv = S.movements.filter((m) => m.sessionId === sid);
  const byMethod = {}; mv.forEach((m) => byMethod[m.method] = r2((byMethod[m.method] ?? 0) + m.amount));
  return {
    cash: r2(s.opening + (byMethod.cash ?? 0)), byMethod, count: mv.length,
    gross: r2(mv.filter((m) => m.kind === "sale" || m.kind === "deposit").reduce((a, m) => a + m.amount, 0)),
    electronic: r2(Object.entries(byMethod).filter(([k]) => k !== "cash").reduce((a, [, v]) => a + v, 0)),
  };
}

function calcTotals(type, items) {
  let sub = 0, tax = 0;
  for (const it of items) {
    const line = r2(it.qty * it.price), rate = type === "invoice_c" ? 0 : Number(it.tax ?? 21);
    sub += line; tax += type === "invoice_a" ? r2(line * rate / 100) : r2(line - line / (1 + rate / 100));
  }
  sub = r2(sub); tax = r2(tax);
  const total = type === "invoice_a" ? r2(sub + tax) : sub;
  return { net: type === "invoice_a" ? sub : r2(sub - tax), tax, total };
}

function nextNumber(type, pos) { const k = `${type}:${pos}`; S.seq[k] = (S.seq[k] ?? 0) + 1; return S.seq[k]; }

function issueDocument({ sessionId, type, clientId = null, items, payments, depositId = null, customerName = "", customerTaxId = "" }) {
  need("pos.operate");
  const s = db.get("sessions", sessionId);
  if (!s || s.status !== "open") throw new Error("La caja no está abierta");
  if (type === "credit_note") throw new Error("Use 'Nota de crédito' desde el comprobante");
  items = (items ?? []).filter((i) => i.desc && i.qty > 0);
  if (!items.length) throw new Error("El comprobante requiere al menos un ítem válido");
  if (items.some((i) => !(i.price >= 0))) throw new Error("Precio inválido");
  if (type === "invoice_a" && !clientId) throw new Error("La Factura A requiere un cliente responsable inscripto");
  const tot = calcTotals(type, items);
  if (tot.total <= 0) throw new Error("El total debe ser mayor a cero");
  let due = tot.total, dep = null;
  if (depositId) {
    dep = db.get("documents", depositId);
    if (!dep || dep.type !== "deposit_receipt" || dep.status !== "issued") throw new Error("Seña inexistente o anulada");
    if (S.documents.some((d) => d.relatedId === dep.id && d.status === "issued")) throw new Error("La seña ya fue aplicada a otro comprobante");
    if (dep.total > tot.total) throw new Error("La seña supera el total del comprobante");
    due = r2(tot.total - dep.total);
  }
  payments = (payments ?? []).filter((p) => Number(p.amount) > 0).map((p) => ({ ...p, amount: r2(p.amount) }));
  const paid = r2(payments.reduce((a, p) => a + p.amount, 0));
  if (paid !== due) throw new Error(`Pagos (${fmt.money(paid, true)}) no coinciden con el saldo a cobrar (${fmt.money(due, true)})`);

  const reg = db.get("registers", s.registerId);
  const u = currentUser();
  const doc = db.insert("documents", {
    sessionId, type, pos: reg.pos, number: nextNumber(type, reg.pos), clientId,
    customerName: clientId ? clientName(clientId) : (customerName || "Consumidor final"), customerTaxId: clientId ? db.get("clients", clientId).taxId : customerTaxId,
    items: items.map((i) => ({ desc: i.desc, qty: Number(i.qty), price: r2(i.price), tax: type === "invoice_c" ? 0 : Number(i.tax ?? 21) })),
    ...tot, relatedId: dep?.id ?? null, depositApplied: dep?.total ?? 0, status: "issued", issuedBy: u.id, sellerId: u.id, issuedAt: nowISO(), cae: null,
  }, { amount: tot.total });
  for (const p of payments) {
    db.insert("movements", { sessionId, kind: type === "deposit_receipt" ? "deposit" : "sale", documentId: doc.id, method: p.method, amount: p.amount, reference: p.reference || "", by: u.id, at: nowISO() });
  }
  return doc;
}

function voidDocument(docId, reason) {
  need("pos.void");
  const d = db.get("documents", docId);
  if (!d || d.status !== "issued") throw new Error("Comprobante inexistente o ya anulado");
  if (["invoice_a", "invoice_b", "invoice_c"].includes(d.type)) throw new Error("Las facturas no se anulan: emita una nota de crédito");
  if (!reason || reason.trim().length < 5) throw new Error("Indique el motivo de anulación (mín. 5 caracteres)");
  if (S.documents.some((x) => x.relatedId === d.id && x.status === "issued")) throw new Error("La seña ya fue aplicada; anule primero el comprobante que la usa");
  const s = openSessionOf(); if (!s) throw new Error("Se requiere una caja abierta para registrar la reversión");
  for (const m of S.movements.filter((m) => m.documentId === d.id && !m.reversesId && !S.movements.some((x) => x.reversesId === m.id))) {
    db.insert("movements", { sessionId: s.id, kind: "reversal", documentId: d.id, method: m.method, amount: -m.amount, reference: "Anulación: " + reason, reversesId: m.id, by: currentUser().id, at: nowISO() });
  }
  db.update("documents", d.id, { status: "voided", voidedBy: currentUser().id, voidedAt: nowISO(), voidReason: reason });
}

function issueCreditNote(invoiceId, method, reason) {
  need("pos.void");
  const inv = db.get("documents", invoiceId);
  if (!inv || !["invoice_a", "invoice_b", "invoice_c"].includes(inv.type) || inv.status !== "issued") throw new Error("Factura inválida");
  if (S.documents.some((d) => d.type === "credit_note" && d.relatedId === inv.id && d.status === "issued")) throw new Error("La factura ya tiene nota de crédito");
  if (!reason || reason.trim().length < 5) throw new Error("Indique el motivo");
  const s = openSessionOf(); if (!s) throw new Error("Se requiere una caja abierta");
  const reg = db.get("registers", s.registerId);
  const refund = r2(inv.total - (inv.depositApplied ?? 0));
  const nc = db.insert("documents", {
    sessionId: s.id, type: "credit_note", pos: reg.pos, number: nextNumber("credit_note", reg.pos), clientId: inv.clientId,
    customerName: inv.customerName, customerTaxId: inv.customerTaxId, items: inv.items, net: inv.net, tax: inv.tax, total: inv.total,
    relatedId: inv.id, status: "issued", issuedBy: currentUser().id, sellerId: inv.sellerId, issuedAt: nowISO(), cae: null, reason,
  }, { amount: -inv.total });
  if (refund > 0) db.insert("movements", { sessionId: s.id, kind: "refund", documentId: nc.id, method, amount: -refund, reference: "NC " + fmt.docNo(nc.pos, nc.number), by: currentUser().id, at: nowISO() });
  return nc;
}

function registerMovement(sessionId, kind, method, amount, reference) {
  if (!["income", "expense", "withdrawal"].includes(kind)) throw new Error("Tipo inválido");
  need(kind === "income" ? "pos.operate" : "pos.supervise");
  amount = r2(amount);
  if (!(amount > 0)) throw new Error("El importe debe ser positivo");
  if (!reference || reference.trim().length < 3) throw new Error("Indique concepto / referencia");
  const s = db.get("sessions", sessionId); if (!s || s.status !== "open") throw new Error("La caja no está abierta");
  if (kind !== "income" && method === "cash" && amount > sessionBalance(sessionId).cash) throw new Error("No hay efectivo suficiente en caja");
  return db.insert("movements", { sessionId, kind, documentId: null, method, amount: kind === "income" ? amount : -amount, reference, by: currentUser().id, at: nowISO() });
}

function closeSession(sessionId, counted, notes) {
  need("pos.operate");
  const s = db.get("sessions", sessionId); if (!s || s.status !== "open") throw new Error("La caja no está abierta");
  counted = r2(counted); if (!(counted >= 0)) throw new Error("Arqueo inválido");
  const b = sessionBalance(sessionId);
  const diff = r2(counted - b.cash);
  if (diff !== 0 && (!notes || notes.trim().length < 5)) throw new Error(`Diferencia de arqueo de ${fmt.money(diff, true)}: justifíquela en observaciones`);
  db.update("sessions", s.id, { status: "closed", closedBy: currentUser().id, closedAt: nowISO(), expected: b.cash, counted, difference: diff, totalsByMethod: b.byMethod, notes: notes || "" });
  if (diff !== 0) notify({ kind: "cash", title: `Cierre de caja con diferencia de ${fmt.money(diff, true)}`, body: `${userName(s.closedBy)} · ${notes}`, severity: "warning", telegram: true, link: "#/caja" });
  return db.get("sessions", s.id);
}

/* ───────── CONTRATOS ───────── */
const CONTRACT_STATUS = { draft: ["", "Borrador"], pending_signature: ["warn", "Pendiente de firma"], signed: ["ok", "Firmado"], expired: ["crit", "Vencido"], terminated: ["crit", "Rescindido"] };
function createContract(data) {
  need("docs.write");
  if (!data.clientId || !data.title || data.title.length < 3) throw new Error("Complete cliente y título");
  if (data.startDate && data.endDate && data.endDate < data.startDate) throw new Error("La fecha fin es anterior al inicio");
  const n = S.contracts.filter((c) => c.code.startsWith(`CTR-${new Date().getFullYear()}`)).length + 1;
  return db.insert("contracts", { code: `CTR-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`, status: "draft", noticeDays: [30, 15, 7], subscriptionId: activeSub(data.clientId)?.id ?? null, ...data, value: data.value ? r2(data.value) : null });
}
function updateContract(id, patch) {
  need("docs.write");
  const c = db.get("contracts", id);
  if (c.status === "signed") {
    const allowed = ["endDate", "autoRenew", "status"];
    if (Object.keys(patch).some((k) => !allowed.includes(k))) throw new Error("Contrato firmado: sólo puede renovar su fecha fin, vencerse o rescindirse");
  }
  return db.update("contracts", id, patch);
}
async function addContractVersion(contractId, file, note) {
  need("docs.write");
  const c = db.get("contracts", contractId);
  if (!["draft", "pending_signature"].includes(c.status)) throw new Error("Sólo se versionan contratos en borrador o pendientes de firma");
  if (!file || file.type !== "application/pdf") throw new Error("Seleccione un archivo PDF");
  if (file.size > 25 * 1024 * 1024) throw new Error("Máximo 25 MB");
  const buf = await file.arrayBuffer();
  const hash = await sha256File(buf);
  const versionNo = S.contractVersions.filter((v) => v.contractId === contractId).length + 1;
  const v = db.insert("contractVersions", { contractId, versionNo, fileName: file.name, size: file.size, sha256: hash, note: note || "", by: currentUser().id, at: nowISO() });
  await Files.put(v.id, new Blob([buf], { type: "application/pdf" }));
  db.update("contracts", contractId, { currentVersionId: v.id });
  return v;
}
async function verifyContractFile(vid) {
  const v = db.get("contractVersions", vid); const blob = await Files.get(vid);
  if (!blob) return { ok: false, reason: "Archivo no encontrado en este navegador" };
  const h = await sha256File(await blob.arrayBuffer());
  return h === v.sha256 ? { ok: true, hash: h } : { ok: false, reason: "La huella no coincide: el archivo fue alterado" };
}
async function downloadVersion(vid) {
  const v = db.get("contractVersions", vid); const blob = await Files.get(vid);
  if (!blob) throw new Error("El PDF no está en este navegador (los archivos se guardan localmente)");
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = v.fileName || `contrato-v${v.versionNo}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  audit("DOWNLOAD", "contractVersions", vid, null, { fileName: v.fileName });
  save();
}
function signContract(id, signedBy) {
  need("docs.sign");
  const c = db.get("contracts", id);
  if (!c.currentVersionId) throw new Error("El contrato no tiene PDF cargado");
  if (!["draft", "pending_signature"].includes(c.status)) throw new Error("Estado inválido para firmar");
  if (!c.startDate || !c.endDate) throw new Error("Defina fechas de inicio y fin");
  if (!signedBy || signedBy.length < 3) throw new Error("Indique quién firma");
  return db.update("contracts", id, { status: "signed", signedAt: nowISO(), signedBy });
}
function processExpirations() {
  const today = todayISO();
  for (const c of S.contracts.filter((c) => c.status === "signed" && c.endDate)) {
    if (c.endDate < today) {
      if (c.autoRenew) { db.update("contracts", c.id, { endDate: addDays(c.endDate, 365) }, { silent: false }); notify({ kind: "contract", title: `Contrato ${c.code} renovado automáticamente`, body: clientName(c.clientId), link: "#/documentos" }); }
      else { db.update("contracts", c.id, { status: "expired" }); notify({ kind: "contract", title: `Contrato ${c.code} vencido`, body: clientName(c.clientId), severity: "critical", telegram: true, link: "#/documentos", dedupe: `exp:${c.id}` }); }
      continue;
    }
    const d = fmt.daysUntil(c.endDate);
    const th = (c.noticeDays ?? [30, 15, 7]).filter((x) => d <= x).sort((a, b) => a - b)[0];
    if (th != null) notify({ kind: "contract", title: `Contrato ${c.code} vence en ${d} días`, body: `${clientName(c.clientId)} · ${fmt.date(c.endDate)}`, severity: d <= 7 ? "critical" : "warning", telegram: true, link: "#/documentos", dedupe: `ctr:${c.id}:${c.endDate}:${th}` });
  }
}

/* ───────── CRM / SUSCRIPCIONES ───────── */
function saveClient(data, id = null) {
  need("crm.write");
  if (!data.legalName || data.legalName.length < 2) throw new Error("Razón social requerida");
  if (data.taxId && !/^\d{2}-?\d{8}-?\d$/.test(data.taxId)) throw new Error("CUIT inválido (formato 30-12345678-9)");
  if (data.taxId && S.clients.some((c) => c.taxId === data.taxId && c.id !== id)) throw new Error("Ya existe un cliente con ese CUIT");
  return id ? db.update("clients", id, data) : db.insert("clients", { status: "lead", ownerId: currentUser().id, ...data });
}
function addInteraction(clientId, kind, subject, body) {
  if (!can("crm.write") && !isPortalUser()) throw new Error("Permiso denegado: crm.write");
  if (!subject || subject.length < 2) throw new Error("Asunto requerido");
  return db.insert("interactions", { clientId, userId: currentUser().id, kind, subject, body, at: nowISO() });
}
function createSubscription(clientId, planId, priceOverride = null) {
  need("billing.manage");
  if (activeSub(clientId)) throw new Error("El cliente ya tiene una suscripción activa");
  const sub = db.insert("subscriptions", { clientId, planId, status: "active", priceOverride, startedAt: todayISO() });
  db.insert("subChanges", { subscriptionId: sub.id, fromPlanId: null, toPlanId: planId, kind: "create", prorated: 0, effective: todayISO(), by: currentUser().id });
  const c = db.get("clients", clientId); if (c.status === "lead") db.update("clients", clientId, { status: "active" });
  return sub;
}
function prorate(sub, newPlanId, date = new Date()) {
  const np = db.get("plans", newPlanId);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const remaining = daysInMonth - date.getDate() + 1;
  return r2((np.price - subPrice(sub)) * remaining / daysInMonth);
}
function changePlan(subId, newPlanId) {
  need("billing.manage");
  const sub = db.get("subscriptions", subId); const op = planOf(sub), np = db.get("plans", newPlanId);
  if (!np || !np.active) throw new Error("Plan destino inválido");
  if (np.id === op.id) throw new Error("La suscripción ya está en ese plan");
  const amount = prorate(sub, newPlanId);
  const ch = db.insert("subChanges", { subscriptionId: sub.id, fromPlanId: op.id, toPlanId: np.id, kind: np.tier > op.tier ? "upgrade" : "downgrade", prorated: amount, effective: todayISO(), by: currentUser().id });
  db.update("subscriptions", sub.id, { planId: np.id, priceOverride: null });
  addInteraction(sub.clientId, "note", `${ch.kind === "upgrade" ? "Upgrade" : "Downgrade"} a ${np.name}`, `Prorrateo del mes: ${fmt.money(amount, true)}`);
  // cierra tickets de solicitud de upgrade pendientes
  S.tickets.filter((t) => t.clientId === sub.clientId && t.category === "upgrade" && !["resolved", "closed"].includes(t.status)).forEach((t) => db.update("tickets", t.id, { status: "resolved", resolvedAt: nowISO() }));
  return ch;
}
function cancelSubscription(subId) {
  need("billing.manage");
  db.update("subscriptions", subId, { status: "canceled", canceledAt: nowISO() });
}
function requestUpgrade(planId, comment) {
  const u = currentUser();
  if (u.role !== "client_admin") throw new Error("Sólo el administrador de tu empresa puede solicitar cambios de plan");
  const p = db.get("plans", planId);
  if (S.tickets.some((t) => t.clientId === u.clientId && t.category === "upgrade" && !["resolved", "closed"].includes(t.status))) throw new Error("Ya hay una solicitud de cambio de plan en curso");
  const t = createTicket({ clientId: u.clientId, subject: `Solicitud de upgrade a ${p.name}`, description: comment || "Solicitud generada desde el portal", category: "upgrade", priority: "high" });
  addInteraction(u.clientId, "ticket", `Solicitud de upgrade: ${p.name}`, comment || "");
  return t;
}

/* ───────── RRHH · COMISIONES ───────── */
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
function salesOf(userId, period) {
  return r2(S.documents.filter((d) => d.sellerId === userId && d.status === "issued" && d.type !== "deposit_receipt" && d.issuedAt.slice(0, 7) === period)
    .reduce((a, d) => a + (d.type === "credit_note" ? -d.total : d.total), 0));
}
function calcCommissions(period = monthKey()) {
  need("hr.manage");
  const out = [];
  for (const e of S.employees.filter((e) => e.active && e.schemeId && e.userId)) {
    const sch = db.get("schemes", e.schemeId); const goal = S.goals.find((g) => g.employeeId === e.id && g.period === period);
    const sales = salesOf(e.userId, period);
    const pct = goal ? r2(sales / goal.target * 100) : null;
    const tier = [...sch.tiers].sort((a, b) => b.from - a.from).find((t) => (pct ?? 0) >= t.from);
    const rate = tier?.rate ?? sch.baseRate;
    const amount = r2(sales * rate / 100);
    const ex = S.commissions.find((c) => c.employeeId === e.id && c.period === period);
    if (ex && ex.status !== "pending") { out.push(ex); continue; }
    const data = { employeeId: e.id, period, sales, goal: goal?.target ?? null, pct, rate, amount, status: "pending", calculatedAt: nowISO() };
    out.push(ex ? db.update("commissions", ex.id, data) : db.insert("commissions", data));
  }
  return out;
}
function setCommissionStatus(id, status) {
  need("commissions.approve");
  const c = db.get("commissions", id);
  if (status === "approved" && c.status !== "pending") throw new Error("Sólo se aprueban comisiones pendientes");
  if (status === "paid" && c.status !== "approved") throw new Error("Primero debe aprobarse");
  db.update("commissions", id, { status, [status + "At"]: nowISO(), [status + "By"]: currentUser().id });
}
function saveEmployee(data, id = null) {
  need("hr.manage");
  if (!data.name || data.name.length < 2) throw new Error("Nombre requerido");
  if (id) return db.update("employees", id, data);
  let userId = null;
  if (data.email) {
    if (S.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) throw new Error("Ya existe un usuario con ese email");
    if (!can("settings.manage")) throw new Error("Crear accesos requiere settings.manage");
    userId = db.insert("users", { name: data.name, email: data.email, role: data.role || "employee", clientId: null, overrides: {}, active: true }).id;
  }
  const { role, email, ...rest } = data;
  return db.insert("employees", { ...rest, userId, active: true });
}
function setGoal(employeeId, period, target) {
  need("hr.manage");
  target = r2(target); if (!(target > 0)) throw new Error("Meta inválida");
  const g = S.goals.find((g) => g.employeeId === employeeId && g.period === period);
  return g ? db.update("goals", g.id, { target }) : db.insert("goals", { employeeId, period, target });
}

/* ───────── CMS ───────── */
function savePage(data, id = null) {
  need("cms.write");
  if (!data.title) throw new Error("Título requerido");
  if (!/^([a-z0-9]+(-[a-z0-9]+)*)?$/.test(data.slug)) throw new Error("Slug inválido: minúsculas, números y guiones");
  if (S.pages.some((p) => p.slug === data.slug && p.id !== id)) throw new Error("Ya existe una página con ese slug");
  return id ? db.update("pages", id, { ...data, status: db.get("pages", id).status === "published" ? "published" : "draft", dirty: true })
            : db.insert("pages", { siteId: "site1", status: "draft", version: 0, publishedAt: null, ...data });
}
function publishPage(id) {
  need("cms.publish");
  const p = db.get("pages", id);
  const v = (p.version ?? 0) + 1;
  db.insert("pageVersions", { pageId: id, version: v, title: p.title, blocks: structuredClone(p.blocks), by: currentUser().id, at: nowISO() });
  return db.update("pages", id, { status: "published", version: v, publishedAt: nowISO(), dirty: false });
}
function bumpMetric(pageId, field) {
  const d = todayISO(); S.metrics[pageId] = S.metrics[pageId] || {}; S.metrics[pageId][d] = S.metrics[pageId][d] || { views: 0, leads: 0 };
  S.metrics[pageId][d][field]++; save();
}
function pageStats(pageId, days = 30) {
  const m = S.metrics[pageId] ?? {}; let views = 0, leads = 0;
  for (let i = 0; i < days; i++) { const x = m[addDays(todayISO(), -i)]; if (x) { views += x.views; leads += x.leads; } }
  return { views, leads };
}
function submitLead(pageId, data) {
  const p = db.get("pages", pageId);
  if (!p || p.status !== "published") throw new Error("Página no disponible");
  if (!data.name || data.name.trim().length < 2) throw new Error("Ingresá tu nombre");
  if (!data.email && !data.phone) throw new Error("Dejanos un email o teléfono");
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) throw new Error("Email inválido");
  if (data.email && S.leads.some((l) => l.email === data.email && Date.now() - new Date(l.at) < 120000)) throw new Error("Ya recibimos tu solicitud, ¡gracias!");
  const l = db.insert("leads", { pageId, ...data, status: "new", at: nowISO() });
  bumpMetric(pageId, "leads");
  notify({ kind: "lead", title: `Nuevo lead: ${data.name}`, body: `${p.title}${data.company ? " · " + data.company : ""}`, link: "#/cms", telegram: true });
  return l;
}
function convertLead(leadId) {
  need("crm.write");
  const l = db.get("leads", leadId);
  if (l.clientId) throw new Error("El lead ya fue convertido");
  const c = saveClient({ legalName: l.company || l.name, tradeName: l.company || l.name, email: l.email, phone: l.phone, city: "", industry: "", taxId: "", taxCondition: "CF", status: "lead" });
  addInteraction(c.id, "note", "Alta desde lead web", `${db.get("pages", l.pageId)?.title ?? ""}: ${l.message || ""}`);
  db.update("leads", leadId, { status: "converted", clientId: c.id });
  return c;
}
function deploySite(siteId) {
  need("cms.publish");
  if (S.deployments.some((d) => d.siteId === siteId && ["queued", "building"].includes(d.status))) throw new Error("Ya hay un despliegue en curso");
  const commit = SHA.hex(nowISO() + Math.random()).slice(0, 7);
  const d = db.insert("deployments", { siteId, status: "queued", commit, durationMs: null, at: nowISO(), by: currentUser().id });
  const t0 = Date.now();
  setTimeout(() => { db.update("deployments", d.id, { status: "building" }, { silent: true }); rerenderIf(["cms"]); }, 800);
  setTimeout(() => {
    const ok = Math.random() > 0.12;
    db.update("deployments", d.id, { status: ok ? "ready" : "error", durationMs: Date.now() - t0 + Math.round(Math.random() * 30000) });
    notify({ kind: "deploy", title: ok ? `Sitio desplegado (${commit})` : `Falló el despliegue ${commit}`, severity: ok ? "info" : "warning", telegram: !ok, link: "#/cms" });
    toast(ok ? "Despliegue publicado" : "El despliegue falló: revise el log", ok ? "ok" : "err");
    rerenderIf(["cms"]);
  }, 4200);
  return d;
}

/* ───────── TICKETS ───────── */
const SLA_HOURS = { urgent: 4, high: 24, normal: 72, low: 120 };
function createTicket({ clientId, subject, description, category = "general", priority = "normal" }) {
  const u = currentUser();
  if (isPortalUser(u)) { if (u.clientId !== clientId) throw new Error("No puede abrir tickets para otra empresa"); }
  else need("tickets.manage");
  if (!subject || subject.trim().length < 3) throw new Error("Asunto demasiado corto");
  if (!description || description.trim().length < 10) throw new Error("Describa el problema con más detalle (mín. 10 caracteres)");
  const number = (S.tickets.reduce((a, t) => Math.max(a, t.number), 0)) + 1;
  const t = db.insert("tickets", { number, clientId, subject: subject.trim(), description: description.trim(), category, priority, status: "open", openedBy: u.id, assignedTo: null, at: nowISO(), slaDue: new Date(Date.now() + SLA_HOURS[priority] * 3600e3).toISOString() });
  notify({ kind: "ticket", title: `Ticket #${number} · ${clientName(clientId)}`, body: subject, severity: priority === "urgent" ? "critical" : priority === "high" ? "warning" : "info", telegram: true, link: "#/soporte" });
  return t;
}
function addTicketMessage(ticketId, body, internal = false) {
  const u = currentUser(); const t = db.get("tickets", ticketId);
  if (isPortalUser(u)) { if (t.clientId !== u.clientId) throw new Error("Sin acceso"); internal = false; if (t.status === "closed") throw new Error("El ticket está cerrado"); }
  else need("tickets.manage");
  if (!body || !body.trim()) throw new Error("Escriba un mensaje");
  const m = db.insert("ticketMessages", { ticketId, authorId: u.id, body: body.trim(), internal, at: nowISO() });
  if (isPortalUser(u) && t.status === "waiting_client") db.update("tickets", t.id, { status: "open" });
  if (!isPortalUser(u) && !internal && t.status === "open") db.update("tickets", t.id, { status: "in_progress", assignedTo: t.assignedTo ?? u.id });
  return m;
}
function setTicketStatus(id, status) {
  need("tickets.manage");
  db.update("tickets", id, { status, ...(status === "resolved" ? { resolvedAt: nowISO() } : {}) });
}

/* ───────── USUARIOS / CONFIGURACIÓN ───────── */
function saveUser(data, id = null) {
  need("settings.manage");
  if (!data.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email || "")) throw new Error("Nombre y email válidos requeridos");
  if (S.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase() && u.id !== id)) throw new Error("Email ya registrado");
  if (["client_admin", "client_user"].includes(data.role) !== !!data.clientId) throw new Error("Los roles de cliente requieren empresa (y sólo ellos)");
  if (id && db.get("users", id).role === "owner" && data.role !== "owner" && S.users.filter((u) => u.role === "owner" && u.active).length === 1) throw new Error("Debe quedar al menos un Dueño");
  return id ? db.update("users", id, data) : db.insert("users", { overrides: {}, active: true, ...data });
}
function toggleRolePerm(role, perm) {
  need("settings.manage");
  if (role === "owner") throw new Error("Los permisos del Dueño no se modifican");
  const old = [...S.rolePerms[role]];
  S.rolePerms[role] = old.includes(perm) ? old.filter((p) => p !== perm) : [...old, perm];
  audit("UPDATE", "rolePerms", role, { perms: old }, { perms: S.rolePerms[role] }); save();
}
function setOverride(userId, perm, value) {
  need("settings.manage");
  const u = db.get("users", userId); const ov = { ...(u.overrides ?? {}) };
  if (value === null) delete ov[perm]; else ov[perm] = value;
  db.update("users", userId, { overrides: ov });
}

/* ───────── KPIs ───────── */
function kpis() {
  const active = S.subscriptions.filter((s) => s.status === "active");
  const mrr = active.reduce((a, s) => a + subPrice(s), 0);
  const ai = active.filter((s) => planOf(s)?.ai).length;
  const month = monthKey();
  const sales = r2(S.documents.filter((d) => d.status === "issued" && d.type !== "deposit_receipt" && d.issuedAt.slice(0, 7) === month).reduce((a, d) => a + (d.type === "credit_note" ? -d.total : d.total), 0));
  const res = S.resources.filter((r) => r.active);
  return {
    mrr, activeClients: S.clients.filter((c) => c.status === "active").length, aiShare: active.length ? r2(ai / active.length * 100) : 0,
    sales, openAlerts: S.alerts.filter((a) => a.status !== "resolved").length,
    openTickets: S.tickets.filter((t) => ["open", "in_progress", "waiting_client"].includes(t.status)).length,
    expiring: S.contracts.filter((c) => c.status === "signed" && c.endDate && fmt.daysUntil(c.endDate) <= 30).length,
    leads7: S.leads.filter((l) => Date.now() - new Date(l.at) < 7 * 864e5).length,
    resTotal: res.length, resOk: res.filter((r) => r.status === "operational").length,
    resCount: res.reduce((a, r) => (a[r.status] = (a[r.status] ?? 0) + 1, a), {}),
  };
}
</script>
