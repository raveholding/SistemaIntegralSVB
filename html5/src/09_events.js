<script>
/* ════════════════════ ACCIONES (delegación de eventos) ════════════════════ */
const val = (id) => $("#" + id)?.value ?? "";
const pinHash = (userId, pin) => SHA.hex("svb-pin|" + userId + "|" + String(pin ?? ""));
function doLogin(id) { S.session.userId = id; audit("LOGIN", "users", id, null, { role: currentUser().role }); saveNow(); UI.search = ""; UI.sale = null; location.hash = isPortalUser() ? "" : "#/dashboard"; processExpirations(); render(); }
const A = {
  /* sesión */
  login: (el) => { const lu = db.get("users", el.dataset.id); if (lu?.pinHash) return openModal(`Ingresar como ${esc(lu.name)}`, field("PIN", `<input class="in" name="pin" type="password" inputmode="numeric" autocomplete="current-password">`), { submitLabel: "Ingresar", submit: (f) => { if (pinHash(lu.id, formData(f).pin) !== lu.pinHash) throw new Error("PIN incorrecto"); setTimeout(() => doLogin(lu.id), 0); return null; } }); doLogin(el.dataset.id); },
  "data-fresh": () => openModal("Empezar con mis datos", `<p class="small muted mb">Se borran <b>todos</b> los datos de este navegador (clientes, contratos, ventas, demo). Se conservan los planes, roles, reglas de alertas y la caja. Exportá un respaldo antes si cargaste algo.</p>
    <div class="fgrid">${field("Nombre de tu empresa *", `<input class="in" name="company" value="Vincular Business">`)}${field("CUIT", `<input class="in" name="cuit" placeholder="20-00000000-0">`)}
    ${field("Tu nombre *", `<input class="in" name="ownerName">`)}${field("Tu email *", `<input class="in" name="ownerEmail" type="email">`)}
    ${field("PIN para tu usuario (recomendado)", `<input class="in" name="pin" type="password" inputmode="numeric" autocomplete="new-password" placeholder="4 a 8 dígitos">`)}</div>`, { submitLabel: "Borrar demo y empezar", submit: (f) => {
      const d = formData(f); d.company = (d.company || "").trim(); d.ownerName = (d.ownerName || "").trim(); d.ownerEmail = (d.ownerEmail || "").trim();
      if (!d.company || !d.ownerName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.ownerEmail)) throw new Error("Completá empresa, tu nombre y un email válido");
      if (d.pin && !/^\d{4,8}$/.test(d.pin)) throw new Error("El PIN debe tener de 4 a 8 dígitos");
      try { Files.clear().catch(() => { }); } catch { } UI.sale = null; UI.search = "";
      S = blankState(d); if (d.pin) S.users[0].pinHash = pinHash("u1", d.pin);
      audit("SYSTEM_INIT", "system", null, null, { company: S.settings.company, fresh: true }); saveNow(); startMonitor(); location.hash = "";
      return "Listo: sistema vacío para " + S.settings.company + ". Ingresá con tu usuario."; } }),
  logout: () => { audit("LOGOUT", "users", currentUser()?.id, null, null); S.session.userId = null; UI.notifOpen = false; saveNow(); render(); },
  menu: () => $("#side")?.classList.toggle("open"),
  notif: () => { UI.notifOpen = !UI.notifOpen; render(); },
  "notif-read": () => { S.notifications.forEach((n) => n.read = true); save(); render(); },
  "notif-go": () => { S.notifications.forEach((n) => n.read = true); UI.notifOpen = false; save(); setTimeout(render, 0); },
  "search-clear": () => { UI.search = ""; render(); },
  "modal-close": closeModal,
  "modal-bg": (el, ev) => { if (ev.target === el) closeModal(); },

  /* monitor */
  metric: (el) => { UI.monitorMetric = el.dataset.id; render(); },
  ack: (el) => run(() => { need("monitor.manage"); db.update("alerts", el.dataset.id, { status: "acknowledged", ackBy: currentUser().id, ackAt: nowISO() }); }, "Alerta tomada"),
  "res-pause": (el) => run(() => { need("monitor.manage"); const r = db.get("resources", el.dataset.id); db.update("resources", r.id, { paused: !r.paused }); if (r.paused) toast(`${r.name} dejó de enviar heartbeat: en ${r.missedBeats * S.settings.heartbeatSec} s se marcará caído`, "warn"); }),
  "res-stress": (el) => run(() => { need("monitor.manage"); const r = db.get("resources", el.dataset.id); db.update("resources", r.id, { stress: !r.stress }); }),
  "res-maint": (el) => run(() => { need("monitor.manage"); const r = db.get("resources", el.dataset.id); setStatus(r, r.status === "maintenance" ? "unknown" : "maintenance"); db.update("resources", r.id, { status: r.status }); }),
  "res-new": () => openModal("Nuevo recurso monitoreado", `<div class="fgrid">
      ${field("Nombre técnico *", `<input class="in" name="name" placeholder="cliente-prod-db">`)}${field("Nombre para el cliente", `<input class="in" name="publicName" placeholder="Base de datos">`)}
      ${field("Tipo", `<select class="in" name="kind">${opts([["server", "Servidor"], ["database", "Base de datos"], ["supabase_project", "Proyecto Supabase"], ["api", "API"], ["website", "Sitio web"], ["worker", "Worker"]])}</select>`)}
      ${field("Cliente", `<select class="in" name="clientId">${opts([["", "Interno"], ...S.clients.map((c) => [c.id, c.tradeName || c.legalName])])}</select>`)}
      ${field("Endpoint / host", `<input class="in" name="endpoint">`)}${field("Región", `<input class="in" name="region" value="sa-east-1">`)}</div>
      <p class="xs subtle">En producción: instalar el agente (services/monitor-agent) con el token que genera el sistema.</p>`, {
    submit: (f) => { need("monitor.manage"); const d = formData(f); if (!/^[a-z0-9-]{3,}$/.test(d.name)) throw new Error("Nombre técnico: minúsculas, números y guiones");
      db.insert("resources", { ...d, clientId: d.clientId || null, base: { cpu: 20 + Math.random() * 20, mem: 30 + Math.random() * 20, lat: 60 + Math.random() * 120 }, status: "unknown", statusSince: nowISO(), lastBeat: null, active: true, paused: false, stress: false, missedBeats: 3, uptimeDownMs: 0 });
      return "Recurso agregado: empieza a latir en segundos"; } }),
  rules: () => openModal("Reglas de alerta", `<p class="small muted mb">Se dispara cuando N muestras consecutivas superan el umbral. Crítica ⇒ estado Caído; Advertencia ⇒ Degradado.</p>
      ${S.alertRules.map((r) => `<div class="row" style="margin-bottom:8px"><input type="checkbox" name="on:${r.id}" ${r.active ? "checked" : ""}><b style="width:80px">${METRIC_LABEL[r.metric]}</b><span>${r.op}</span>
        <input class="in num" style="width:100px" type="number" name="th:${r.id}" value="${r.threshold}"><span class="small muted">durante</span><input class="in num" style="width:70px" type="number" min="1" max="10" name="n:${r.id}" value="${r.samples}">
        <select class="in" style="width:auto" name="sev:${r.id}">${opts([["warning", "Advertencia"], ["critical", "Crítica"]], r.severity)}</select></div>`).join("")}`, {
    submit: (f) => { need("monitor.manage"); const d = formData(f);
      S.alertRules.forEach((r) => db.update("alertRules", r.id, { active: !!d["on:" + r.id], threshold: Number(d["th:" + r.id]), samples: clamp(Number(d["n:" + r.id]), 1, 10), severity: d["sev:" + r.id] }));
      return "Reglas actualizadas"; } }),

  /* contratos */
  "ctr-new": () => openModal("Nuevo contrato", `<div class="fgrid">
      ${field("Cliente", `<select class="in" name="clientId">${opts(S.clients.map((c) => [c.id, c.tradeName || c.legalName]))}</select>`)}${field("Título *", `<input class="in" name="title" placeholder="Servicio · Pro + IA">`)}
      ${field("Inicio", `<input class="in" type="date" name="startDate" value="${todayISO()}">`)}${field("Fin", `<input class="in" type="date" name="endDate" value="${addDays(todayISO(), 365)}">`)}
      ${field("Valor total (ARS)", `<input class="in" type="number" min="0" step="0.01" name="value">`)}
      <label class="row small muted" style="margin-top:22px"><input type="checkbox" name="autoRenew"> Renovación automática anual</label></div>`, {
    submit: (f) => { const d = formData(f); const c = createContract({ clientId: d.clientId, title: d.title, startDate: d.startDate || null, endDate: d.endDate || null, value: d.value ? Number(d.value) : null, autoRenew: !!d.autoRenew }); setTimeout(() => contractModal(c.id), 50); return `Borrador ${c.code} creado: subí el PDF`; } }),
  "ctr-open": (el) => contractModal(el.dataset.id),
  "ctr-dates": (el) => { try { const s = val("c-start"), e = val("c-end"); if (s && e && e < s) throw new Error("La fecha fin es anterior al inicio"); updateContract(el.dataset.id, { startDate: s || null, endDate: e || null }); toast("Fechas guardadas"); contractModal(el.dataset.id); render(); } catch (e) { toast(e.message, "err"); } },
  "ctr-upload": async (el) => { el.disabled = true; try { const v = await addContractVersion(el.dataset.id, $("#c-file").files[0], val("c-note")); toast(`v${v.versionNo} registrada · sha256 ${v.sha256.slice(0, 12)}…`); contractModal(el.dataset.id); render(); } catch (e) { toast(e.message, "err"); el.disabled = false; } },
  "ctr-verify": async (el) => { const r = await verifyContractFile(el.dataset.id); toast(r.ok ? "Integridad verificada: el PDF coincide con su huella" : r.reason, r.ok ? "ok" : "err"); },
  "ctr-dl": async (el) => { try { await downloadVersion(el.dataset.id); } catch (e) { toast(e.message, "err"); } },
  "ctr-status": async (el) => { const st = el.dataset.st; if (st === "terminated" && !(await ask("¿Rescindir el contrato? La acción queda auditada.", { ok: "Rescindir", danger: true }))) return; try { updateContract(el.dataset.id, { status: st }); toast(st === "terminated" ? "Contrato rescindido" : "Enviado a firma"); contractModal(el.dataset.id); render(); } catch (e) { toast(e.message, "err"); } },
  "ctr-renew": (el) => { try { const c = db.get("contracts", el.dataset.id); updateContract(c.id, { endDate: addDays(c.endDate, 365) }); toast("Renovado por 1 año"); contractModal(c.id); render(); } catch (e) { toast(e.message, "err"); } },
  "ctr-sign": async (el) => { const who = await ask("¿Quién firma por el cliente? (nombre y cargo)", { input: true, title: "Firma del contrato", ok: "Marcar firmado" }); if (who == null) return; try { signContract(el.dataset.id, who.trim()); toast("Contrato firmado"); contractModal(el.dataset.id); render(); } catch (e) { toast(e.message, "err"); } },

  /* CRM */
  "client-new": () => openModal("Nuevo cliente", clientForm(), { submit: (f) => { const c = saveClient(formData(f)); return `${c.tradeName || c.legalName} agregado`; } }),
  "client-open": (el) => clientModal(el.dataset.id),
  "client-edit": (el) => { const c = db.get("clients", el.dataset.id); openModal("Editar cliente", clientForm(c), { submit: (f) => { saveClient(formData(f), c.id); return "Cliente actualizado"; } }); },
  "ci-add": (el) => { try { addInteraction(el.dataset.id, val("ci-kind"), val("ci-subject").trim(), val("ci-body").trim()); toast("Interacción registrada"); clientModal(el.dataset.id); render(); } catch (e) { toast(e.message, "err"); } },
  "cm-change": async (el) => { try { const sub = db.get("subscriptions", el.dataset.id); const np = val("cm-plan"); const amt = prorate(sub, np); if (!(await ask(`Cambiar a ${db.get("plans", np).name}.\nProrrateo del mes: ${fmt.money(amt, true)}.`, { ok: "Cambiar plan" }))) return; changePlan(sub.id, np); toast("Plan actualizado"); clientModal(sub.clientId); render(); } catch (e) { toast(e.message, "err"); } },
  "cm-create": (el) => { try { createSubscription(el.dataset.id, val("cm-plan")); toast("Suscripción dada de alta"); clientModal(el.dataset.id); render(); } catch (e) { toast(e.message, "err"); } },
  "cm-cancel": async (el) => { if (!(await ask("¿Dar de baja la suscripción?", { ok: "Dar de baja", danger: true }))) return; try { const s = db.get("subscriptions", el.dataset.id); cancelSubscription(s.id); toast("Suscripción cancelada"); clientModal(s.clientId); render(); } catch (e) { toast(e.message, "err"); } },
  upgrade: async (el) => { const s = db.get("subscriptions", el.dataset.id), p = db.get("plans", el.dataset.plan); if (!(await ask(`Upgrade de ${clientName(s.clientId)} a ${p.name} (${fmt.money(p.price)}/mes).\nDiferencia prorrateada este mes: ${fmt.money(Number(el.dataset.prev), true)}`, { ok: "Aplicar upgrade", title: "Upgrade de plan" }))) return; run(() => changePlan(s.id, p.id), (c) => `Upgrade aplicado · prorrateo ${fmt.money(c.prorated, true)}`); },
  plans: () => openModal("Planes de abono", S.plans.map((p) => `<div class="card" style="padding:14px;margin-bottom:10px"><div class="fgrid">
      ${field("Nombre", `<input class="in" name="name:${p.id}" value="${esc(p.name)}">`)}${field("Precio mensual", `<input class="in num" type="number" min="0" name="price:${p.id}" value="${p.price}">`)}
      ${field("Beneficios (uno por línea)", `<textarea class="in" rows="3" name="feat:${p.id}">${esc(p.features.join("\n"))}</textarea>`, "", "full")}</div></div>`).join("") + `<p class="xs subtle">El cambio de precio de lista no altera precios pactados (override) ya existentes.</p>`, {
    submit: (f) => { need("billing.manage"); const d = formData(f); S.plans.forEach((p) => { const price = Number(d["price:" + p.id]); if (!(price >= 0)) throw new Error("Precio inválido"); db.update("plans", p.id, { name: d["name:" + p.id], price, features: d["feat:" + p.id].split("\n").map((x) => x.trim()).filter(Boolean) }); }); return "Planes actualizados"; } }),

  /* caja */
  "cash-open": () => run(() => openSession(val("op-reg"), Number(val("op-amount"))), "Caja abierta"),
  "cash-move": () => run(() => registerMovement(openSessionOf().id, val("mv-kind"), val("mv-method"), Number(val("mv-amount")), val("mv-ref")), "Movimiento registrado"),
  "cash-close": async () => { const s = openSessionOf(); const exp = sessionBalance(s.id).cash; const cnt = Number(val("cl-counted")); const notes = val("cl-notes"); if (val("cl-counted") === "") return toast("Ingrese el efectivo contado", "err"); if (!(await ask(`Esperado ${fmt.money(exp, true)}\nContado ${fmt.money(cnt, true)}\nDiferencia ${fmt.money(r2(cnt - exp), true)}`, { title: "Cerrar caja", ok: "Cerrar caja", danger: true }))) return; run(() => closeSession(s.id, cnt, notes), (x) => x.difference ? `Caja cerrada con diferencia de ${fmt.money(x.difference, true)}` : "Caja cerrada sin diferencias"); },
  "sale-add-item": () => { UI.sale.items.push({ desc: "", qty: 1, price: 0, tax: 21 }); render(); },
  "sale-del-item": (el) => { UI.sale.items.splice(+el.dataset.i, 1); render(); },
  "sale-add-pay": () => { const c = saleCalc(); UI.sale.pays.push({ method: "transfer", amount: Math.max(0, c.diff), reference: "" }); render(); },
  "sale-del-pay": (el) => { UI.sale.pays.splice(+el.dataset.i, 1); render(); },
  "sale-fill": () => { const c = saleCalc(); if (!UI.sale.pays.length) UI.sale.pays.push({ method: "cash", amount: 0, reference: "" }); const p = UI.sale.pays[UI.sale.pays.length - 1]; p.amount = r2((Number(p.amount) || 0) + c.diff); render(); },
  "sale-issue": () => { const s = UI.sale; run(() => issueDocument({ sessionId: openSessionOf().id, type: s.type, clientId: s.clientId || null, depositId: s.depositId || null, items: s.items.map((i) => ({ ...i, qty: Number(i.qty), price: Number(i.price) })), payments: s.pays.map((p) => ({ ...p, amount: Number(p.amount) })) }),
    (d) => { UI.sale = newSale(); setTimeout(async () => { if (await ask(`${docLabel(d)} emitido por ${fmt.money(d.total, true)}.`, { title: "Comprobante emitido", ok: "Ver / imprimir", cancel: "Listo" })) printDocument(d.id); }, 60); return `${docLabel(d)} emitido`; }); },
  "doc-print": (el) => printDocument(el.dataset.id),
  "doc-void": async (el) => { const r = await ask("Motivo de anulación (queda en la auditoría):", { input: true, title: "Anular comprobante", ok: "Anular", danger: true }); if (r == null) return; run(() => voidDocument(el.dataset.id, r), "Comprobante anulado y movimientos revertidos"); },
  "doc-nc": (el) => { const d = db.get("documents", el.dataset.id); openModal(`Nota de crédito sobre ${docLabel(d)}`, `<p class="small muted mb">Se emite una NC por ${fmt.money(d.total, true)}${d.depositApplied ? ` y se devuelven ${fmt.money(r2(d.total - d.depositApplied), true)} (la seña aplicada no se reintegra automáticamente)` : ""}.</p>
      ${field("Medio de devolución", `<select class="in" name="method">${opts(Object.entries(METHODS))}</select>`)}${field("Motivo *", `<input class="in" name="reason">`)}`, { submitLabel: "Emitir nota de crédito", submit: (f) => { const x = formData(f); const nc = issueCreditNote(d.id, x.method, x.reason); return `${docLabel(nc)} emitida`; } }); },

  /* RRHH */
  "comm-calc": () => run(() => calcCommissions(UI.hrPeriod ?? monthKey()), (r) => `${r.length} comisiones calculadas`),
  "comm-approve": (el) => run(() => setCommissionStatus(el.dataset.id, "approved"), "Comisión aprobada"),
  "comm-pay": (el) => run(() => setCommissionStatus(el.dataset.id, "paid"), "Comisión marcada como pagada"),
  "goal-set": (el) => { const e = db.get("employees", el.dataset.id); const period = UI.hrPeriod ?? monthKey(); const g = S.goals.find((x) => x.employeeId === e.id && x.period === period);
    openModal(`Meta de ${esc(e.name)} · ${period}`, field("Meta de ventas (ARS)", `<input class="in num" type="number" min="1" name="target" value="${g?.target ?? ""}">`), { submit: (f) => { setGoal(e.id, period, Number(formData(f).target)); return "Meta guardada"; } }); },
  "emp-new": () => openModal("Nuevo integrante", empForm(), { submit: (f) => { const d = formData(f); saveEmployee({ name: d.name, position: d.position, staffType: d.staffType, hireDate: d.hireDate, salary: d.salary ? Number(d.salary) : null, schemeId: d.schemeId || null, email: d.email.trim(), role: d.role }); return "Integrante agregado"; } }),
  "emp-edit": (el) => { const e = db.get("employees", el.dataset.id); openModal("Editar integrante", empForm(e), { submit: (f) => { const d = formData(f); saveEmployee({ name: d.name, position: d.position, staffType: d.staffType, hireDate: d.hireDate, salary: d.salary ? Number(d.salary) : null, schemeId: d.schemeId || null, active: !!d.active }, e.id); return "Datos actualizados"; } }); },
  "perm-toggle": (el) => run(() => toggleRolePerm(el.dataset.role, el.dataset.perm), "Permiso actualizado"),

  /* CMS */
  "page-new": () => pageEditor(null),
  "page-edit": (el) => pageEditor(el.dataset.id),
  "page-publish": (el) => run(() => publishPage(el.dataset.id), (p) => `Publicada v${p.version}`),
  "page-preview": (el) => { const p = db.get("pages", el.dataset.id); if (p.status === "published") bumpMetric(p.id, "views"); openModal(`Vista previa · /${esc(p.slug)}`, (p.status !== "published" ? `<div class="notice">Borrador: el formulario no captura leads hasta publicar.</div>` : "") + landingHtml(p, p.status === "published"), { wide: true, footer: "" }); },
  "lead-submit": (el) => { try { submitLead(el.dataset.id, { name: val("ld-name").trim(), email: val("ld-email").trim(), phone: val("ld-phone").trim(), company: val("ld-company").trim(), message: val("ld-msg").trim() }); $("#lp-form").innerHTML = `<div class="center" style="padding:20px"><b class="t-ok">¡Gracias! Te contactamos a la brevedad.</b></div>`; toast("Lead capturado y notificado"); rerenderIf(["cms"]); } catch (e) { toast(e.message, "err"); } },
  "lead-convert": (el) => run(() => convertLead(el.dataset.id), (c) => `${c.tradeName} creado en el CRM como prospecto`),
  deploy: () => run(() => deploySite("site1"), "Despliegue en cola…"),

  /* soporte */
  "tk-filter": (el) => { UI.ticketFilter = el.dataset.id; render(); },
  "tk-open": (el) => ticketModal(el.dataset.id),
  "tk-new": () => openModal("Nuevo ticket", newTicketForm(), { submit: (f) => { const t = createTicket(formData(f)); return `Ticket #${t.number} creado`; } }),
  "tk-update": (el) => { try { need("tickets.manage"); const t = db.get("tickets", el.dataset.id); const st = val("tk-status"), as = val("tk-assign") || null; db.update("tickets", t.id, { status: st, assignedTo: as, ...(st === "resolved" && t.status !== "resolved" ? { resolvedAt: nowISO() } : {}) }); toast("Ticket actualizado"); ticketModal(t.id); render(); } catch (e) { toast(e.message, "err"); } },
  "tk-reply": (el) => { try { addTicketMessage(el.dataset.id, val("tk-msg"), $("#tk-internal")?.checked); ticketModal(el.dataset.id); render(); } catch (e) { toast(e.message, "err"); } },
  "portal-upgrade": async (el) => { const c = await ask("¿Algún comentario para tu ejecutivo? (opcional)", { input: true, title: "Solicitar cambio de plan", ok: "Enviar solicitud" }); if (c == null) return; run(() => requestUpgrade(el.dataset.id, c), "Solicitud enviada. Te contactamos en breve."); },

  /* auditoría */
  "audit-verify": () => { const v = verifyAudit(); toast(v.ok ? `Cadena íntegra: ${v.count} eventos` : `Cadena rota en #${v.id}: ${v.reason}`, v.ok ? "ok" : "err"); render(); },
  "audit-csv": () => {
    const rows = [["id", "fecha", "usuario", "rol", "accion", "entidad", "registro", "campos", "monto", "metodo", "hash"], ...S.audit.map((e) => [e.id, e.ts, e.actorName, e.actorRole, e.action, e.table, e.recordId ?? "", (e.changed ?? []).join("|"), e.amount ?? "", e.method ?? "", e.hash])];
    downloadText(`auditoria-svb-${todayISO()}.csv`, "﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
    audit("EXPORT", "audit", null, null, { rows: S.audit.length }); save();
  },

  /* ajustes */
  "st-save": () => run(() => { need("settings.manage"); const hb = clamp(Number(val("st-hb")) || 3, 2, 60); const old = { ...S.settings }; Object.assign(S.settings, { company: val("st-company").trim() || "Mi empresa", cuit: val("st-cuit").trim(), heartbeatSec: hb, simulate: $("#st-sim").checked }); audit("UPDATE", "settings", "general", { company: old.company, heartbeatSec: old.heartbeatSec }, { company: S.settings.company, heartbeatSec: hb }); save(); startMonitor(); }, "Configuración guardada"),
  "tg-save": () => run(() => { need("settings.manage"); Object.assign(S.settings.telegram, { token: val("tg-token").trim(), chatId: val("tg-chat").trim(), minSeverity: val("tg-min"), enabled: $("#tg-on").checked }); tgErrorShown = false; audit("UPDATE", "settings", "telegram", null, { chatId: S.settings.telegram.chatId, enabled: S.settings.telegram.enabled }); save(); }, "Telegram configurado"),
  "tg-test": async () => { A["tg-save"](); const tg = S.settings.telegram; if (!tg.token || !tg.chatId) return toast("Complete token y chat ID", "err"); const prev = tg.enabled; tg.enabled = true; tgErrorShown = false;
    const r = await sendTelegram("critical", "Mensaje de prueba: las alertas llegarán a este chat."); tg.enabled = prev; toast(r.ok ? "Mensaje enviado a Telegram ✓" : "No se pudo enviar: " + (r.error ?? "revise la configuración"), r.ok ? "ok" : "err"); },
  "user-new": () => openModal("Nuevo usuario", userForm(), { submit: (f) => { const d = formData(f); if (d.pin && !/^\d{4,8}$/.test(d.pin)) throw new Error("El PIN debe tener de 4 a 8 dígitos"); const nu = saveUser({ name: d.name.trim(), email: d.email.trim(), role: d.role, clientId: d.clientId || null, active: !!d.active }); if (d.pin) { db.update("users", nu.id, { pinHash: pinHash(nu.id, d.pin) }); } return "Usuario creado: ya puede ingresar"; } }),
  "user-edit": (el) => { const u = db.get("users", el.dataset.id); openModal("Editar usuario", userForm(u), { wide: true, submit: (f) => { const d = formData(f); const ov = {}; for (const [k, v] of Object.entries(d)) if (k.startsWith("ov:") && v !== "") ov[k.slice(3)] = v === "1";
      if (u.id === currentUser().id && !d.active) throw new Error("No puede desactivar su propio usuario"); if (d.pin && !/^\d{4,8}$/.test(d.pin)) throw new Error("El PIN debe tener de 4 a 8 dígitos"); saveUser({ name: d.name.trim(), email: d.email.trim(), role: d.role, clientId: d.clientId || null, active: !!d.active, overrides: STAFF_ROLES.includes(d.role) ? ov : {} }, u.id);
      if (d.pinClear) db.update("users", u.id, { pinHash: null }); else if (d.pin) db.update("users", u.id, { pinHash: pinHash(u.id, d.pin) }); return "Usuario actualizado"; } }); },
  "data-export": () => { downloadText(`svb-respaldo-${todayISO()}.json`, JSON.stringify(S, null, 1), "application/json"); audit("EXPORT", "system", null, null, { backup: true }); save(); },
  "data-reset": async () => { if (!(await ask("Se borrarán todos los datos de este navegador y se cargará la demo.", { title: "Restablecer datos", ok: "Borrar y restablecer", danger: true }))) return; localStorage.removeItem(APP_KEY); try { await Files.clear(); } catch { } UI.sale = null; loadState(); startMonitor(); toast("Datos de demostración restablecidos"); render(); },
};
function empForm(e = {}) {
  return `<div class="fgrid">${field("Nombre *", `<input class="in" name="name" value="${esc(e.name)}">`)}${field("Puesto", `<input class="in" name="position" value="${esc(e.position)}">`)}
    ${field("Perfil", `<select class="in" name="staffType">${opts(Object.entries(STAFF_TYPE).map(([k, v]) => [k, v[1]]), e.staffType ?? "employee")}</select>`)}${field("Ingreso", `<input class="in" type="date" name="hireDate" value="${e.hireDate ?? todayISO()}">`)}
    ${field("Sueldo base", `<input class="in num" type="number" min="0" name="salary" value="${e.salary ?? ""}">`)}${field("Esquema de comisión", `<select class="in" name="schemeId">${opts([["", "Sin comisión"], ...S.schemes.map((s) => [s.id, s.name])], e.schemeId)}</select>`)}
    ${e.id ? `<label class="row small muted full"><input type="checkbox" name="active" ${e.active !== false ? "checked" : ""}> Activo</label>` : `
    ${field("Email de acceso (opcional)", `<input class="in" type="email" name="email" placeholder="crea un usuario">`)}${field("Rol de acceso", `<select class="in" name="role">${opts(STAFF_ROLES.filter((r) => r !== "owner").map((r) => [r, ROLES[r]]), "employee")}</select>`)}`}</div>`;
}
function downloadText(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* Delegación */
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el || el.disabled) return;
  if (el.dataset.act === "modal-bg") { if (ev.target === el) closeModal(); return; }   // no bloquear submits del modal
  const fn = A[el.dataset.act]; if (!fn) return;
  if (el.tagName !== "A" || el.dataset.act !== "notif-go") ev.preventDefault();
  try { const r = fn(el, ev); if (r && r.catch) r.catch((e) => toast(e.message || String(e), "err")); } catch (e) { toast(e.message, "err"); }
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.actChange === "hr-period") { UI.hrPeriod = el.value; render(); }
  else if (el.dataset.actChange === "audit-filter") { UI.auditFilter = el.value; render(); }
  else if (el.dataset.actChange === "lead-status") run(() => { need("crm.write"); db.update("leads", el.dataset.id, { status: el.value }); }, "Lead actualizado");
  else if (el.id === "data-import" && el.files[0]) {
    el.files[0].text().then(async (t) => { const d = JSON.parse(t); if (d.version !== 1 || !Array.isArray(d.audit)) throw new Error("Archivo de respaldo inválido");
      if (!(await ask(`Importar respaldo del ${fmt.dt(d.createdAt)}. Reemplaza los datos actuales.`, { title: "Importar respaldo", ok: "Importar" }))) return; const me = S.session.userId; S = d; S.session.userId = me && db.get("users", me) ? me : null; saveNow(); startMonitor(); toast("Respaldo importado"); render(); })
      .catch((e) => toast("Importación fallida: " + e.message, "err"));
  }
  else if (el.dataset.s) { // formulario de venta
    setPath(UI.sale, el.dataset.s, el.value);
    if (["type", "clientId", "depositId"].includes(el.dataset.s)) { if (el.dataset.s === "clientId") UI.sale.depositId = ""; render(); }
  }
});
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.s && UI.sale) {
    setPath(UI.sale, el.dataset.s, el.value);
    const box = $("#sale-totals"); if (box) box.innerHTML = saleTotalsHtml();
    const c = saleCalc(); const b = $("#sale-btn"); if (b) b.disabled = c.diff !== 0 || c.total <= 0;
  }
  if (el.id === "gsearch") { clearTimeout(A._st); A._st = setTimeout(() => { UI.search = el.value.trim(); render(); const s = $("#gsearch"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 300); }
});
function setPath(obj, path, v) { const k = path.split("."); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; const last = k[k.length - 1]; o[last] = ["qty", "price", "amount", "tax"].includes(last) ? (v === "" ? "" : Number(v)) : v; }
document.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (f.id === "modal-form" && modalSubmit) {
    try { const msg = modalSubmit(f); closeModal(); if (msg) toast(msg); render(); } catch (e) { toast(e.message, "err"); }
  } else if (f.id === "portal-ticket") {
    run(() => createTicket(formData(f)), (t) => `Ticket #${t.number} creado. Te avisamos por email.`);
  }
});
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("#dialog-root").innerHTML && $("#modal-root").innerHTML) closeModal(); });
window.addEventListener("hashchange", () => { UI.search = ""; UI.notifOpen = false; $("#side")?.classList.remove("open"); render(); window.scrollTo(0, 0); });
window.addEventListener("resize", () => { if (route() === "monitor" && !isPortalUser()) rerenderIf(["monitor"], true); });
window.addEventListener("storage", (e) => { if (e.key === APP_KEY && e.newValue) { S = JSON.parse(e.newValue); render(); } });

/* ════════════════════ INICIO ════════════════════ */
try {
  loadState();
  try { processExpirations(); } catch (e) { console.error(e); }
  startMonitor();
  setInterval(() => { try { processExpirations(); } catch (e) { console.error(e); } }, 60 * 60 * 1000);
  render();
  window.__svbStarted = true;
} catch (e) {
  console.error(e);
  window.__svbShowError && window.__svbShowError(e.message || e);
}
</script>
</body>
</html>
