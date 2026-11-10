<script>
/* ════════════════════ VISTAS (2/2) ════════════════════ */

/* ───────── CAJA ───────── */
function newSale() {
  const p = S.plans.find((x) => x.active);
  return { type: "invoice_b", clientId: "", depositId: "", items: [{ desc: p ? p.name : "", qty: 1, price: p?.price ?? 0, tax: 21 }], pays: [{ method: "cash", amount: p?.price ?? 0, reference: "" }] };
}
function saleCalc() {
  const s = UI.sale; const t = calcTotals(s.type, s.items.filter((i) => i.desc && i.qty > 0));
  const dep = s.depositId ? db.get("documents", s.depositId)?.total ?? 0 : 0;
  const due = r2(t.total - dep); const paid = r2(s.pays.reduce((a, p) => a + (Number(p.amount) || 0), 0));
  return { ...t, dep, due, paid, diff: r2(due - paid) };
}
function saleTotalsHtml() {
  const c = saleCalc(), s = UI.sale;
  return `<div class="row between muted"><span>Neto</span><span class="num">${fmt.money(c.net, true)}</span></div>
    <div class="row between muted"><span>IVA ${s.type === "invoice_a" ? "discriminado" : s.type === "invoice_c" ? "(no corresponde)" : "incluido"}</span><span class="num">${fmt.money(c.tax, true)}</span></div>
    <div class="row between b" style="font-size:16px;margin-top:6px"><span>Total</span><span class="num">${fmt.money(c.total, true)}</span></div>
    ${c.dep ? `<div class="row between t-info small"><span>Seña aplicada</span><span class="num">− ${fmt.money(c.dep, true)}</span></div><div class="row between small"><span>Saldo a cobrar</span><span class="num">${fmt.money(c.due, true)}</span></div>` : ""}
    <div class="row between small ${c.diff === 0 ? "t-ok" : "t-warn"}" style="margin-top:4px"><span>${c.diff === 0 ? "Pagos completos" : c.diff > 0 ? "Falta cobrar" : "Excedente"}</span><span class="num">${fmt.money(Math.abs(c.diff), true)}</span></div>`;
}
function viewCaja() {
  const sess = openSessionOf();
  const sup = can("pos.supervise");
  const closed = S.sessions.filter((s) => s.status === "closed").sort((a, b) => b.closedAt.localeCompare(a.closedAt)).slice(0, 8);
  const head = ph("Módulo 4", "Punto de venta, caja y auditoría", "Apertura, saldo y cierre diario. Cada movimiento queda firmado en una cadena de auditoría inmutable.");
  const closedCard = closed.length ? card("Cierres anteriores", table(["Apertura", "Cierre", "Operó", ">Esperado", ">Contado", ">Diferencia", "Notas"], closed.filter((s) => sup || s.openedBy === currentUser().id).map((s) =>
    `<tr><td class="xs">${fmt.dt(s.openedAt)}</td><td class="xs">${fmt.dt(s.closedAt)}</td><td>${esc(userName(s.openedBy))}</td><td class="right num">${fmt.money(s.expected, true)}</td><td class="right num">${fmt.money(s.counted, true)}</td>
     <td class="right num ${s.difference ? "t-crit" : "t-ok"}">${fmt.money(s.difference, true)}</td><td class="xs">${esc(s.notes || "—")}</td></tr>`)), { cls: "mt" }) : "";
  const auditCard = can("audit.read") ? card("Pista de auditoría · caja", auditTable(S.audit.filter((e) => ["movements", "documents", "sessions"].includes(e.table)).slice(-30).reverse()), { cls: "mt", sub: "Usuario, monto, hora, método de pago de cada transacción · SHA-256 encadenado" }) : "";
  if (!sess) {
    return head + card("No hay caja abierta", `<div class="card-b"><div class="fgrid" style="grid-template-columns:repeat(3,1fr);align-items:end">
      ${field("Caja", `<select class="in" id="op-reg">${opts(S.registers.map((r) => [r.id, `${r.name} · PV ${r.pos}`]))}</select>`)}
      ${field("Fondo inicial (efectivo)", `<input class="in" id="op-amount" type="number" min="0" step="0.01" value="10000">`)}
      <div class="field">${btn("Abrir caja", "cash-open", { tone: "success", ic: "unlock" })}</div></div></div>`, { sub: "Abra la caja para comenzar a operar" }) + closedCard + auditCard;
  }
  UI.sale = UI.sale || newSale();
  const b = sessionBalance(sess.id), s = UI.sale, c = saleCalc();
  const mv = S.movements.filter((m) => m.sessionId === sess.id).sort((a, b) => b.at.localeCompare(a.at));
  const docs = S.documents.filter((d) => d.sessionId === sess.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const deposits = S.documents.filter((d) => d.type === "deposit_receipt" && d.status === "issued" && !S.documents.some((x) => x.relatedId === d.id && x.status === "issued") && (!s.clientId || d.clientId === s.clientId));
  return head + `
  <div class="card row wrap mb" style="padding:14px 20px">${sdot("ok", true)}<span><b>${esc(db.get("registers", sess.registerId).name)}</b> abierta por ${esc(userName(sess.openedBy))}</span>${pill("", fmt.rel(sess.openedAt) + " · " + fmt.dt(sess.openedAt))}<span class="xs subtle" style="margin-left:auto">${b.count} movimientos</span></div>
  <div class="grid g4 mb">${kpi("Fondo inicial", fmt.money(sess.opening))}${kpi("Saldo en efectivo", fmt.money(b.cash, true), "Esperado en el cajón", "ok")}${kpi("Ventas + señas", fmt.money(b.gross), "", "brand")}${kpi("Medios electrónicos", fmt.money(b.electronic), Object.entries(b.byMethod).filter(([k]) => k !== "cash").map(([k, v]) => `${METHODS[k]} ${fmt.money(v)}`).join(" · ") || "—", "info")}</div>
  <div class="grid g3">
    ${card("Nueva venta", `<div class="card-b">
      <div class="fgrid">
        ${field("Comprobante", `<select class="in" data-s="type">${opts(Object.entries(DOC_TYPES).filter(([k]) => k !== "credit_note"), s.type)}</select>`)}
        ${field("Cliente", `<select class="in" data-s="clientId">${opts([["", "Consumidor final"], ...S.clients.map((x) => [x.id, x.tradeName || x.legalName])], s.clientId)}</select>`)}
        ${s.type !== "deposit_receipt" && deposits.length ? field("Aplicar seña / anticipo", `<select class="in" data-s="depositId">${opts([["", "Sin seña"], ...deposits.map((d) => [d.id, `${fmt.docNo(d.pos, d.number)} · ${d.customerName} · ${fmt.money(d.total)}`])], s.depositId)}</select>`, "", "full") : ""}
      </div>
      <div class="small b muted" style="margin:4px 0 8px">Ítems</div>
      ${s.items.map((it, i) => `<div class="row" style="margin-bottom:8px;align-items:stretch">
        <input class="in" style="flex:5" placeholder="Descripción" data-s="items.${i}.desc" value="${esc(it.desc)}">
        <input class="in num" style="flex:1;min-width:60px" type="number" min="1" step="1" data-s="items.${i}.qty" value="${it.qty}">
        <input class="in num" style="flex:2" type="number" min="0" step="0.01" data-s="items.${i}.price" value="${it.price}">
        <select class="in" style="flex:1.3;min-width:84px" data-s="items.${i}.tax">${opts([[21, "21 %"], [10.5, "10,5 %"], [0, "0 %"]], it.tax)}</select>
        ${btn("", "sale-del-item", { tone: "ghost", ic: "x", data: { i } })}</div>`).join("")}
      ${btn("Ítem", "sale-add-item", { sm: true, tone: "ghost", ic: "plus" })}
      <div class="small b muted" style="margin:14px 0 8px">Medios de pago</div>
      ${s.pays.map((p, i) => `<div class="row" style="margin-bottom:8px">
        <select class="in" style="flex:2" data-s="pays.${i}.method">${opts(Object.entries(METHODS), p.method)}</select>
        <input class="in num" style="flex:2" type="number" min="0" step="0.01" data-s="pays.${i}.amount" value="${p.amount}">
        <input class="in" style="flex:2" placeholder="Ref. / nº operación" data-s="pays.${i}.reference" value="${esc(p.reference)}">
        ${btn("", "sale-del-pay", { tone: "ghost", ic: "x", data: { i } })}</div>`).join("")}
      <div class="row">${btn("Medio de pago", "sale-add-pay", { sm: true, tone: "ghost", ic: "plus" })}${btn("Completar saldo", "sale-fill", { sm: true, tone: "ghost" })}</div>
      <div class="card" style="padding:14px 16px;margin:14px 0;background:var(--ink-900)" id="sale-totals">${saleTotalsHtml()}</div>
      ${btn("Emitir comprobante", "sale-issue", { tone: "success", ic: "check", disabled: c.diff !== 0 || c.total <= 0 }).replace('class="btn', 'id="sale-btn" class="btn block')}
      <p class="xs subtle" style="margin-top:8px">El CAE se obtiene al integrar la facturación electrónica ARCA (sv.arca.sdk). Mientras tanto el comprobante es interno.</p>
    </div>`, { cls: "span2", sub: "Factura, ticket, recibo o seña · pagos mixtos" })}
    <div class="grid" style="gap:16px;align-content:start">
      ${card("Ingreso / egreso manual", `<div class="card-b">
        <div class="fgrid">${field("Tipo", `<select class="in" id="mv-kind">${opts([["income", "Ingreso"], ...(sup ? [["expense", "Egreso / gasto"], ["withdrawal", "Retiro"]] : [])])}</select>`)}${field("Medio", `<select class="in" id="mv-method">${opts([["cash", "Efectivo"], ["transfer", "Transferencia"]])}</select>`)}</div>
        ${field("Importe", `<input class="in" id="mv-amount" type="number" min="0.01" step="0.01">`)}${field("Concepto", `<input class="in" id="mv-ref" placeholder="Ej.: compra de insumos">`)}
        ${btn("Registrar", "cash-move", { tone: "outline" }).replace('class="btn', 'class="btn block')}</div>`)}
      ${card("Cierre y arqueo", `<div class="card-b">
        ${field("Efectivo contado", `<input class="in" id="cl-counted" type="number" min="0" step="0.01">`, `Esperado según sistema: ${fmt.money(b.cash, true)}`)}
        ${field("Observaciones", `<input class="in" id="cl-notes">`, "Obligatorio si hay diferencia")}
        ${btn("Cerrar caja", "cash-close", { tone: "danger", ic: "lock" }).replace('class="btn', 'class="btn block')}</div>`)}
    </div>
  </div>
  ${card("Comprobantes de la sesión", table(["Comprobante", "Cliente", "Hora", ">Total", "Estado", ""], docs.map((d) => `<tr><td class="mono small t">${docLabel(d)}</td><td>${esc(d.customerName)}</td><td class="xs">${fmt.dt(d.issuedAt)}</td><td class="right num t">${fmt.money(d.total, true)}</td>
    <td>${d.status === "voided" ? pill("crit", "Anulado") : S.documents.some((x) => x.relatedId === d.id && x.status === "issued") ? pill("info", d.type === "deposit_receipt" ? "Seña aplicada" : "Con NC") : pill("ok", "Emitido")}</td>
    <td class="right nowrap">${btn("", "doc-print", { sm: true, tone: "ghost", ic: "print", data: { id: d.id } })}${can("pos.void") && d.status === "issued" && d.type !== "credit_note" ? btn(d.type.startsWith("invoice") ? "Nota de crédito" : "Anular", d.type.startsWith("invoice") ? "doc-nc" : "doc-void", { sm: true, tone: "danger", data: { id: d.id } }) : ""}</td></tr>`)), { cls: "mt" })}
  ${card("Movimientos de la sesión", table(["Hora", "Tipo", "Comprobante", "Método", "Referencia", "Usuario", ">Importe"], mv.map((m) => {
    const d = m.documentId ? db.get("documents", m.documentId) : null;
    return `<tr><td class="xs num">${fmt.dt(m.at)}</td><td class="t">${m.amount >= 0 ? '<span class="t-ok">↙</span>' : '<span class="t-crit">↗</span>'} ${MOV_KINDS[m.kind]}</td><td class="mono xs">${d ? docLabel(d) : "—"}</td><td class="xs">${METHODS[m.method]}</td><td class="xs">${esc(m.reference || "—")}</td><td>${esc(userName(m.by))}</td><td class="right num b ${m.amount >= 0 ? "t-ok" : "t-crit"}">${fmt.money(m.amount, true)}</td></tr>`;
  })), { cls: "mt", sub: "Libro inmutable: las correcciones se registran como reversión" })}
  ${closedCard}${auditCard}`;
}

function printDocument(id) {
  const d = db.get("documents", id);
  const rel = d.relatedId ? db.get("documents", d.relatedId) : null;
  const html = (`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${docLabel(d)}</title><style>
    body{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:#000;max-width:340px;margin:16px auto}h1{font-size:15px;margin:0}hr{border:0;border-top:1px dashed #000;margin:10px 0}
    table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}.r{text-align:right}.b{font-weight:700}.c{text-align:center}.v{color:#b00;font-size:16px;font-weight:700;text-align:center;border:2px solid #b00;padding:4px;margin:8px 0}
    @media print{button{display:none}}</style></head><body>
    <h1>${esc(S.settings.company)}</h1><div>CUIT ${esc(S.settings.cuit)}</div><hr>
    <div class="b">${DOC_TYPES[d.type]} Nº ${fmt.docNo(d.pos, d.number)}</div><div>Fecha: ${fmt.dt(d.issuedAt)}</div>
    <div>Cliente: ${esc(d.customerName)}${d.customerTaxId ? " · CUIT " + esc(d.customerTaxId) : ""}</div>
    ${d.status === "voided" ? `<div class="v">ANULADO · ${esc(d.voidReason)}</div>` : ""}<hr>
    <table>${d.items.map((i) => `<tr><td>${i.qty} x ${esc(i.desc)}<br><small>${fmt.money(i.price, true)} · IVA ${i.tax}%</small></td><td class="r">${fmt.money(r2(i.qty * i.price), true)}</td></tr>`).join("")}</table><hr>
    <table><tr><td>Neto</td><td class="r">${fmt.money(d.net, true)}</td></tr><tr><td>IVA</td><td class="r">${fmt.money(d.tax, true)}</td></tr>
    <tr class="b"><td>TOTAL</td><td class="r">${fmt.money(d.total, true)}</td></tr>
    ${d.depositApplied ? `<tr><td>Seña aplicada (${rel ? fmt.docNo(rel.pos, rel.number) : ""})</td><td class="r">-${fmt.money(d.depositApplied, true)}</td></tr><tr class="b"><td>Saldo cobrado</td><td class="r">${fmt.money(r2(d.total - d.depositApplied), true)}</td></tr>` : ""}
    ${d.type === "credit_note" && rel ? `<tr><td colspan="2">Anula ${docLabel(rel)}</td></tr>` : ""}</table><hr>
    <div>Pagos: ${S.movements.filter((m) => m.documentId === d.id && !m.reversesId).map((m) => `${METHODS[m.method]} ${fmt.money(Math.abs(m.amount), true)}`).join(" · ") || "—"}</div>
    <div>Atendió: ${esc(userName(d.issuedBy))}</div><div>CAE: ${d.cae ?? "pendiente (integración ARCA)"}</div><hr>
    <div class="c">${d.type === "deposit_receipt" ? "Recibo de seña: se descuenta del comprobante final." : "¡Gracias por su compra!"}</div>
    <div class="c" style="margin-top:8px;font-size:10px">Sistema Integral SVB · ${DEV.name} · ${DEV.wa}</div>
    <p class="c"><button onclick="print()">Imprimir</button></p></body></html>`);
  let w = null;
  try { w = window.open("", "_blank", "width=420,height=700"); } catch { w = null; }
  if (w && w.document) { w.document.write(html); w.document.close(); }
  else openModal(esc(docLabel(d)), `<iframe id="doc-frame" title="Comprobante" style="width:100%;height:560px;border:0;border-radius:12px;background:#fff" srcdoc="${esc(html)}"></iframe>`, { footer: `<div class="modal-f"><button type="button" class="btn primary" onclick="try{document.getElementById('doc-frame').contentWindow.print()}catch(e){}">Imprimir</button></div>` });
  audit("PRINT", "documents", id, null, { label: docLabel(d) }); save();
}

/* ───────── RRHH ───────── */
const STAFF_TYPE = { partner: ["brand", "Socio"], seller: ["info", "Vendedor"], technician: ["ok", "Técnico"], employee: ["", "Empleado"] };
const COMM_STATUS = { pending: ["warn", "Pendiente"], approved: ["info", "Aprobada"], paid: ["ok", "Pagada"] };
function viewHr() {
  const period = UI.hrPeriod ?? monthKey();
  const emps = S.employees.filter((e) => e.active);
  const rows = emps.map((e) => {
    const u = db.get("users", e.userId); const goal = S.goals.find((g) => g.employeeId === e.id && g.period === period);
    const sales = e.userId ? salesOf(e.userId, period) : 0; const com = S.commissions.find((c) => c.employeeId === e.id && c.period === period);
    return { e, u, goal, sales, com };
  });
  const tSales = rows.filter((r) => r.goal).reduce((a, r) => a + r.sales, 0), tGoal = rows.reduce((a, r) => a + (r.goal?.target ?? 0), 0);
  const tCom = S.commissions.filter((c) => c.period === period).reduce((a, c) => a + c.amount, 0);
  const editM = can("settings.manage");
  const months = [...new Set([monthKey(), ...S.goals.map((g) => g.period), ...S.commissions.map((c) => c.period)])].sort().reverse();
  const sch = S.schemes[0];
  return ph("Módulo 5", "Recursos humanos y rendimiento", "Equipo interno, control de acceso por rol, metas de venta y comisiones automáticas por tramos.",
    `<select class="in" style="width:auto" data-act-change="hr-period">${opts(months.map((m) => [m, new Date(m + "-15").toLocaleDateString("es-AR", { month: "long", year: "numeric" })]), period)}</select>` +
    (can("hr.manage") ? btn("Calcular comisiones", "comm-calc", { tone: "primary" }) + btn("Nuevo integrante", "emp-new", { ic: "plus" }) : "")) +
  `<div class="grid g4 mb">${kpi("Integrantes", emps.length)}${kpi("Ventas con meta", fmt.money(tSales), "", "brand")}${kpi("Cumplimiento global", tGoal ? Math.round(tSales / tGoal * 100) + " %" : "—", "", tSales >= tGoal && tGoal ? "ok" : "warn")}${kpi("Comisiones del período", fmt.money(tCom), sch ? `Tramos: ${sch.tiers.map((t) => `${t.rate}% ≥${t.from}%`).join(" · ")}` : "", "ok")}</div>` +
  card("Equipo y metas", table(["Integrante", "Perfil", "Rol de acceso", "Meta del período", "Comisión", ""], rows.map(({ e, u, goal, sales, com }) => {
    const pct = goal ? sales / goal.target * 100 : null;
    return `<tr><td><div class="t">${esc(e.name)}</div><div class="s">${esc(e.position)} · desde ${fmt.date(e.hireDate)}</div></td><td>${mapPill(STAFF_TYPE, e.staffType, false)}</td>
      <td class="xs">${u ? ROLES[u.role] + `<div class="s">${esc(u.email)}</div>` : '<span class="subtle">sin acceso</span>'}</td>
      <td style="min-width:220px">${pct == null ? (e.schemeId && can("hr.manage") ? btn("Fijar meta", "goal-set", { sm: true, tone: "ghost", data: { id: e.id } }) : '<span class="subtle">—</span>') :
        `${bar(pct)}<div class="row between xs num" style="margin-top:4px"><span>${fmt.money(sales)} / ${fmt.money(goal.target)}</span><span class="${pct >= 100 ? "t-ok" : ""}">${pct.toFixed(0)} %</span></div>`}</td>
      <td>${com ? `<div class="b num">${fmt.money(com.amount)}</div><div class="row xs subtle">${mapPill(COMM_STATUS, com.status)} ${com.rate}%</div>` : '<span class="subtle">—</span>'}</td>
      <td class="right nowrap">${com && can("commissions.approve") && com.status === "pending" ? btn("Aprobar", "comm-approve", { sm: true, tone: "success", data: { id: com.id } }) : ""}${com && can("commissions.approve") && com.status === "approved" ? btn("Marcar pagada", "comm-pay", { sm: true, data: { id: com.id } }) : ""}
        ${can("hr.manage") ? btn("Editar", "emp-edit", { sm: true, tone: "ghost", data: { id: e.id } }) + (goal ? btn("Meta", "goal-set", { sm: true, tone: "ghost", data: { id: e.id } }) : "") : ""}</td></tr>`;
  }))) +
  card("Matriz de control de acceso (RBAC)", table(["Permiso", ...STAFF_ROLES.map((r) => ROLES[r])], PERMS.map(([p, d]) => `<tr><td><div class="mono xs t">${p}</div><div class="s">${esc(d)}</div></td>${STAFF_ROLES.map((r) =>
    `<td class="center"><button class="check ${S.rolePerms[r].includes(p) ? "on" : ""}" ${editM && r !== "owner" ? `data-act="perm-toggle" data-role="${r}" data-perm="${p}" title="Alternar"` : "disabled"}></button></td>`).join("")}</tr>`)),
    { cls: "mt", sub: editM ? "Hacé clic en un punto para conceder o quitar el permiso al rol (queda auditado). Excepciones por persona en Ajustes → Usuarios." : "Sólo lectura" });
}

/* ───────── CMS ───────── */
const LEAD_STATUS = { new: ["info", "Nuevo"], contacted: ["warn", "Contactado"], qualified: ["brand", "Calificado"], converted: ["ok", "Convertido"], discarded: ["", "Descartado"] };
const DEPLOY_STATUS = { ready: ["ok", "Publicado"], error: ["crit", "Error"], building: ["warn", "Compilando"], queued: ["info", "En cola"] };
function viewCms() {
  const site = S.sites[0];
  const stats = S.pages.map((p) => ({ p, ...pageStats(p.id) }));
  const views = stats.reduce((a, x) => a + x.views, 0), leads = stats.reduce((a, x) => a + x.leads, 0);
  const ok = S.deployments.filter((d) => d.status === "ready");
  const deps = [...S.deployments].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  return ph("Módulo 6", "Gestor web y CMS", `${esc(site.name)} · ${esc(site.domain)} · ${esc(site.provider)}`,
    (can("cms.write") ? btn("Nueva página", "page-new", { ic: "plus" }) : "") + (can("cms.publish") ? btn("Desplegar sitio", "deploy", { tone: "primary", ic: "rocket" }) : "")) +
  `<div class="grid g4 mb">${kpi("Visitas 30 días", fmt.num(views), "", "brand")}${kpi("Leads 30 días", leads, "", "ok")}${kpi("Conversión", views ? (leads / views * 100).toFixed(2) + " %" : "—", "", "info")}${kpi("Build promedio", ok.length ? Math.round(ok.reduce((a, d) => a + d.durationMs, 0) / ok.length / 1000) + " s" : "—", `${S.deployments.filter((d) => d.status === "error").length} despliegues fallidos`)}</div>` +
  card("Páginas y landings", table(["Página", "Tipo", "Estado", ">Visitas", ">Leads", ">Conv.", "Versión", ""], stats.map(({ p, views, leads }) =>
    `<tr><td><div class="t">${esc(p.title)}</div><div class="s mono">${esc(site.domain)}/${esc(p.slug)}</div></td><td>${pill(p.kind === "landing" ? "brand" : "", p.kind === "landing" ? "Landing" : "Página")}</td>
     <td>${p.status === "published" ? pill(p.dirty ? "warn" : "ok", p.dirty ? "Cambios sin publicar" : "Publicada", true) : pill("", "Borrador", true)}</td>
     <td class="right num">${fmt.num(views)}</td><td class="right num t">${leads}</td><td class="right num">${views ? (leads / views * 100).toFixed(1) + " %" : "—"}</td><td class="xs">v${p.version}${p.publishedAt ? " · " + fmt.rel(p.publishedAt) : ""}</td>
     <td class="right nowrap">${btn("Vista previa", "page-preview", { sm: true, tone: "ghost", ic: "eye", data: { id: p.id } })}${can("cms.write") ? btn("Editar", "page-edit", { sm: true, tone: "ghost", data: { id: p.id } }) : ""}${can("cms.publish") && (p.status !== "published" || p.dirty) ? btn("Publicar", "page-publish", { sm: true, tone: "success", data: { id: p.id } }) : ""}</td></tr>`))) +
  `<div class="grid g2 mt">
    ${card("Despliegues", table(["Commit", "Estado", "Duración", "Por", "Cuándo"], deps.map((d) => `<tr><td class="mono xs t">${d.commit}</td><td>${mapPill(DEPLOY_STATUS, d.status)}</td><td class="num">${d.durationMs ? (d.durationMs / 1000).toFixed(1) + " s" : "—"}</td><td class="xs">${esc(userName(d.by))}</td><td class="xs">${fmt.rel(d.at)}</td></tr>`)))}
    ${card("Leads captados", table(["Contacto", "Origen", "Estado", ""], [...S.leads].sort((a, b) => b.at.localeCompare(a.at)).map((l) =>
      `<tr><td><div class="t">${esc(l.name)}</div><div class="s">${esc(l.company || l.email || l.phone)} · ${fmt.rel(l.at)}</div></td><td class="xs">${esc(db.get("pages", l.pageId)?.title ?? "—")}</td>
       <td>${can("crm.write") && l.status !== "converted" ? `<select class="in" style="height:30px;width:auto" data-act-change="lead-status" data-id="${l.id}">${opts(Object.entries(LEAD_STATUS).filter(([k]) => k !== "converted").map(([k, v]) => [k, v[1]]), l.status)}</select>` : mapPill(LEAD_STATUS, l.status)}</td>
       <td class="right">${can("crm.write") && l.status !== "converted" ? btn("A CRM", "lead-convert", { sm: true, data: { id: l.id } }) : ""}</td></tr>`)), { sub: "Formularios de landing → CRM" })}
  </div>`;
}
function landingHtml(p, interactive = true) {
  const b = p.blocks;
  return `<div class="lp"><div class="lp-hero"><div class="eyebrow">${esc(S.settings.company)}</div><h2>${esc(b.heroTitle)}</h2><p>${esc(b.heroText)}</p></div>
    <div class="lp-feat">${(b.features ?? []).map((f) => `<div>✦ ${esc(f)}</div>`).join("")}</div>
    ${b.leadForm ? `<div class="lp-form" id="lp-form">
      ${field("Nombre *", `<input class="in" id="ld-name">`)}${field("Email", `<input class="in" id="ld-email" type="email">`)}${field("WhatsApp", `<input class="in" id="ld-phone">`)}${field("Empresa", `<input class="in" id="ld-company">`)}${field("Mensaje", `<textarea class="in" id="ld-msg" rows="2"></textarea>`)}
      ${interactive ? btn(esc(b.cta || "Enviar"), "lead-submit", { tone: "primary", data: { id: p.id } }).replace('class="btn', 'class="btn block') : ""}</div>` : ""}
    <div class="center xs subtle" style="padding:0 0 20px">${DEV.name} · WhatsApp ${DEV.wa}</div></div>`;
}
function pageEditor(id) {
  const p = id ? db.get("pages", id) : { title: "", slug: "", kind: "landing", blocks: { heroTitle: "", heroText: "", features: [], cta: "Quiero una demo", leadForm: true } };
  openModal(id ? "Editar página" : "Nueva página", `<div class="fgrid">
    ${field("Título interno *", `<input class="in" name="title" required value="${esc(p.title)}">`)}${field("Slug (URL)", `<input class="in" name="slug" value="${esc(p.slug)}" placeholder="ej. barberias">`)}
    ${field("Tipo", `<select class="in" name="kind">${opts([["landing", "Landing de captación"], ["page", "Página"]], p.kind)}</select>`)}${field("Texto del botón", `<input class="in" name="cta" value="${esc(p.blocks.cta)}">`)}
    ${field("Título principal (hero)", `<input class="in" name="heroTitle" value="${esc(p.blocks.heroTitle)}">`, "", "full")}${field("Bajada", `<textarea class="in" name="heroText" rows="2">${esc(p.blocks.heroText)}</textarea>`, "", "full")}
    ${field("Beneficios (uno por línea)", `<textarea class="in" name="features" rows="3">${esc((p.blocks.features ?? []).join("\n"))}</textarea>`, "", "full")}
    <label class="row small muted full"><input type="checkbox" name="leadForm" ${p.blocks.leadForm ? "checked" : ""}> Incluir formulario de contacto (genera leads)</label></div>`, {
    submit: (f) => { const d = formData(f); savePage({ title: d.title, slug: d.slug.trim(), kind: d.kind, blocks: { heroTitle: d.heroTitle, heroText: d.heroText, features: d.features.split("\n").map((x) => x.trim()).filter(Boolean), cta: d.cta, leadForm: !!d.leadForm } }, id); return id ? "Página guardada (publicá para que se vea)" : "Página creada en borrador"; },
  });
}

/* ───────── SOPORTE ───────── */
const TICKET_STATUS = { open: ["info", "Abierto"], in_progress: ["brand", "En curso"], waiting_client: ["warn", "Esperando cliente"], resolved: ["ok", "Resuelto"], closed: ["", "Cerrado"] };
const PRIORITY = { urgent: ["crit", "Urgente"], high: ["warn", "Alta"], normal: ["info", "Normal"], low: ["", "Baja"] };
const TICKET_CAT = { general: "Problema general", bug: "Error del sistema", consulta: "Consulta", facturacion: "Facturación", nueva_funcion: "Nueva función", upgrade: "Cambio de plan" };
function viewSupport() {
  const f = UI.ticketFilter ?? "active";
  const list = S.tickets.filter((t) => f === "all" || (f === "active" ? ["open", "in_progress", "waiting_client"].includes(t.status) : ["resolved", "closed"].includes(t.status)))
    .sort((a, b) => (a.slaDue ?? "").localeCompare(b.slaDue ?? ""));
  return ph("Mesa de ayuda", "Tickets de soporte", "Abiertos desde el portal de clientes, ordenados por vencimiento de SLA.",
    `<div class="tabs">${[["active", "Activos"], ["done", "Resueltos"], ["all", "Todos"]].map(([k, l]) => `<button data-act="tk-filter" data-id="${k}" class="${f === k ? "on" : ""}">${l}</button>`).join("")}</div>` +
    (can("tickets.manage") ? btn("Nuevo ticket", "tk-new", { tone: "primary", ic: "plus" }) : "")) +
  card("Cola", table(["#", "Asunto", "Cliente", "Prioridad", "Estado", "SLA", "Asignado", ""], list.map((t) => {
    const left = (new Date(t.slaDue) - Date.now()) / 3600e3; const done = ["resolved", "closed"].includes(t.status);
    return `<tr><td class="mono xs">#${t.number}</td><td><div class="t">${esc(t.subject)} ${t.category === "upgrade" ? pill("brand", "Upgrade") : ""}</div><div class="s">${TICKET_CAT[t.category]} · ${fmt.rel(t.at)}</div></td><td>${esc(clientName(t.clientId))}</td>
      <td>${mapPill(PRIORITY, t.priority)}</td><td>${mapPill(TICKET_STATUS, t.status)}</td><td>${done ? '<span class="subtle">—</span>' : pill(left < 0 ? "crit" : left < 4 ? "warn" : "ok", left < 0 ? "Vencido" : left.toFixed(1) + " h")}</td>
      <td class="xs">${esc(t.assignedTo ? userName(t.assignedTo) : "—")}</td><td class="right">${btn("Abrir", "tk-open", { sm: true, data: { id: t.id } })}</td></tr>`;
  })));
}
function ticketModal(id) {
  const t = db.get("tickets", id); const portal = isPortalUser();
  const msgs = S.ticketMessages.filter((m) => m.ticketId === id && (!portal || !m.internal)).sort((a, b) => a.at.localeCompare(b.at));
  const me = currentUser().id;
  openModal(`#${t.number} · ${esc(t.subject)}`, `
    <div class="row wrap mb">${mapPill(TICKET_STATUS, t.status)}${mapPill(PRIORITY, t.priority)}${pill("", TICKET_CAT[t.category])}<span class="xs subtle">${esc(clientName(t.clientId))} · ${fmt.dt(t.at)}</span></div>
    ${!portal && can("tickets.manage") ? `<div class="row wrap mb"><select class="in" style="width:auto;height:30px" id="tk-status">${opts(Object.entries(TICKET_STATUS).map(([k, v]) => [k, v[1]]), t.status)}</select>
      <select class="in" style="width:auto;height:30px" id="tk-assign">${opts([["", "Sin asignar"], ...S.users.filter((u) => STAFF_ROLES.includes(u.role) && u.active).map((u) => [u.id, u.name])], t.assignedTo)}</select>${btn("Actualizar", "tk-update", { sm: true, data: { id } })}</div>` : ""}
    <div class="bubble"><div class="xs subtle">${esc(userName(t.openedBy))} · descripción</div>${esc(t.description)}</div>
    ${msgs.map((m) => `<div class="bubble ${m.internal ? "internal" : m.authorId === me ? "mine" : ""}"><div class="xs subtle">${esc(userName(m.authorId))} · ${fmt.dt(m.at)}${m.internal ? " · NOTA INTERNA (el cliente no la ve)" : ""}</div>${esc(m.body)}</div>`).join("")}
    ${t.status !== "closed" && (portal || can("tickets.manage")) ? `<textarea class="in" id="tk-msg" rows="3" placeholder="Escribí una respuesta…"></textarea>
      <div class="row between" style="margin-top:10px">${!portal ? `<label class="row small muted"><input type="checkbox" id="tk-internal"> Nota interna</label>` : "<span></span>"}${btn("Enviar", "tk-reply", { tone: "primary", sm: true, ic: "send", data: { id } })}</div>` : ""}`, { wide: true, footer: "" });
}
function newTicketForm(clientId = null) {
  return `${clientId ? `<input type="hidden" name="clientId" value="${clientId}">` : field("Cliente", `<select class="in" name="clientId">${opts(S.clients.map((c) => [c.id, c.tradeName || c.legalName]))}</select>`)}
    ${field("Asunto", `<input class="in" name="subject" required placeholder="Ej.: no puedo emitir facturas">`)}
    <div class="fgrid">${field("Tipo", `<select class="in" name="category">${opts(Object.entries(TICKET_CAT).filter(([k]) => k !== "upgrade"))}</select>`)}${field("Urgencia", `<select class="in" name="priority">${opts([["low", "Baja"], ["normal", "Normal"], ["high", "Alta"], ["urgent", "Urgente · sistema detenido"]], "normal")}</select>`)}</div>
    ${field("Descripción", `<textarea class="in" name="description" rows="4" placeholder="Contanos qué pasó y desde cuándo"></textarea>`)}`;
}

/* ───────── AUDITORÍA ───────── */
const TABLE_LABEL = { movements: "Caja · movimientos", documents: "Comprobantes", sessions: "Sesiones de caja", contracts: "Contratos", contractVersions: "Versiones de contrato", subscriptions: "Suscripciones", subChanges: "Cambios de plan", clients: "Clientes", users: "Usuarios", rolePerms: "Permisos por rol", commissions: "Comisiones", employees: "Equipo", goals: "Metas", pages: "Páginas", alerts: "Alertas", resources: "Recursos", tickets: "Tickets", leads: "Leads", interactions: "Interacciones", plans: "Planes", alertRules: "Reglas", deployments: "Despliegues", sites: "Sitios", system: "Sistema" };
function auditTable(events) {
  const tone = { INSERT: "ok", UPDATE: "warn", DELETE: "crit" };
  return table(["#", "Fecha y hora", "Usuario", "Acción", "Entidad", ">Monto", "Método", "Huella"], events.map((e) => `<tr>
    <td class="mono xs">${e.id}</td><td class="xs num nowrap">${fmt.dt(e.ts)}</td><td><div class="t">${esc(e.actorName)}</div><div class="s">${ROLES[e.actorRole] ?? e.actorRole}</div></td>
    <td>${pill(tone[e.action] ?? "info", e.action)}</td><td class="xs">${esc(TABLE_LABEL[e.table] ?? e.table)}${e.changed?.length ? `<div class="s">Δ ${esc(e.changed.filter((c) => c !== "updatedAt").join(", "))}</div>` : ""}</td>
    <td class="right num t">${e.amount != null ? fmt.money(e.amount, true) : "—"}</td><td class="xs">${e.method ? METHODS[e.method] ?? e.method : "—"}</td><td class="hash" title="${e.hash}">${e.hash.slice(0, 12)}…</td></tr>`));
}
function viewAudit() {
  const v = verifyAudit();
  const f = UI.auditFilter;
  const ev = S.audit.filter((e) => !f || e.table === f).slice(-300).reverse();
  const tables = [...new Set(S.audit.map((e) => e.table))];
  return ph("Seguridad", "Pista de auditoría", "Registro append-only: cada evento se encadena con SHA-256 al anterior. Cualquier alteración rompe la cadena.",
    `<select class="in" style="width:auto" data-act-change="audit-filter">${opts([["", "Todas las entidades"], ...tables.map((t) => [t, TABLE_LABEL[t] ?? t])], f)}</select>${btn("Exportar CSV", "audit-csv", { ic: "download" })}`) +
  `<div class="card row mb" style="padding:16px 20px;box-shadow:inset 0 0 0 1px ${v.ok ? "rgba(34,227,155,.3)" : "rgba(255,77,106,.45)"}">
    <span class="${v.ok ? "t-ok" : "t-crit"}" style="width:30px">${icon("shield")}</span>
    <div><div class="b ${v.ok ? "t-ok" : "t-crit"}">${v.ok ? "Integridad verificada" : `Cadena rota en el evento #${v.id}`}</div><div class="xs muted">${v.ok ? `${fmt.num(v.count)} eventos recalculados sin diferencias.` : v.reason}</div></div>
    ${btn("Verificar ahora", "audit-verify", { sm: true, tone: "ghost" }).replace('class="btn', 'style="margin-left:auto" class="btn')}</div>` +
  card(`Eventos (${ev.length}${ev.length === 300 ? "+" : ""})`, auditTable(ev));
}

/* ───────── AJUSTES ───────── */
function viewSettings() {
  const st = S.settings, tg = st.telegram;
  return ph("Configuración", "Ajustes", "Empresa, usuarios y excepciones de permisos, notificaciones por Telegram y respaldo de datos.") +
  `<div class="grid g2">
    ${card("Empresa y monitoreo", `<div class="card-b"><div class="fgrid">
      ${field("Nombre", `<input class="in" id="st-company" value="${esc(st.company)}">`)}${field("CUIT", `<input class="in" id="st-cuit" value="${esc(st.cuit)}">`)}
      ${field("Intervalo de heartbeat (s)", `<input class="in" id="st-hb" type="number" min="2" max="60" value="${st.heartbeatSec}">`)}
      <label class="row small muted" style="margin-top:22px"><input type="checkbox" id="st-sim" ${st.simulate ? "checked" : ""}> Simular telemetría (sin agentes reales)</label></div>
      ${btn("Guardar", "st-save", { tone: "primary", sm: true })}</div>`)}
    ${card("Alertas por Telegram", `<div class="card-b">
      ${field("Token del bot", `<input class="in mono" id="tg-token" type="password" value="${esc(tg.token)}" placeholder="123456:ABC…">`, "Crealo con @BotFather. Se guarda sólo en este navegador.")}
      <div class="fgrid">${field("Chat ID", `<input class="in mono" id="tg-chat" value="${esc(tg.chatId)}" placeholder="-100… o tu ID">`)}${field("Severidad mínima", `<select class="in" id="tg-min">${opts([["info", "Info"], ["warning", "Advertencia"], ["critical", "Crítica"]], tg.minSeverity)}</select>`)}</div>
      <label class="row small muted mb"><input type="checkbox" id="tg-on" ${tg.enabled ? "checked" : ""}> Activar envío</label>
      <div class="row">${btn("Guardar", "tg-save", { tone: "primary", sm: true })}${btn("Enviar prueba", "tg-test", { sm: true })}</div></div>`)}
  </div>` +
  card("Usuarios y accesos", table(["Usuario", "Rol", "Empresa", "Excepciones", "Estado", ""], S.users.map((u) => `<tr><td><div class="t">${esc(u.name)}</div><div class="s">${esc(u.email)}</div></td><td>${ROLES[u.role]}</td>
    <td>${u.clientId ? esc(clientName(u.clientId)) : '<span class="subtle">Interno</span>'}</td><td class="xs">${Object.entries(u.overrides ?? {}).map(([p, g]) => pill(g ? "ok" : "crit", (g ? "+" : "−") + p)).join(" ") || "—"}</td>
    <td>${u.active ? pill("ok", "Activo") : pill("", "Inactivo")}</td><td class="right">${btn("Editar", "user-edit", { sm: true, data: { id: u.id } })}</td></tr>`)),
    { cls: "mt", action: btn("Nuevo usuario", "user-new", { sm: true, tone: "primary", ic: "plus" }) }) +
  card("Respaldo de datos", `<div class="card-b row wrap">
    ${btn("Exportar respaldo (JSON)", "data-export", { ic: "download" })}
    <label class="btn outline">${icon("upload")}Importar respaldo<input type="file" id="data-import" accept="application/json" hidden></label>
    ${btn("Empezar con mis datos (borrar demo)", "data-fresh", { tone: "danger" })}
    ${btn("Restablecer datos de demostración", "data-reset", { tone: "danger" })}
    <p class="xs subtle" style="flex-basis:100%">Los datos viven en este navegador (localStorage + IndexedDB para los PDF). Exportá un respaldo periódicamente. El respaldo JSON no incluye los PDF.</p></div>`, { cls: "mt" });
}
function userForm(u = {}) {
  return `<div class="fgrid">${field("Nombre *", `<input class="in" name="name" value="${esc(u.name)}">`)}${field("Email *", `<input class="in" name="email" type="email" value="${esc(u.email)}">`)}
    ${field("Rol", `<select class="in" name="role">${opts(Object.entries(ROLES), u.role ?? "employee")}</select>`)}
    ${field("Empresa (sólo roles cliente)", `<select class="in" name="clientId">${opts([["", "—"], ...S.clients.map((c) => [c.id, c.tradeName || c.legalName])], u.clientId)}</select>`)}
    ${field(u.pinHash ? "PIN de ingreso (dejar vacío para mantener)" : "PIN de ingreso (opcional)", `<input class="in" name="pin" type="password" inputmode="numeric" autocomplete="new-password" placeholder="4 a 8 dígitos">`, u.pinHash ? `<label class="small muted"><input type="checkbox" name="pinClear"> Quitar PIN</label>` : "Si lo cargás, se pide al ingresar con este perfil.")}
    <label class="row small muted full"><input type="checkbox" name="active" ${u.active !== false ? "checked" : ""}> Usuario activo</label></div>
    ${u.id && STAFF_ROLES.includes(u.role) ? `<div class="eyebrow" style="margin:16px 0 8px">Excepciones de permisos (sobre el rol)</div>
      <div class="tw card"><table><tbody>${PERMS.map(([p, d]) => { const rp = S.rolePerms[u.role].includes(p); const ov = u.overrides?.[p];
        return `<tr><td><span class="mono xs t">${p}</span><div class="s">${esc(d)}</div></td><td class="xs">${rp ? "Por rol: sí" : "Por rol: no"}</td>
        <td class="right"><select class="in" style="height:28px;width:auto" name="ov:${p}">${opts([["", "Heredar"], ["1", "Conceder"], ["0", "Revocar"]], ov === true ? "1" : ov === false ? "0" : "")}</select></td></tr>`; }).join("")}</tbody></table></div>` : ""}`;
}

/* ───────── PORTAL DEL CLIENTE ───────── */
function viewPortal() {
  const u = currentUser(), cid = u.clientId, c = db.get("clients", cid);
  const services = S.resources.filter((r) => r.active && r.clientId === cid);
  const allOk = services.every((r) => ["operational", "maintenance"].includes(r.status));
  const ctr = S.contracts.filter((k) => k.clientId === cid && ["signed", "expired"].includes(k.status)).sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))[0];
  const s = activeSub(cid), p = planOf(s); const up = p && !p.ai ? S.plans.find((x) => x.ai && x.active) : null;
  const invoices = S.documents.filter((d) => d.clientId === cid && d.type !== "ticket").sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const tickets = S.tickets.filter((t) => t.clientId === cid).sort((a, b) => b.at.localeCompare(a.at));
  const days = ctr ? fmt.daysUntil(ctr.endDate) : null;
  const pendingUp = S.tickets.some((t) => t.clientId === cid && t.category === "upgrade" && !["resolved", "closed"].includes(t.status));
  return `<header class="top" style="position:sticky"><div class="logo" style="margin:0;padding:0"><div class="logo-mark">VB</div><div><b>Portal de clientes</b><span>${esc(S.settings.company)}</span></div></div>
    <div class="top-right"><div class="who"><b>${esc(u.name)}</b><span>${ROLES[u.role]}</span></div><button class="iconbtn" data-act="logout" title="Salir">${icon("logout")}</button></div></header>
  <main class="content" style="max-width:1020px" id="view" data-route="portal">
    <h1 style="font-size:24px">${esc(c.tradeName || c.legalName)}</h1><p class="muted" style="margin:4px 0 22px">Estado de tu servicio, contrato, facturas y soporte.</p>
    <div class="card mb" style="box-shadow:inset 0 0 0 1px ${allOk ? "rgba(34,227,155,.28)" : "rgba(255,197,61,.35)"}">
      <div class="row" style="padding:20px 24px;gap:16px"><span class="sdot ${allOk ? "" : "pulse"} t-${allOk ? "ok" : "warn"}" style="width:16px;height:16px"></span>
        <div><div class="b ${allOk ? "t-ok" : "t-warn"}" style="font-size:17px">${allOk ? "Todos tus servicios funcionan correctamente" : "Estamos trabajando en un inconveniente"}</div><div class="xs subtle">Monitoreo 24/7 · actualizado ${fmt.dt(nowISO())}</div></div></div>
      <div class="grid g2" style="gap:1px;background:var(--line2)">${services.map((r) => `<div class="row" style="background:var(--ink-850);padding:12px 24px">${sdot(HEALTH[r.status][0])}<span class="grow">${esc(r.publicName || r.name)}</span><span class="xs subtle num">${uptime30(r).toFixed(2).replace(".", ",")} % · 30 d</span>${mapPill(HEALTH, r.status, false)}</div>`).join("") || '<div class="empty" style="background:var(--ink-850)">Sin servicios monitoreados</div>'}</div>
    </div>
    <div class="grid g2 mb">
      ${card("Mi contrato", ctr ? `<div class="card-b"><div class="row between"><b>${esc(ctr.title)}</b>${mapPill(CONTRACT_STATUS, ctr.status)}</div>
        <div class="fgrid small muted" style="margin-top:12px"><div>Código<div class="mono" style="color:var(--fg)">${ctr.code}</div></div><div>Vigencia<div style="color:var(--fg)">${fmt.date(ctr.startDate)} → ${fmt.date(ctr.endDate)}</div></div></div>
        <div class="row" style="margin-top:12px">${days != null && days >= 0 && days <= 30 ? pill("warn", `Renovación en ${days} días`, true) : ""}${ctr.currentVersionId ? btn("Descargar PDF firmado", "ctr-dl", { sm: true, tone: "ghost", ic: "download", data: { id: ctr.currentVersionId } }) : ""}</div></div>` : `<div class="empty">Sin contrato vigente</div>`)}
      ${card("Mi plan", `<div class="card-b">${p ? `<div class="row between"><b>${esc(p.name)}</b><span class="num b" style="font-size:20px">${fmt.money(subPrice(s))}<span class="xs subtle"> /mes</span></span></div>` : '<p class="subtle">Sin plan activo</p>'}
        ${up ? `<div class="card" style="padding:16px;margin-top:14px;background:rgba(124,140,255,.06);box-shadow:inset 0 0 0 1px rgba(124,140,255,.25)"><b>Sumá automatizaciones e IA</b><p class="xs muted" style="margin:6px 0 12px">${up.features.slice(1).map(esc).join(" · ")} — ${fmt.money(up.price)}/mes</p>
          ${pendingUp ? pill("info", "Solicitud enviada · tu ejecutivo te contactará", true) : u.role === "client_admin" ? btn(`Quiero pasar a ${esc(up.name)}`, "portal-upgrade", { tone: "primary", ic: "spark", data: { id: up.id } }).replace('class="btn', 'class="btn block') : '<p class="xs subtle">Pedile al administrador de tu empresa que lo solicite.</p>'}</div>` : ""}</div>`)}
    </div>
    ${card("Mis facturas y recibos", table(["Comprobante", "Fecha", "CAE", ">Total", ""], invoices.map((d) => `<tr><td class="mono small t">${docLabel(d)} ${d.status === "voided" ? pill("crit", "Anulado") : ""}</td><td class="xs">${fmt.date(d.issuedAt)}</td><td class="xs mono">${d.cae ?? "—"}</td><td class="right num b">${fmt.money(d.total, true)}</td><td class="right">${btn("", "doc-print", { sm: true, tone: "ghost", ic: "print", data: { id: d.id } })}</td></tr>`), "Todavía no hay comprobantes"), { cls: "mb" })}
    <div class="grid g2">
      ${card("Mis tickets", `<ul class="list">${tickets.length ? tickets.map((t) => `<li class="row" style="cursor:pointer" data-act="tk-open" data-id="${t.id}"><span class="mono xs subtle">#${t.number}</span><span class="grow small" style="color:var(--fg)">${esc(t.subject)}</span><span class="xs subtle">${fmt.rel(t.at)}</span>${mapPill(TICKET_STATUS, t.status)}</li>`).join("") : '<li class="empty">No tenés tickets</li>'}</ul>`)}
      ${card("Abrir un ticket", `<div class="card-b"><form id="portal-ticket">${newTicketForm(cid)}<button class="btn primary block" type="submit">${icon("send")}Enviar ticket</button></form></div>`, { sub: "Respuesta según urgencia: 4 h a 5 días" })}
    </div>
    <p class="xs subtle center" style="margin-top:28px">¿Necesitás ayuda urgente? WhatsApp ${DEV.wa} · ${DEV.email}</p>
  </main>`;
}

/* ───────── BÚSQUEDA Y NOTIFICACIONES ───────── */
function viewSearch() {
  const q = UI.search.toLowerCase();
  const hit = (...v) => v.some((x) => String(x ?? "").toLowerCase().includes(q));
  const cl = can("crm.read") ? S.clients.filter((c) => hit(c.legalName, c.tradeName, c.taxId, c.email)) : [];
  const ct = can("docs.read") ? S.contracts.filter((c) => hit(c.code, c.title, clientName(c.clientId))) : [];
  const dc = can("pos.operate") ? S.documents.filter((d) => hit(docLabel(d), d.customerName)) : [];
  const tk = can("tickets.read") ? S.tickets.filter((t) => hit(t.subject, "#" + t.number, clientName(t.clientId))) : [];
  const sec = (t, items) => items.length ? card(t, `<ul class="list">${items.join("")}</ul>`, { cls: "mb" }) : "";
  return ph("Búsqueda", `Resultados para “${esc(UI.search)}”`, `${cl.length + ct.length + dc.length + tk.length} coincidencias`, btn("Limpiar", "search-clear")) +
    sec("Clientes", cl.map((c) => `<li class="row between"><span>${esc(c.tradeName || c.legalName)} <span class="xs subtle">${esc(c.taxId)}</span></span>${btn("Ficha", "client-open", { sm: true, data: { id: c.id } })}</li>`)) +
    sec("Contratos", ct.map((c) => `<li class="row between"><span class="mono small">${c.code}</span><span class="grow small" style="margin-left:10px">${esc(clientName(c.clientId))}</span>${btn("Abrir", "ctr-open", { sm: true, data: { id: c.id } })}</li>`)) +
    sec("Comprobantes", dc.map((d) => `<li class="row between"><span class="mono small">${docLabel(d)}</span><span>${esc(d.customerName)} · ${fmt.money(d.total, true)}</span>${btn("", "doc-print", { sm: true, tone: "ghost", ic: "print", data: { id: d.id } })}</li>`)) +
    sec("Tickets", tk.map((t) => `<li class="row between"><span>#${t.number} ${esc(t.subject)}</span>${btn("Abrir", "tk-open", { sm: true, data: { id: t.id } })}</li>`)) ||
    `<div class="card empty">Sin resultados</div>`;
}
function viewNotifications() {
  const ns = S.notifications.slice(0, 40);
  return `<div class="card drawer"><div class="card-h"><h3>Notificaciones</h3>${btn("Marcar leídas", "notif-read", { sm: true, tone: "ghost" })}</div>
    <ul class="list">${ns.length ? ns.map((n) => `<li style="${n.read ? "opacity:.55" : ""}"><a href="${n.link || "#"}" data-act="notif-go" style="color:inherit;display:block"><div class="row">${mapPill(SEV, n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "info")}<span class="xs subtle" style="margin-left:auto">${fmt.rel(n.at)}</span></div>
      <div class="small" style="margin-top:6px;color:var(--fg)">${esc(n.title)}</div>${n.body ? `<div class="xs subtle">${esc(n.body)}</div>` : ""}</a></li>`).join("") : '<li class="empty">Sin notificaciones</li>'}</ul></div>`;
}
</script>
