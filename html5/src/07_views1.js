<script>
/* ════════════════════ VISTAS (1/2) ════════════════════ */

function viewLogin() {
  const staff = S.users.filter((u) => u.active && STAFF_ROLES.includes(u.role));
  const clients = S.users.filter((u) => u.active && !STAFF_ROLES.includes(u.role));
  const ucard = (u) => `<button class="ucard" data-act="login" data-id="${u.id}"><b>${esc(u.name)}</b><span>${ROLES[u.role]}${u.clientId ? " · " + esc(clientName(u.clientId)) : ""}</span></button>`;
  return `<div class="login"><div class="card"><div class="card-b" style="padding:32px">
    <div class="logo" style="padding:0;margin-bottom:24px"><div class="logo-mark" style="width:44px;height:44px">VB</div><div><b style="font-size:18px">Sistema Integral SVB</b><span>${esc(S.settings.company)} · plataforma de gestión</span></div></div>
    <p class="muted" style="margin-bottom:18px">Elegí un perfil para ingresar. Cada rol ve sólo los módulos y datos que su permiso habilita (RBAC).</p>
    <div class="eyebrow" style="margin-bottom:10px">Equipo interno</div><div class="users">${staff.map(ucard).join("")}</div>
    <div class="eyebrow" style="margin:22px 0 10px">Portal de clientes</div><div class="users">${clients.map(ucard).join("")}</div>
    <p class="xs subtle" style="margin-top:24px">Los datos se guardan en este navegador. Para producción, usar la versión con Supabase del repositorio (apps/web). Desarrollado por ${DEV.name} · WhatsApp ${DEV.wa} · ${DEV.email}</p>
  </div></div></div>`;
}

function viewDashboard() {
  const u = currentUser(), k = kpis();
  const alerts = [...S.alerts].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 5);
  const expiring = S.contracts.filter((c) => c.status === "signed" && fmt.daysUntil(c.endDate) <= 30).sort((a, b) => a.endDate.localeCompare(b.endDate));
  const res = S.resources.filter((r) => r.active);
  return ph("Panel ejecutivo", `Hola, ${esc(u.name.split(" ")[0])}`, "Estado general de clientes, infraestructura e ingresos recurrentes.", `<span class="live"><i></i>En vivo</span>`) +
  `<div class="grid g4">
    ${kpi("MRR", fmt.money(k.mrr), `${k.activeClients} clientes activos`, "brand")}
    ${kpi("Planes con IA", `${k.aiShare} %`, "Potencial de upgrade en el resto", "info")}
    ${kpi("Ventas del mes", fmt.money(k.sales), `${k.leads7} leads nuevos en 7 días`, "ok")}
    ${kpi("Servicios operativos", `${k.resOk}/${k.resTotal}`, `${k.openAlerts} alertas abiertas`, k.resCount.down ? "crit" : k.resCount.degraded ? "warn" : "ok")}
  </div>
  <div class="grid g3 mt">
    ${card("Salud de clientes", `<div class="card-b grid g2" style="gap:10px">${res.map((r) => {
      const [t] = HEALTH[r.status];
      return `<a class="tile" href="#/monitor?r=${r.id}">${sdot(t, r.status !== "operational")}<div class="grow" style="min-width:0"><div class="t" style="color:var(--fg)">${esc(r.name)}</div><div class="xs subtle">${esc(r.clientId ? clientName(r.clientId) : "Interno")} · ${fmt.rel(r.lastBeat)}</div></div>${mapPill(HEALTH, r.status, false)}</a>`;
    }).join("")}</div>`, { sub: "Heartbeat en tiempo real", cls: "span2", action: can("monitor.read") ? `<a href="#/monitor" class="small">Ver monitor →</a>` : "" })}
    <div class="grid" style="gap:16px;align-content:start">
      ${card("Alertas recientes", `<ul class="list">${alerts.length ? alerts.map((a) => `<li><div class="row">${mapPill(SEV, a.severity)}<span class="xs subtle" style="margin-left:auto">${fmt.rel(a.openedAt)}</span></div><div class="small" style="margin-top:6px">${esc(a.title)}</div><div class="xs subtle">${a.status === "resolved" ? "resuelta" : a.status === "acknowledged" ? "en atención" : "abierta"}</div></li>`).join("") : `<li class="empty">Sin alertas</li>`}</ul>`)}
      ${card("Contratos por vencer", `<ul class="list">${expiring.length ? expiring.map((c) => { const d = fmt.daysUntil(c.endDate); return `<li class="row between"><div><div class="small">${esc(clientName(c.clientId))}</div><div class="xs subtle mono">${c.code}</div></div><b class="${d <= 7 ? "t-crit" : "t-warn"}">${d} días</b></li>`; }).join("") : `<li class="empty">Sin vencimientos próximos</li>`}</ul>`, { sub: "Próximos 30 días" })}
    </div>
  </div>
  <div class="grid g4 mt">
    ${kpi("Tickets abiertos", k.openTickets, "", k.openTickets > 5 ? "warn" : "")}
    ${kpi("Clientes activos", k.activeClients)}
    ${kpi("Contratos a renovar", k.expiring, "", k.expiring ? "warn" : "ok")}
    ${kpi("Leads 7 días", k.leads7, "", "info")}
  </div>`;
}

function viewMonitor() {
  const res = S.resources.filter((r) => r.active);
  const sel = db.get("resources", routeParam("r") || UI.monitorRes) ?? res.find((r) => r.status !== "operational") ?? res[0];
  if (sel) UI.monitorRes = sel.id;
  const k = kpis(), manage = can("monitor.manage");
  const samples = sel ? (S.samples[sel.id] ?? []) : [];
  const m = UI.monitorMetric, last = samples[samples.length - 1];
  const TH = { cpu: [75, 90, "%", 100, "#7C8CFF"], mem: [75, 85, "%", 100, "#38BDF8"], lat: [800, 1500, "ms", null, "#22E39B"] }[m];
  const lv = last?.[m]; const lvTone = lv == null ? "subtle" : lv >= TH[1] ? "crit" : lv >= TH[0] ? "warn" : "ok";
  afterHooks.push(() => drawChart($("#chart"), samples, { key: m, warn: TH[0], crit: TH[1], unit: TH[2], max: TH[3], color: TH[4] }));
  const alerts = [...S.alerts].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 25);
  const tg = S.settings.telegram;
  return ph("Módulo 1", "Monitor de salud e infraestructura", "Telemetría de servidores y bases Supabase/PostgreSQL de cada cliente corporativo.",
    `<span class="live"><i></i>Heartbeat cada ${S.settings.heartbeatSec} s</span>${manage ? btn("Reglas", "rules", { ic: "settings" }) + btn("Nuevo recurso", "res-new", { tone: "primary", ic: "plus" }) : ""}`) +
  `<div class="grid g4 mb">${["operational", "degraded", "down", "maintenance"].map((s) => `<div class="card row" style="padding:14px 18px">${sdot(HEALTH[s][0], s === "down" && k.resCount[s])}<span class="muted">${HEALTH[s][1]}</span><b class="num" style="margin-left:auto;font-size:20px">${k.resCount[s] ?? 0}</b></div>`).join("")}</div>
  <div class="grid g3">
    ${card(sel ? esc(sel.name) : "Sin recursos", `<div class="card-b">
        <div class="row between mb"><div class="tabs">${Object.entries(METRIC_LABEL).map(([key, l]) => `<button data-act="metric" data-id="${key}" class="${key === m ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="num t-${lvTone}" style="font-size:24px;font-weight:650">${lv ?? "—"}<span class="small subtle"> ${TH[2]}</span></div></div>
        <canvas id="chart" class="chart"></canvas></div>`,
      { cls: "span2", sub: sel ? `${esc(sel.clientId ? clientName(sel.clientId) : "Interno")} · ${esc(sel.region)} · último latido ${fmt.rel(sel.lastBeat)}` : "", action: sel ? `<div class="row wrap" style="justify-content:flex-end">${manage ? btn(sel.paused ? "Restaurar heartbeat" : "Cortar heartbeat", "res-pause", { sm: true, tone: sel.paused ? "success" : "ghost", data: { id: sel.id } }) + btn(sel.stress ? "Normalizar" : "Estrés", "res-stress", { sm: true, tone: sel.stress ? "danger" : "ghost", data: { id: sel.id } }) + btn(sel.status === "maintenance" ? "Fin mantenimiento" : "Mantenimiento", "res-maint", { sm: true, tone: "ghost", data: { id: sel.id } }) : ""}${mapPill(HEALTH, sel.status)}</div>` : "" })}
    ${card("Registro de alertas", `<ul class="list" style="max-height:372px;overflow:auto">${alerts.length ? alerts.map((a) => `<li style="${a.status === "resolved" ? "opacity:.55" : ""}">
        <div class="row">${mapPill(SEV, a.severity)}${a.notified ? pill("info", "Telegram ✓") : ""}<span class="xs subtle" style="margin-left:auto">${fmt.rel(a.openedAt)}</span></div>
        <div class="small" style="margin-top:6px;color:var(--fg)">${esc(a.title)}</div><div class="xs subtle">${esc(a.message)}</div>
        <div class="row between xs subtle" style="margin-top:6px"><span>${a.status === "resolved" ? "Resuelta " + fmt.dt(a.resolvedAt) : a.status === "acknowledged" ? "En atención · " + esc(userName(a.ackBy)) : "Abierta"}</span>
        ${manage && a.status === "open" ? btn("Tomar", "ack", { sm: true, data: { id: a.id } }) : ""}</div></li>`).join("") : `<li class="empty">Sin alertas registradas</li>`}</ul>`,
      { sub: tg.enabled && tg.token ? "Notificando por Telegram" : `Telegram sin configurar${can("settings.manage") ? ' · <a href="#/ajustes">configurar</a>' : ""}` })}
  </div>
  ${card("Recursos monitoreados", table(["Recurso", "Cliente", "Estado", "CPU", "Memoria", "Latencia", "Uptime 30 d", "Latido"], res.map((r) => {
    const s = (S.samples[r.id] ?? []).slice(-1)[0];
    const live = s && !r.paused && r.status !== "maintenance";
    const b = (v, w, c) => live ? `<div style="min-width:80px">${bar(v, v > c ? "crit" : v > w ? "warn" : "ok")}<span class="xs num">${v.toFixed(0)} %</span></div>` : "—";
    return `<tr class="${r.id === sel?.id ? "sel" : ""}"><td><a href="#/monitor?r=${r.id}" class="t">${esc(r.name)}</a><div class="s" style="max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.endpoint)}">${esc(r.kind)} · ${esc(r.endpoint)}</div></td>
      <td>${esc(r.clientId ? clientName(r.clientId) : "Interno")}</td><td>${mapPill(HEALTH, r.status)}</td>
      <td>${b(s?.cpu ?? 0, 75, 90)}</td><td>${b(s?.mem ?? 0, 75, 85)}</td>
      <td class="num ${live && s.lat > 1500 ? "t-crit" : live && s.lat > 800 ? "t-warn" : ""}">${live ? s.lat + " ms" : "—"}</td>
      <td class="num">${uptime30(r).toFixed(2).replace(".", ",")} %</td><td class="xs">${fmt.rel(r.lastBeat)}</td>
      </td></tr>`;
  })), { cls: "mt", sub: "Elegí un recurso para ver su gráfico. Simulación en el panel: «Cortar heartbeat» o «Estrés» para probar reglas y avisos" })}`;
}

function viewDocs() {
  const list = [...S.contracts].sort((a, b) => (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999"));
  const signed = list.filter((c) => c.status === "signed");
  const exp = signed.filter((c) => fmt.daysUntil(c.endDate) <= 30);
  const expBadge = (c) => { if (c.status !== "signed" || !c.endDate) return '<span class="subtle">—</span>'; const d = fmt.daysUntil(c.endDate); return d < 0 ? pill("crit", "Vencido") : d <= 7 ? pill("crit", d + " días", true) : d <= 30 ? pill("warn", d + " días", true) : pill("ok", d + " días"); };
  return ph("Módulo 2", "Gestor documental y de contratos", "Repositorio de PDF con versionado inmutable, huella SHA-256 y alertas de vencimiento (30/15/7 días).",
    can("docs.write") ? btn("Nuevo contrato", "ctr-new", { tone: "primary", ic: "plus" }) : "") +
  `<div class="grid g4 mb">${kpi("Firmados", signed.length, "", "ok")}${kpi("Borradores / en firma", list.filter((c) => ["draft", "pending_signature"].includes(c.status)).length)}${kpi("Vencen en 30 días", exp.length, "Aviso automático + Telegram", exp.length ? "warn" : "ok")}${kpi("Valor bajo contrato", fmt.money(signed.reduce((a, c) => a + (c.value ?? 0), 0)), "", "brand")}</div>` +
  card("Contratos", table(["Código", "Cliente", "Estado", "Vigencia", "Vence", "Versiones", ">Valor", ""], list.map((c) => {
    const vs = S.contractVersions.filter((v) => v.contractId === c.id).length;
    return `<tr><td><div class="t mono small">${c.code}</div><div class="s">${esc(c.title)}</div></td><td class="t">${esc(clientName(c.clientId))}</td>
      <td>${mapPill(CONTRACT_STATUS, c.status)}</td><td class="xs nowrap">${fmt.date(c.startDate)} → ${fmt.date(c.endDate)}</td><td>${expBadge(c)}</td>
      <td class="xs">v${vs}${c.autoRenew ? " · auto-renueva" : ""}</td><td class="right num">${fmt.money(c.value)}</td>
      <td class="right">${btn("Abrir", "ctr-open", { sm: true, data: { id: c.id } })}</td></tr>`;
  })));
}

function contractModal(id) {
  const c = db.get("contracts", id);
  const vs = S.contractVersions.filter((v) => v.contractId === id).sort((a, b) => b.versionNo - a.versionNo);
  const editable = ["draft", "pending_signature"].includes(c.status);
  const actions = [];
  if (can("docs.write") && c.status === "draft") actions.push(btn("Enviar a firma", "ctr-status", { sm: true, data: { id, st: "pending_signature" } }));
  if (can("docs.sign") && editable) actions.push(btn("Marcar firmado", "ctr-sign", { sm: true, tone: "success", data: { id } }));
  if (can("docs.write") && c.status === "signed") actions.push(btn("Renovar 1 año", "ctr-renew", { sm: true, data: { id } }), btn("Rescindir", "ctr-status", { sm: true, tone: "danger", data: { id, st: "terminated" } }));
  openModal(`${c.code} · ${esc(clientName(c.clientId))}`, `
    <div class="row between mb">${mapPill(CONTRACT_STATUS, c.status)}<div class="row">${actions.join("")}</div></div>
    <div class="fgrid small muted mb">
      <div>Título<div class="t" style="color:var(--fg)">${esc(c.title)}</div></div><div>Valor<div style="color:var(--fg)">${fmt.money(c.value)}</div></div>
      <div style="margin-top:10px">Vigencia<div style="color:var(--fg)">${fmt.date(c.startDate)} → ${fmt.date(c.endDate)}</div></div>
      <div style="margin-top:10px">Firma<div style="color:var(--fg)">${c.signedAt ? esc(c.signedBy) + " · " + fmt.dt(c.signedAt) : "—"}</div></div>
    </div>
    ${editable && can("docs.write") ? `<div class="card" style="padding:16px;margin-bottom:16px">
      <div class="fgrid"><label class="field"><span>Inicio</span><input class="in" type="date" id="c-start" value="${c.startDate ?? ""}"></label><label class="field"><span>Fin</span><input class="in" type="date" id="c-end" value="${c.endDate ?? ""}"></label></div>
      ${btn("Guardar fechas", "ctr-dates", { sm: true, data: { id } })}
      <hr style="border:0;border-top:1px solid var(--line2);margin:16px 0">
      ${field("Subir nueva versión (PDF, máx. 25 MB)", `<input class="in" type="file" id="c-file" accept="application/pdf" style="padding-top:7px">`, "Se calcula la huella SHA-256: cualquier alteración posterior es detectable.")}
      ${field("Nota de cambio", `<input class="in" id="c-note" placeholder="Ej.: ajuste cláusula SLA">`)}
      ${btn("Subir versión", "ctr-upload", { tone: "primary", sm: true, ic: "upload", data: { id } })}</div>` : ""}
    <div class="eyebrow" style="margin-bottom:8px">Versiones</div>
    ${vs.length ? `<ul class="list card">${vs.map((v) => `<li class="row between"><div><b>v${v.versionNo}</b> · ${esc(v.fileName)} <span class="xs subtle">(${(v.size / 1024).toFixed(0)} KB)</span>${v.id === c.currentVersionId ? " " + pill("brand", "vigente") : ""}<div class="hash">sha256 ${v.sha256.slice(0, 24)}… · ${esc(userName(v.by))} · ${fmt.dt(v.at)}${v.note ? " · " + esc(v.note) : ""}</div></div>
      <div class="row">${btn("", "ctr-verify", { sm: true, tone: "ghost", ic: "shield", data: { id: v.id } })}${btn("", "ctr-dl", { sm: true, tone: "ghost", ic: "download", data: { id: v.id } })}</div></li>`).join("")}</ul>` : `<p class="subtle small">Sin PDF cargado.</p>`}`, { wide: true, footer: "" });
}

function viewCrm() {
  const clients = [...S.clients].sort((a, b) => (a.tradeName || a.legalName).localeCompare(b.tradeName || b.legalName));
  const plans = S.plans.filter((p) => p.active).sort((a, b) => a.tier - b.tier), top = plans[plans.length - 1];
  const k = kpis();
  const cands = S.subscriptions.filter((s) => s.status === "active" && s.planId !== top?.id);
  const uplift = cands.reduce((a, s) => a + (top.price - subPrice(s)), 0);
  const lastInt = (cid) => S.interactions.filter((i) => i.clientId === cid).sort((a, b) => b.at.localeCompare(a.at))[0];
  return ph("Módulo 3", "CRM y suscripciones multi-nivel", "Cartera de clientes, historial de interacciones y planes con flujo de upgrade a IA.",
    (can("billing.manage") ? btn("Planes", "plans", { ic: "settings" }) : "") + (can("crm.write") ? btn("Nuevo cliente", "client-new", { tone: "primary", ic: "plus" }) : "")) +
  `<div class="grid g4 mb">${kpi("MRR", fmt.money(k.mrr), "", "brand")}${kpi("Clientes activos", k.activeClients, "", "ok")}${kpi("Prospectos", S.clients.filter((c) => c.status === "lead").length, "", "info")}${kpi("Potencial de upgrade", fmt.money(uplift), `${cands.length} suscripciones sin IA`, "warn")}</div>
  <div class="grid g2 mb">${plans.map((p) => `<div class="card plan ${p.ai ? "ai" : ""}"><div class="row between"><h3 style="font-size:17px">${esc(p.name)}</h3>${p.ai ? pill("brand", "Automatizaciones + IA", true) : pill("", "Abono fijo")}</div>
    <div class="num" style="font-size:30px;font-weight:650;margin-top:10px">${fmt.money(p.price)}<span class="small subtle"> /mes</span></div>
    <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul><p class="xs subtle" style="margin-top:12px">${S.subscriptions.filter((s) => s.planId === p.id && s.status === "active").length} clientes en este plan</p></div>`).join("")}</div>` +
  card("Cartera de clientes", table(["Cliente", "Estado", "Plan", ">Abono", "Responsable", "Último contacto", ""], clients.map((c) => {
    const s = activeSub(c.id), p = planOf(s), li = lastInt(c.id);
    const prev = s && top && p.id !== top.id ? prorate(s, top.id) : 0;
    return `<tr><td><div class="t">${esc(c.tradeName || c.legalName)}</div><div class="s">${esc(c.industry || "—")} · ${esc(c.city || "—")} · ${esc(c.taxId || "sin CUIT")}</div></td>
      <td>${mapPill(CLIENT_STATUS, c.status)}</td><td>${p ? pill(p.ai ? "brand" : "", p.name) : '<span class="subtle">—</span>'}</td>
      <td class="right num t">${s ? fmt.money(subPrice(s)) : "—"}</td><td>${esc(userName(c.ownerId))}</td><td class="xs">${li ? fmt.rel(li.at) : "—"}</td>
      <td class="right nowrap">${can("billing.manage") && s && top && p.id !== top.id ? btn("Upgrade a IA", "upgrade", { sm: true, tone: "primary", ic: "spark", data: { id: s.id, plan: top.id, prev } }) : ""} ${btn("Ficha", "client-open", { sm: true, data: { id: c.id } })}</td></tr>`;
  })));
}
const CLIENT_STATUS = { active: ["ok", "Activo"], lead: ["info", "Prospecto"], paused: ["warn", "Pausado"], churned: ["crit", "Baja"] };
const INT_KIND = { call: "Llamada", whatsapp: "WhatsApp", email: "Email", meeting: "Reunión", demo: "Demo", note: "Nota", ticket: "Ticket" };

function clientForm(c = {}) {
  return `<div class="fgrid">
    ${field("Razón social *", `<input class="in" name="legalName" required value="${esc(c.legalName)}">`)}
    ${field("Nombre comercial", `<input class="in" name="tradeName" value="${esc(c.tradeName)}">`)}
    ${field("CUIT", `<input class="in" name="taxId" placeholder="30-12345678-9" value="${esc(c.taxId)}">`)}
    ${field("Condición IVA", `<select class="in" name="taxCondition">${opts([["RI", "Responsable inscripto"], ["Monotributo", "Monotributo"], ["Exento", "Exento"], ["CF", "Consumidor final"]], c.taxCondition)}</select>`)}
    ${field("Email", `<input class="in" name="email" type="email" value="${esc(c.email)}">`)}
    ${field("Teléfono / WhatsApp", `<input class="in" name="phone" value="${esc(c.phone)}">`)}
    ${field("Ciudad", `<input class="in" name="city" value="${esc(c.city ?? "Salta")}">`)}
    ${field("Rubro", `<input class="in" name="industry" value="${esc(c.industry)}">`)}
    ${field("Estado", `<select class="in" name="status">${opts(Object.entries(CLIENT_STATUS).map(([k, v]) => [k, v[1]]), c.status ?? "lead")}</select>`)}
    ${field("Responsable", `<select class="in" name="ownerId">${opts(S.users.filter((u) => STAFF_ROLES.includes(u.role) && u.active).map((u) => [u.id, u.name]), c.ownerId ?? currentUser().id)}</select>`)}
  </div>`;
}

function clientModal(id) {
  const c = db.get("clients", id), s = activeSub(id), p = planOf(s);
  const ints = S.interactions.filter((i) => i.clientId === id).sort((a, b) => b.at.localeCompare(a.at));
  const changes = s ? S.subChanges.filter((x) => x.subscriptionId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const docs = S.documents.filter((d) => d.clientId === id).slice(-5).reverse();
  openModal(esc(c.tradeName || c.legalName), `
    <div class="row between mb">${mapPill(CLIENT_STATUS, c.status)}<div class="row">${can("crm.write") ? btn("Editar datos", "client-edit", { sm: true, data: { id } }) : ""}</div></div>
    <div class="fgrid small muted mb"><div>Razón social<div style="color:var(--fg)">${esc(c.legalName)}</div></div><div>CUIT / IVA<div style="color:var(--fg)">${esc(c.taxId || "—")} · ${esc(c.taxCondition)}</div></div>
      <div style="margin-top:10px">Contacto<div style="color:var(--fg)">${esc(c.email || "—")} · ${esc(c.phone || "—")}</div></div><div style="margin-top:10px">Responsable<div style="color:var(--fg)">${esc(userName(c.ownerId))}</div></div></div>
    <div class="card" style="padding:16px;margin-bottom:16px"><div class="row between"><div><div class="eyebrow">Suscripción</div>
      ${s ? `<b>${esc(p.name)}</b> · ${fmt.money(subPrice(s))}/mes <span class="xs subtle">desde ${fmt.date(s.startedAt)}</span>` : '<span class="subtle">Sin suscripción activa</span>'}</div>
      <div class="row">${can("billing.manage") ? (s ? `<select class="in" id="cm-plan" style="width:auto;height:30px">${opts(S.plans.filter((x) => x.active && x.id !== p.id).map((x) => [x.id, `${x.name} · ${fmt.money(x.price)}`]))}</select>${btn("Cambiar plan", "cm-change", { sm: true, tone: "primary", data: { id: s.id } })}${btn("Baja", "cm-cancel", { sm: true, tone: "danger", data: { id: s.id } })}`
        : `<select class="in" id="cm-plan" style="width:auto;height:30px">${opts(S.plans.filter((x) => x.active).map((x) => [x.id, `${x.name} · ${fmt.money(x.price)}`]))}</select>${btn("Dar de alta", "cm-create", { sm: true, tone: "success", data: { id } })}`) : ""}</div></div>
      ${changes.length ? `<div class="xs subtle" style="margin-top:10px">${changes.map((x) => `${fmt.date(x.effective)} · ${x.kind} → ${esc(db.get("plans", x.toPlanId)?.name)}${x.prorated ? " · prorrateo " + fmt.money(x.prorated, true) : ""}`).join("<br>")}</div>` : ""}</div>
    ${can("crm.write") ? `<div class="card" style="padding:16px;margin-bottom:16px"><div class="eyebrow" style="margin-bottom:8px">Registrar interacción</div><div class="fgrid">
      ${field("Tipo", `<select class="in" id="ci-kind">${opts(Object.entries(INT_KIND).filter(([k]) => k !== "ticket"))}</select>`)}${field("Asunto", `<input class="in" id="ci-subject">`)}
      ${field("Detalle", `<textarea class="in" id="ci-body" rows="2"></textarea>`, "", "full")}</div>${btn("Guardar en historial", "ci-add", { sm: true, data: { id } })}</div>` : ""}
    <div class="eyebrow" style="margin-bottom:8px">Historial</div>
    <ul class="list card mb">${ints.length ? ints.map((i) => `<li><div class="row">${pill("", INT_KIND[i.kind])}<b class="small">${esc(i.subject)}</b><span class="xs subtle" style="margin-left:auto">${esc(userName(i.userId))} · ${fmt.rel(i.at)}</span></div>${i.body ? `<div class="small muted" style="margin-top:4px">${esc(i.body)}</div>` : ""}</li>`).join("") : `<li class="empty">Sin interacciones</li>`}</ul>
    ${docs.length ? `<div class="eyebrow" style="margin-bottom:8px">Últimos comprobantes</div><ul class="list card">${docs.map((d) => `<li class="row between small"><span class="mono">${docLabel(d)}</span><span>${fmt.date(d.issuedAt)} · <b>${fmt.money(d.total, true)}</b> ${d.status === "voided" ? pill("crit", "Anulado") : ""}</span></li>`).join("")}</ul>` : ""}
  `, { wide: true, footer: "" });
}
</script>
