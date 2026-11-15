<script>
/* ════════════════════════════════════════════════════════════════════════════
   IMPRESOS CON LA MARCA VINCULAR BUSINESS
   Ticket / comprobante (80 mm), ficha de cliente (A4), contrato de servicio (A4)
   y tarjetas de los dueños (85 × 55 mm). Todos comparten encabezado, logo y pie.
   ════════════════════════════════════════════════════════════════════════════ */
const VB_LOGO = (fondo = "#0b0b0c", v = "#ffffff") => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="64" height="64" rx="14" fill="${fondo}"/><g transform="translate(9,16) scale(.36)"><path d="M8 20 L38 80 L68 20" fill="none" stroke="${v}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><g fill="none" stroke="#FF7A1A" stroke-width="9" stroke-linecap="round"><path d="M82 18a22 22 0 0 1 0 26"/><path d="M97 7a40 40 0 0 1 0 48"/></g></g></svg>`;
const VB_WEB = "vincularbusiness.com.ar";

const VB_CSS = `
*{box-sizing:border-box}body{margin:0;font-family:Manrope,"Segoe UI",Arial,sans-serif;color:#111214;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.barra{position:sticky;top:0;display:flex;justify-content:center;gap:8px;padding:10px;background:#f2f2ef;border-bottom:1px solid #ddd}
.barra button{font:700 13px Manrope,Arial,sans-serif;padding:9px 18px;border-radius:999px;border:0;background:#FF7A1A;color:#140800;cursor:pointer}
@media print{.barra{display:none}}
.marca{display:flex;align-items:center;gap:10px}.marca svg{width:44px;height:44px;flex:none}
.marca b{display:block;font-size:17px;letter-spacing:-.02em}.marca span{display:block;font-size:10.5px;color:#5b616c}
.naranja{color:#C2410C}.mut{color:#5b616c}.sm{font-size:11px}
table{width:100%;border-collapse:collapse}
/* hoja A4 */
.a4{width:210mm;min-height:297mm;margin:0 auto;padding:16mm 16mm 14mm;background:#fff;display:flex;flex-direction:column}
@page{margin:0}
.a4 .cab{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid #FF7A1A}
.a4 .cab .dato{text-align:right;font-size:10.5px;line-height:1.5;color:#5b616c}
.a4 h1{font-size:22px;letter-spacing:-.02em;margin:18px 0 4px}
.a4 h2{font-size:12.5px;text-transform:uppercase;letter-spacing:.08em;color:#C2410C;margin:18px 0 8px}
.a4 p,.a4 li{font-size:11.5px;line-height:1.6}
.a4 .grilla{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}
.a4 .campo{border:1px solid #e3e3de;border-radius:8px;padding:7px 10px}
.a4 .campo small{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#80868f}
.a4 .campo div{font-size:12px;font-weight:600;min-height:16px}
.a4 th{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#80868f;text-align:left;border-bottom:1px solid #e3e3de;padding:6px 6px}
.a4 td{font-size:11px;padding:6px;border-bottom:1px solid #f0f0ec;vertical-align:top}
.a4 .firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:auto;padding-top:46px}
.a4 .firmas div{border-top:1px solid #111;padding-top:6px;font-size:10.5px;text-align:center}
.a4 .pie{margin-top:18px;padding-top:8px;border-top:1px solid #e3e3de;display:flex;justify-content:space-between;font-size:9.5px;color:#80868f}
.a4 ol{padding-left:18px;margin:0}.a4 ol li{margin-bottom:6px}
.linea{display:inline-block;min-width:150px;border-bottom:1px solid #999}
/* ticket 80 mm */
.tk{width:76mm;margin:0 auto;padding:5mm 3mm;font-size:11px;background:#fff}
.tk .marca{flex-direction:column;text-align:center;gap:4px}.tk .marca svg{width:40px;height:40px}
.tk .tipo{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0;padding:6px;border:1.5px solid #111;border-radius:6px;font-weight:800}
.tk .letra{display:grid;place-items:center;width:22px;height:22px;border-radius:4px;background:#111;color:#fff;font-size:13px}
.tk hr{border:0;border-top:1px dashed #999;margin:8px 0}
.tk td{padding:2px 0;vertical-align:top}.tk .r{text-align:right;white-space:nowrap}
.tk .total td{font-size:15px;font-weight:800;padding-top:4px}
.tk .c{text-align:center}
.tk .anulado{margin:8px 0;padding:6px;border:2px solid #b42318;color:#b42318;font-weight:800;text-align:center}
.tk .gracias{margin-top:6px;font-weight:700}
/* tarjetas 85 × 55 mm */
.hoja-t{display:flex;flex-wrap:wrap;gap:6mm;justify-content:center;padding:10mm}
@media print{.tj{break-inside:avoid;page-break-inside:avoid}}
.tj{width:85mm;height:55mm;border-radius:3mm;overflow:hidden;position:relative;box-shadow:0 0 0 .2mm #ccc}
.tj.frente{background:#0b0b0c;color:#fff;padding:6mm;display:flex;flex-direction:column}
.tj.frente .marca svg{width:11mm;height:11mm}.tj.frente .marca b{font-size:12px}.tj.frente .marca span{color:#a0a8b5;font-size:8px}
.tj.frente .nom{margin-top:auto;font-size:15px;font-weight:800;letter-spacing:-.02em}
.tj.frente .rol{font-size:9px;color:#FF7A1A;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3mm}
.tj.frente .dat{font-size:8.5px;line-height:1.55;color:#d9dde3}
.tj.frente::after{content:"";position:absolute;right:-12mm;top:-12mm;width:36mm;height:36mm;border-radius:50%;background:radial-gradient(circle,rgba(255,122,26,.35),transparent 70%)}
.tj.dorso{background:#FF7A1A;display:grid;place-items:center;text-align:center;color:#140800}
.tj.dorso svg{width:20mm;height:20mm}.tj.dorso b{display:block;margin-top:2mm;font-size:13px}.tj.dorso span{font-size:8.5px;font-weight:600}
`;

function vbAbrir(titulo, cuerpo, { ancho = 900 } = {}) {
  const html = `<!DOCTYPE html><html lang="es-AR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>${VB_CSS}</style></head><body><div class="barra"><button onclick="print()">Imprimir o guardar en PDF</button></div>${cuerpo}</body></html>`;
  let w = null;
  try { w = window.open("", "_blank", `width=${ancho},height=900`); } catch { w = null; }
  if (w && w.document) { w.document.write(html); w.document.close(); }
  else openModal(esc(titulo), `<iframe id="doc-frame" title="${esc(titulo)}" style="width:100%;height:600px;border:0;border-radius:12px;background:#fff" srcdoc="${esc(html)}"></iframe>`, { wide: true, footer: `<div class="modal-f"><button type="button" class="btn primary" onclick="try{document.getElementById('doc-frame').contentWindow.print()}catch(e){}">Imprimir</button></div>` });
}

const vbEmpresa = () => S.settings.company || DEV.name;
const vbCabeceraA4 = (titulo, sub) => `<div class="cab"><div class="marca">${VB_LOGO()}<div><b>${esc(vbEmpresa())}</b><span>Sistemas de gestión · Salta, Argentina</span></div></div>
  <div class="dato">${S.settings.cuit ? "CUIT " + esc(S.settings.cuit) + "<br>" : ""}WhatsApp ${esc(DEV.wa)}<br>${esc(DEV.email)}<br>${VB_WEB}</div></div>
  <h1>${titulo}</h1>${sub ? `<div class="mut sm">${sub}</div>` : ""}`;
const vbPieA4 = (ref) => `<div class="pie"><span>${esc(vbEmpresa())} · ${VB_WEB}</span><span>${esc(ref)} · emitido el ${fmt.date(nowISO())}</span></div>`;
const vbCampo = (k, v) => `<div class="campo"><small>${esc(k)}</small><div>${v ? esc(v) : "&nbsp;"}</div></div>`;

/* ───── 1. Ticket / comprobante ───── */
printDocument = function (id) {
  const d = db.get("documents", id);
  const rel = d.relatedId ? db.get("documents", d.relatedId) : null;
  const letra = { invoice_a: "A", invoice_b: "B", invoice_c: "C" }[d.type] || "X";
  const pagos = S.movements.filter((m) => m.documentId === d.id && !m.reversesId);
  const cuerpo = `<div class="tk">
    <div class="marca">${VB_LOGO()}<div><b>${esc(vbEmpresa())}</b><span>${S.settings.cuit ? "CUIT " + esc(S.settings.cuit) + " · " : ""}Salta, Argentina</span><span>WhatsApp ${esc(DEV.wa)} · ${VB_WEB}</span></div></div>
    <div class="tipo"><span class="letra">${letra}</span><span>${esc(DOC_TYPES[d.type])}<br><small>Nº ${fmt.docNo(d.pos, d.number)}</small></span></div>
    <table><tr><td>Fecha</td><td class="r">${fmt.dt(d.issuedAt)}</td></tr>
      <tr><td>Cliente</td><td class="r">${esc(d.customerName)}</td></tr>
      ${d.customerTaxId ? `<tr><td>CUIT</td><td class="r">${esc(d.customerTaxId)}</td></tr>` : ""}</table>
    ${d.status === "voided" ? `<div class="anulado">ANULADO · ${esc(d.voidReason)}</div>` : ""}<hr>
    <table>${d.items.map((i) => `<tr><td>${esc(i.desc)}<br><small class="mut">${i.qty} × ${fmt.money(i.price, true)} · IVA ${i.tax}%</small></td><td class="r">${fmt.money(r2(i.qty * i.price), true)}</td></tr>`).join("")}</table><hr>
    <table><tr><td>Neto</td><td class="r">${fmt.money(d.net, true)}</td></tr><tr><td>IVA</td><td class="r">${fmt.money(d.tax, true)}</td></tr>
      <tr class="total"><td>TOTAL</td><td class="r">${fmt.money(d.total, true)}</td></tr>
      ${d.depositApplied ? `<tr><td>Seña aplicada ${rel ? fmt.docNo(rel.pos, rel.number) : ""}</td><td class="r">−${fmt.money(d.depositApplied, true)}</td></tr><tr><td><b>Saldo cobrado</b></td><td class="r"><b>${fmt.money(r2(d.total - d.depositApplied), true)}</b></td></tr>` : ""}
      ${d.type === "credit_note" && rel ? `<tr><td colspan="2">Anula ${esc(docLabel(rel))}</td></tr>` : ""}</table><hr>
    <table><tr><td>Pago</td><td class="r">${pagos.map((m) => `${METHODS[m.method]} ${fmt.money(Math.abs(m.amount), true)}`).join("<br>") || "—"}</td></tr>
      <tr><td>Atendió</td><td class="r">${esc(userName(d.issuedBy))}</td></tr>
      <tr><td>CAE</td><td class="r">${d.cae ? esc(d.cae) : "Comprobante interno"}</td></tr></table><hr>
    <div class="c gracias">${d.type === "deposit_receipt" ? "Recibo de seña: se descuenta del comprobante final." : "¡Gracias por elegirnos!"}</div>
    <div class="c sm mut">Soporte: ${VB_WEB}</div></div>`;
  vbAbrir(docLabel(d), cuerpo, { ancho: 420 });
  audit("PRINT", "documents", id, null, { label: docLabel(d) }); save();
};

/* ───── 2. Ficha del cliente ───── */
function printClientFicha(id) {
  const c = db.get("clients", id), s = activeSub(id), p = s ? planOf(s) : null;
  const res = S.resources.filter((r) => r.clientId === id);
  const ints = S.interactions.filter((i) => i.clientId === id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const cuerpo = `<div class="a4">${vbCabeceraA4("Ficha de cliente", esc(c.tradeName || c.legalName))}
    <h2>Datos de la empresa</h2>
    <div class="grilla">${vbCampo("Razón social", c.legalName)}${vbCampo("Nombre comercial", c.tradeName)}${vbCampo("CUIT", c.taxId)}${vbCampo("Condición frente al IVA", c.taxCondition)}
      ${vbCampo("Rubro", c.industry)}${vbCampo("Ciudad", c.city)}${vbCampo("Dirección", c.address)}${vbCampo("Estado", (CLIENT_STATUS[c.status] || [c.status])[1] || c.status)}</div>
    <h2>Contacto</h2>
    <div class="grilla">${vbCampo("Email", c.email)}${vbCampo("Teléfono / WhatsApp", c.phone)}${vbCampo("Sitio o sistema", c.web)}${vbCampo("Responsable en Vincular Business", userName(c.ownerId))}</div>
    <h2>Servicio contratado</h2>
    <div class="grilla">${vbCampo("Plan", p ? p.name : "")}${vbCampo("Precio mensual", s ? fmt.money(subPrice(s)) : "")}${vbCampo("Desde", s ? fmt.date(s.startedAt) : "")}${vbCampo("Alta como cliente", fmt.date(c.createdAt))}</div>
    <h2>Sistemas y servicios</h2>
    <table><thead><tr><th>Servicio</th><th>Tipo</th><th>Dirección</th><th>Estado</th></tr></thead><tbody>
      ${res.length ? res.map((r) => `<tr><td><b>${esc(r.publicName || r.name)}</b></td><td>${esc(r.kind)}</td><td>${esc(r.endpoint || "")}</td><td>${r.status === "operational" ? "En línea" : esc(r.status || "")}</td></tr>`).join("") : `<tr><td colspan="4" class="mut">Sin sistemas cargados</td></tr>`}</tbody></table>
    ${c.notes ? `<h2>Notas</h2><p>${esc(c.notes)}</p>` : ""}
    <h2>Historial reciente</h2>
    <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Asunto</th></tr></thead><tbody>
      ${ints.length ? ints.map((i) => `<tr><td>${fmt.date(i.at)}</td><td>${esc(INT_KIND[i.kind] || i.kind)}</td><td>${esc(i.subject)}${i.body ? `<br><span class="mut">${esc(i.body)}</span>` : ""}</td></tr>`).join("") : `<tr><td colspan="3" class="mut">Sin registros</td></tr>`}</tbody></table>
    ${vbPieA4("Ficha " + (c.tradeName || c.legalName))}</div>`;
  vbAbrir("Ficha · " + (c.tradeName || c.legalName), cuerpo);
  audit("PRINT", "clients", id, null, { label: "Ficha de cliente" }); save();
}

/* ───── 3. Contrato de servicio ───── */
function printContrato(id) {
  const c = db.get("clients", id), s = activeSub(id), p = s ? planOf(s) : null;
  const res = S.resources.filter((r) => r.clientId === id);
  const L = (v) => v ? `<b>${esc(v)}</b>` : `<span class="linea">&nbsp;</span>`;
  const cuerpo = `<div class="a4">${vbCabeceraA4("Contrato de suscripción y servicio", "Sistema de gestión Vincular Business")}
    <p style="margin-top:14px">En la ciudad de Salta, a los <span class="linea" style="min-width:40px">&nbsp;</span> días del mes de <span class="linea" style="min-width:90px">&nbsp;</span> de ${new Date().getFullYear()}, entre <b>${esc(vbEmpresa())}</b>${S.settings.cuit ? ", CUIT " + esc(S.settings.cuit) : ", CUIT " + L("")}, con domicilio en ${L("")} (en adelante, «el Proveedor»), y ${L(c.legalName)}${c.tradeName && c.tradeName !== c.legalName ? " («" + esc(c.tradeName) + "»)" : ""}, CUIT ${L(c.taxId)}, con domicilio en ${L(c.address)} (en adelante, «el Cliente»), acuerdan lo siguiente:</p>
    <ol>
      <li><b>Objeto.</b> El Proveedor brinda al Cliente el uso del sistema de gestión Vincular Business${res.length ? " y los servicios: " + res.map((r) => esc(r.publicName || r.name)).join(", ") : ""}, con su implementación, actualizaciones, respaldo de datos en la nube y soporte.</li>
      <li><b>Plan y precio.</b> Plan ${L(p ? p.name : "")} por un precio de ${L(s ? fmt.money(subPrice(s)) : "")} por mes, en pesos argentinos, pagadero por período ${L("")} (mensual, trimestral, semestral o anual) por transferencia bancaria. El Proveedor emite factura por cada pago.</li>
      <li><b>Prueba sin cargo.</b> El primer mes es sin cargo. Al terminar, el Cliente decide si activa el plan. No hay cobros ni renovaciones automáticas.</li>
      <li><b>Vigencia y baja.</b> El servicio se renueva por período a pedido del Cliente. El Cliente puede pedir la baja en cualquier momento por el mismo medio por el que contrató. Si contrató a distancia como consumidor, puede revocar la contratación dentro de los 10 días corridos sin costo (art. 34, Ley 24.240).</li>
      <li><b>Falta de pago.</b> Si un período no se paga, el Proveedor avisa al Cliente por el sistema y por WhatsApp para regularizarlo.</li>
      <li><b>Soporte.</b> Por WhatsApp ${esc(DEV.wa)}, por el portal del cliente y la página de soporte, en días y horarios hábiles.</li>
      <li><b>Datos.</b> Los datos que el Cliente carga son de su propiedad. El Proveedor los trata solo para prestar el servicio, con acceso por usuario y permisos, conforme a la Ley 25.326. Si el Cliente no continúa, el Proveedor le entrega sus datos en un formato estándar.</li>
      <li><b>Responsabilidad.</b> El Proveedor responde por el funcionamiento del sistema conforme a la ley. No responde por fallas de servicios de terceros (conexión a internet, ARCA, medios de pago, mensajería) ni por datos cargados con errores por el Cliente.</li>
      <li><b>Jurisdicción.</b> Para cualquier controversia, las partes se someten a los tribunales ordinarios de la ciudad de Salta.</li>
    </ol>
    <p>Se firman dos ejemplares de un mismo tenor y a un solo efecto.</p>
    <div class="firmas"><div>Por el Proveedor<br><b>${esc(vbEmpresa())}</b><br>Aclaración y DNI</div><div>Por el Cliente<br><b>${esc(c.tradeName || c.legalName)}</b><br>Aclaración y DNI</div></div>
    ${vbPieA4("Contrato " + (c.tradeName || c.legalName))}</div>`;
  vbAbrir("Contrato · " + (c.tradeName || c.legalName), cuerpo);
  audit("PRINT", "clients", id, null, { label: "Contrato de servicio" }); save();
}

/* ───── 4. Tarjetas del personal (dueños y empleados), editables ───── */
const TJ_KEY = "vb_tarjetas_v1";
function tjInicial() {
  try { const g = JSON.parse(localStorage.getItem(TJ_KEY) || "null"); if (Array.isArray(g) && g.length) return g; } catch { }
  const filas = [];
  S.users.filter((u) => u.active !== false && !u.clientId).forEach((u) => filas.push({ nombre: u.name, cargo: u.role === "owner" ? "Dueño" : u.role === "partner" ? "Socio" : (ROLES[u.role] || "Equipo"), tel: u.phone || DEV.wa, email: u.email || DEV.email }));
  S.employees.filter((e) => e.active && !filas.some((x) => x.nombre === e.name)).forEach((e) => filas.push({ nombre: e.name, cargo: e.position || "Equipo", tel: DEV.wa, email: DEV.email }));
  if (!filas.length) filas.push({ nombre: "Nombre y apellido", cargo: "Cargo", tel: DEV.wa, email: DEV.email });
  return filas;
}
let TJ = null;
function tjLeer() {
  document.querySelectorAll("#tj-tabla tbody tr").forEach((tr, i) => {
    const v = (k) => (tr.querySelector(`[data-k=${k}]`)?.value || "").trim();
    TJ[i] = { nombre: v("nombre"), cargo: v("cargo"), tel: v("tel"), email: v("email") };
  });
  try { localStorage.setItem(TJ_KEY, JSON.stringify(TJ)); } catch { }
}
function tjFilas() {
  return TJ.map((p, i) => `<tr>
    <td><input class="in" data-k="nombre" maxlength="40" value="${esc(p.nombre)}" placeholder="Nombre y apellido"></td>
    <td><input class="in" data-k="cargo" maxlength="30" value="${esc(p.cargo)}" placeholder="Cargo"></td>
    <td><input class="in" data-k="tel" maxlength="30" value="${esc(p.tel)}" placeholder="WhatsApp"></td>
    <td><input class="in" data-k="email" maxlength="60" value="${esc(p.email)}" placeholder="Email"></td>
    <td>${btn("Quitar", "tj-del", { sm: true, tone: "ghost", data: { i } })}</td></tr>`).join("");
}
function tjEditor() {
  TJ = tjInicial();
  openModal("Tarjetas del personal", `<p class="small muted" style="margin:0 0 12px">Escribí los datos de cada persona (dueños y empleados). Los cambios se guardan en este equipo. Al tocar <b>Descargar PDF</b> se abre la hoja lista: elegí «Guardar como PDF» o imprimila. Cada tarjeta mide 85 × 55 mm, con frente y dorso.</p>
    <div class="tw"><table id="tj-tabla"><thead><tr><th>Nombre</th><th>Cargo</th><th>WhatsApp</th><th>Email</th><th></th></tr></thead><tbody>${tjFilas()}</tbody></table></div>
    <div class="row" style="margin-top:12px">${btn("Agregar persona", "tj-add", { sm: true })}${btn("Restablecer desde usuarios", "tj-reset", { sm: true, tone: "ghost" })}</div>`,
    { wide: true, footer: `<div class="modal-f">${btn("Descargar PDF", "tj-pdf", { tone: "primary" })}</div>` });
}
function tjRedibujar() { const tb = document.querySelector("#tj-tabla tbody"); if (tb) tb.innerHTML = tjFilas(); }
function printTarjetas(lista) {
  const personas = (lista || []).filter((p) => p.nombre);
  const tarjeta = (p) => `<div class="tj frente"><div class="marca">${VB_LOGO("#0b0b0c")}<div><b>Vincular Business</b><span>Sistemas de gestión</span></div></div>
      <div class="nom">${esc(p.nombre)}</div><div class="rol">${esc(p.cargo || "")}</div>
      <div class="dat">${p.tel ? "WhatsApp " + esc(p.tel) + "<br>" : ""}${p.email ? esc(p.email) + "<br>" : ""}${VB_WEB}</div></div>
    <div class="tj dorso"><div>${VB_LOGO("#0b0b0c")}<b>Vincular Business</b><span>Tu negocio en orden, con todo en un solo sistema.</span></div></div>`;
  vbAbrir("Tarjetas del personal · Vincular Business", `<div class="hoja-t">${personas.map(tarjeta).join("")}</div>`);
}
function printTarjetasDuenos() { tjEditor(); }

Object.assign(A, {
  "client-ficha": (el) => printClientFicha(el.dataset.id),
  "client-contrato": (el) => printContrato(el.dataset.id),
  "owner-cards": () => tjEditor(),
  "tj-add": () => { tjLeer(); TJ.push({ nombre: "", cargo: "", tel: DEV.wa, email: "" }); tjRedibujar(); },
  "tj-del": (el) => { tjLeer(); TJ.splice(Number(el.dataset.i), 1); if (!TJ.length) TJ.push({ nombre: "", cargo: "", tel: DEV.wa, email: "" }); tjRedibujar(); },
  "tj-reset": () => { try { localStorage.removeItem(TJ_KEY); } catch { } TJ = tjInicial(); tjRedibujar(); },
  "tj-pdf": () => { tjLeer(); printTarjetas(TJ); },
});
</script>
