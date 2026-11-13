<script>
/* ───────────── Datos iniciales (demo editable) ───────────── */
function seedState() {
  const t = todayISO();
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const s = {
    version: 1, demo: true, createdAt: nowISO(), session: { userId: null },
    settings: { company: "Vincular Business", cuit: "20-00000000-0", heartbeatSec: 3, telegram: { token: "", chatId: "", minSeverity: "warning", enabled: false }, simulate: true },
    rolePerms: structuredClone(DEFAULT_ROLE_PERMS),
    users: [
      { id: "u1", name: "Nico", email: "nico@vincular.business", role: "owner", clientId: null, overrides: {}, active: true },
      { id: "u2", name: "Lucía Vendedora", email: "ventas@vincular.business", role: "seller", clientId: null, overrides: {}, active: true },
      { id: "u3", name: "Martín Técnico", email: "soporte@vincular.business", role: "technician", clientId: null, overrides: {}, active: true },
      { id: "u4", name: "Sofía Díaz", email: "admin@vincular.business", role: "admin", clientId: null, overrides: {}, active: true },
      { id: "u5", name: "Juan (Barbería Juan)", email: "it@barberiajuan.com.ar", role: "client_admin", clientId: "c1", overrides: {}, active: true },
      { id: "u6", name: "Admin Club Camping", email: "admin@clubcamping.com.ar", role: "client_admin", clientId: "c2", overrides: {}, active: true },
    ],
    clients: [
      { id: "c1", legalName: "Barbería Juan SRL", tradeName: "Barbería Juan", taxId: "30-11111111-1", taxCondition: "RI", email: "it@barberiajuan.com.ar", phone: "387 555-0101", city: "Salta", industry: "Servicios", status: "active", ownerId: "u2" },
      { id: "c2", legalName: "Club Camping Asoc. Civil", tradeName: "Club Camping", taxId: "30-22222222-2", taxCondition: "Exento", email: "admin@clubcamping.com.ar", phone: "387 555-0102", city: "Salta", industry: "Clubes", status: "active", ownerId: "u2" },
      { id: "c3", legalName: "Movimiento Inteligente", tradeName: "Movimiento Inteligente", taxId: "20-33333333-3", taxCondition: "Monotributo", email: "nahuel@movimiento.com", phone: "387 555-0103", city: "Salta", industry: "Fitness", status: "active", ownerId: "u1" },
      { id: "c4", legalName: "Estudio Contable Norte", tradeName: "Estudio Norte", taxId: "30-44444444-4", taxCondition: "RI", email: "info@estudionorte.com.ar", phone: "387 555-0104", city: "Salta", industry: "Contable", status: "active", ownerId: "u2" },
      { id: "c5", legalName: "RAVE Holding", tradeName: "RAVE", taxId: "30-55555555-5", taxCondition: "RI", email: "hola@rave.com.ar", phone: "387 555-0105", city: "Salta", industry: "Gastronomía", status: "active", ownerId: "u1" },
      { id: "c6", legalName: "Gym Norte", tradeName: "Gym Norte", taxId: "", taxCondition: "CF", email: "maria@gimnasio.com", phone: "387 555-0106", city: "Salta", industry: "Fitness", status: "lead", ownerId: "u2" },
    ].map((c) => ({ ...c, createdAt: ago(60 * 24 * 90) })),
    interactions: [
      { id: uid(), clientId: "c1", userId: "u2", kind: "whatsapp", subject: "Consulta por turnero online", body: "Pide sumar recordatorios automáticos", at: ago(60 * 26) },
      { id: uid(), clientId: "c2", userId: "u2", kind: "meeting", subject: "Revisión trimestral", body: "Conformes con el sistema de socios", at: ago(60 * 3) },
      { id: uid(), clientId: "c6", userId: "u2", kind: "demo", subject: "Demo sistema gimnasios", body: "Interesada en plan con IA", at: ago(120) },
    ],
    plans: [
      { id: "p1", code: "ESENCIAL", name: "Abono Esencial", tier: 1, price: 50000, ai: false, features: ["Sistema de gestión a medida", "Hosting y backups", "Soporte en horario comercial", "Monitoreo 24/7"], active: true },
      { id: "p2", code: "PRO_IA", name: "Abono Pro + IA", tier: 2, price: 80000, ai: true, features: ["Todo lo del plan Esencial", "Automatizaciones (WhatsApp, email, reportes)", "Asistente con IA integrado", "Soporte prioritario 4 h"], active: true },
    ],
    subscriptions: [
      { id: "s1", clientId: "c1", planId: "p1", status: "active", priceOverride: null, startedAt: addDays(t, -340) },
      { id: "s2", clientId: "c2", planId: "p2", status: "active", priceOverride: null, startedAt: addDays(t, -120) },
      { id: "s3", clientId: "c3", planId: "p2", status: "active", priceOverride: null, startedAt: addDays(t, -60) },
      { id: "s4", clientId: "c4", planId: "p1", status: "active", priceOverride: null, startedAt: addDays(t, -355) },
      { id: "s5", clientId: "c5", planId: "p1", status: "active", priceOverride: 45000, startedAt: addDays(t, -400) },
    ],
    subChanges: [],
    contracts: [
      { id: "k1", code: "CTR-2026-0001", clientId: "c1", subscriptionId: "s1", title: "Servicio · Abono Esencial", status: "signed", startDate: addDays(t, -350), endDate: addDays(t, 15), autoRenew: false, value: 600000, noticeDays: [30, 15, 7], signedAt: ago(60 * 24 * 350), signedBy: "Juan Pérez" },
      { id: "k2", code: "CTR-2026-0002", clientId: "c2", subscriptionId: "s2", title: "Servicio · Pro + IA", status: "signed", startDate: addDays(t, -120), endDate: addDays(t, 245), autoRenew: true, value: 960000, noticeDays: [30, 15, 7], signedAt: ago(60 * 24 * 120), signedBy: "Comisión Directiva" },
      { id: "k3", code: "CTR-2026-0003", clientId: "c3", subscriptionId: "s3", title: "Desarrollo app de entrenadores", status: "pending_signature", startDate: addDays(t, 3), endDate: addDays(t, 368), autoRenew: false, value: 1450000, noticeDays: [30, 15, 7] },
      { id: "k4", code: "CTR-2026-0004", clientId: "c4", subscriptionId: "s4", title: "Servicio · Abono Esencial", status: "signed", startDate: addDays(t, -358), endDate: addDays(t, 7), autoRenew: false, value: 600000, noticeDays: [30, 15, 7], signedAt: ago(60 * 24 * 358), signedBy: "C.P. Gómez" },
      { id: "k5", code: "CTR-2026-0005", clientId: "c6", subscriptionId: null, title: "Propuesta sistema gimnasio", status: "draft", startDate: null, endDate: null, autoRenew: false, value: 420000, noticeDays: [30, 15, 7] },
    ],
    contractVersions: [],
    resources: [
      { id: "r1", name: "barberia-prod-db", publicName: "Base de datos", kind: "supabase_project", clientId: "c1", region: "sa-east-1", endpoint: "db.barberia.supabase.co", base: { cpu: 25, mem: 42, lat: 40 } },
      { id: "r2", name: "barberia-web", publicName: "Sitio web y turnero", kind: "website", clientId: "c1", region: "sa-east-1", endpoint: "https://barberiajuan.com.ar", base: { cpu: 14, mem: 33, lat: 140 } },
      { id: "r3", name: "camping-api", publicName: "Sistema de socios", kind: "api", clientId: "c2", region: "sa-east-1", endpoint: "https://api.clubcamping.com.ar", base: { cpu: 30, mem: 48, lat: 90 } },
      { id: "r4", name: "gym-mi-prod", publicName: "App de entrenamiento", kind: "server", clientId: "c3", region: "us-east-1", endpoint: "10.0.4.12", base: { cpu: 58, mem: 66, lat: 380 } },
      { id: "r5", name: "estudio-norte-db", publicName: "Base de datos", kind: "database", clientId: "c4", region: "sa-east-1", endpoint: "pg.estudionorte.local", base: { cpu: 31, mem: 52, lat: 22 } },
      { id: "r6", name: "arca-gateway", publicName: "Facturación electrónica", kind: "worker", clientId: null, region: "sa-east-1", endpoint: "sv.arca.sdk", base: { cpu: 9, mem: 27, lat: 310 } },
      { id: "r7", name: "rave-menu-qr", publicName: "Menú digital", kind: "website", clientId: "c5", region: "sa-east-1", endpoint: "https://rave.com.ar/menu", base: { cpu: 6, mem: 18, lat: 96 } },
    ].map((r) => ({ ...r, status: "unknown", statusSince: nowISO(), lastBeat: null, active: true, paused: false, stress: false, missedBeats: 3, uptimeDownMs: 0 })),
    alertRules: [
      { id: "ar1", metric: "cpu", op: ">", threshold: 90, samples: 3, severity: "critical", active: true },
      { id: "ar2", metric: "mem", op: ">", threshold: 85, samples: 3, severity: "warning", active: true },
      { id: "ar3", metric: "lat", op: ">", threshold: 1500, samples: 3, severity: "warning", active: true },
    ],
    alerts: [],
    registers: [{ id: "reg1", name: "Caja Principal", pos: 1, location: "Oficina Salta" }],
    sessions: [], documents: [], movements: [], seq: {},
    schemes: [{ id: "sch1", name: "Vendedores 2026", baseRate: 3, tiers: [{ from: 0, rate: 5 }, { from: 100, rate: 8 }, { from: 120, rate: 10 }] }],
    employees: [
      { id: "e1", userId: "u1", name: "Nico", position: "Socio fundador", staffType: "partner", hireDate: "2024-01-01", salary: null, schemeId: null, active: true },
      { id: "e2", userId: "u2", name: "Lucía Vendedora", position: "Ejecutiva comercial", staffType: "seller", hireDate: "2025-03-01", salary: 650000, schemeId: "sch1", active: true },
      { id: "e3", userId: "u3", name: "Martín Técnico", position: "DevOps", staffType: "technician", hireDate: "2025-06-01", salary: 900000, schemeId: null, active: true },
      { id: "e4", userId: "u4", name: "Sofía Díaz", position: "Administración", staffType: "employee", hireDate: "2025-08-01", salary: 600000, schemeId: null, active: true },
    ],
    goals: [{ id: "g1", employeeId: "e2", period: t.slice(0, 7), target: 300000 }],
    commissions: [],
    sites: [{ id: "site1", name: "Sitio corporativo", domain: "vincular.business", provider: "GitHub Pages" }],
    pages: [
      { id: "pg1", siteId: "site1", slug: "", title: "Inicio", kind: "page", status: "published", version: 1, publishedAt: ago(60 * 24 * 6),
        blocks: { heroTitle: "Software a medida para tu comercio", heroText: "Gestión, digitalización y fidelización para comercios y servicios de Argentina.", features: ["Sistemas a medida", "Facturación electrónica ARCA", "Automatizaciones con IA"], cta: "Pedí una demo", leadForm: true } },
      { id: "pg2", siteId: "site1", slug: "demo-gratis", title: "Landing · Demo gratis", kind: "landing", status: "published", version: 1, publishedAt: ago(60 * 24 * 12),
        blocks: { heroTitle: "Tu sistema funcionando en 7 días", heroText: "Probalo gratis: turnos, ventas, clientes y reportes en un solo lugar.", features: ["Sin instalación", "Soporte local en Salta", "Pagás sólo si te sirve"], cta: "Quiero mi demo", leadForm: true } },
      { id: "pg3", siteId: "site1", slug: "gimnasios", title: "Landing · Gimnasios", kind: "landing", status: "draft", version: 0, publishedAt: null,
        blocks: { heroTitle: "Gestioná tu gimnasio sin planillas", heroText: "Socios, cuotas, rutinas y asistencia desde el celular.", features: ["Control de cuotas", "Rutinas por alumno", "Recordatorios por WhatsApp"], cta: "Solicitar demo", leadForm: true } },
    ],
    pageVersions: [],
    metrics: {},  // pageId -> { 'YYYY-MM-DD': {views, leads} }
    deployments: [
      { id: "d1", siteId: "site1", status: "ready", commit: "a1f9c2e", durationMs: 41200, at: ago(60 * 3), by: "u1" },
      { id: "d2", siteId: "site1", status: "error", commit: "77be010", durationMs: 12800, at: ago(60 * 26), by: "u3" },
    ],
    leads: [
      { id: "l1", pageId: "pg2", name: "María Gómez", email: "maria@gimnasio.com", phone: "3875550000", company: "Gym Norte", message: "Quiero una demo", status: "contacted", at: ago(60 * 20) },
      { id: "l2", pageId: "pg1", name: "Carlos Fernández", email: "carlos@barberking.com", phone: "", company: "Barber King", message: "", status: "new", at: ago(45) },
    ],
    tickets: [
      { id: "t1", number: 1, clientId: "c1", subject: "Agregar usuario para recepción", description: "Necesitamos un usuario más para la recepcionista.", category: "consulta", priority: "normal", status: "resolved", openedBy: "u5", assignedTo: "u3", at: ago(60 * 24 * 4), slaDue: ago(60 * 24), resolvedAt: ago(60 * 24 * 3) },
      { id: "t2", number: 2, clientId: "c2", subject: "Reporte de cuotas no exporta a Excel", description: "Al exportar el reporte mensual se descarga vacío.", category: "bug", priority: "high", status: "in_progress", openedBy: "u6", assignedTo: "u3", at: ago(60 * 5), slaDue: new Date(Date.now() + 19 * 3600e3).toISOString() },
    ],
    ticketMessages: [
      { id: uid(), ticketId: "t1", authorId: "u3", body: "Listo, usuario creado: recepcion@barberiajuan.com.ar", internal: false, at: ago(60 * 24 * 3) },
      { id: uid(), ticketId: "t2", authorId: "u3", body: "Revisar timeout del export en el worker", internal: true, at: ago(60 * 4) },
      { id: uid(), ticketId: "t2", authorId: "u3", body: "Lo estamos revisando, te avisamos hoy.", internal: false, at: ago(60 * 4) },
    ],
    notifications: [], samples: {}, audit: [],
  };
  // Métricas de visitas de los últimos 30 días
  for (const [pid, base] of [["pg1", 150], ["pg2", 65]]) {
    s.metrics[pid] = {};
    for (let i = 0; i < 30; i++) s.metrics[pid][addDays(t, -i)] = { views: Math.round(base * (0.7 + ((i * 37) % 60) / 100)), leads: (i * 7) % 5 === 0 ? 2 : (i % 3 === 0 ? 1 : 0) };
  }
  return s;
}

/* Estado vacío para empezar a usar el sistema con datos reales: conserva planes, roles,
   reglas de alertas, caja y esquema de comisiones; borra clientes, ventas y demás datos demo. */
function blankState({ company, cuit, ownerName, ownerEmail }) {
  const s = seedState();
  s.demo = false;
  s.settings = { ...s.settings, company: company || "Mi empresa", cuit: cuit || "", simulate: false };
  s.users = [{ id: "u1", name: ownerName, email: ownerEmail, role: "owner", clientId: null, overrides: {}, active: true }];
  s.employees = [{ id: "e1", userId: "u1", name: ownerName, position: "Dueño", staffType: "partner", hireDate: todayISO(), salary: null, schemeId: null, active: true }];
  for (const k of ["clients", "interactions", "subscriptions", "subChanges", "contracts", "contractVersions", "resources", "alerts", "sessions", "documents", "movements", "goals", "commissions", "pages", "pageVersions", "deployments", "leads", "tickets", "ticketMessages", "notifications", "audit"]) s[k] = [];
  s.sites = [{ id: "site1", name: "Sitio corporativo", domain: "", provider: "GitHub Pages" }];
  s.metrics = {}; s.samples = {}; s.seq = {};
  return s;
}

/* Estado inicial REAL (primera vez en la nube): Vincular Business con sus clientes actuales.
   Sin datos inventados: CUIT, planes y contratos se completan desde el sistema. */
function realState({ ownerName, ownerEmail }) {
  const s = blankState({ company: "Vincular Business", cuit: "", ownerName, ownerEmail });
  s.settings.heartbeatSec = 60; s.settings.simulate = false;
  s.settings.channels = { whatsapp: "5493874484132", email: "vincularbusiness@gmail.com", instagram: "", facebook: "", telegram: "", web: "https://raveholding.github.io/SistemaIntegralSVB/", hours: "Lunes a viernes de 9 a 18 h · Sábados de 9 a 13 h", welcome: "¡Hola! Somos Vincular Business. Contanos en qué te ayudamos y te respondemos por acá." };
  s.sites = [{ id: "site1", name: "Sitio corporativo", domain: "raveholding.github.io", provider: "GitHub Pages" }];
  const at = nowISO();
  const C = (id, o) => ({ id, taxId: "", city: "Salta", status: "active", ownerId: "u1", createdAt: at, ...o });
  s.clients = [
    C("c-medicinalterps", { legalName: "Terpenos Medicinales – Asociación Civil", tradeName: "Medicinal Terps", taxCondition: "Exento", email: "medicinalterps@gmail.com", phone: "", industry: "ONG · cannabis medicinal", web: "https://raveholding.github.io/Medicinal-Terps/", notes: "Sistema VB v3.5: sitio público + panel interno (PWA). Nube Supabase (São Paulo)." }),
    C("c-cannabismatica", { legalName: "Fundación Cannabismatica Investigación y Desarrollo", tradeName: "Cannabismatica I+D", taxCondition: "Exento", email: "", phone: "", industry: "ONG · cannabis medicinal (Ley 27.350 · REPROCANN)", web: "https://raveholding.github.io/Cannabismatica/", notes: "Sistema VB ONG v3 con nube; portero digital integrado." }),
    C("c-sebachavez", { legalName: "SebaChavez Car Service", tradeName: "SebaChavez Car Service", taxCondition: "Monotributo", email: "schavezcarservice@gmail.com", phone: "3875971922", industry: "Taller mecánico integral", address: "Jujuy 251, Salta", web: "https://raveholding.github.io/Sebachavezcarervice/", notes: "Órdenes de trabajo, turnos, repuestos, caja. Instagram sebachavez_carservice · Facebook sebachavezcarservice." }),
    C("c-almacenrave", { legalName: "RAVE Holding", tradeName: "Almacén RAVE", taxCondition: "RI", email: "raveholding@gmail.com", phone: "", industry: "Almacén · bebidas y tabaco", web: "https://raveholding.github.io/AlmacenRAVE/", notes: "Sistema VB 26F: POS, stock, caja, Club RAVE, reparto, canales de atención y portero SeguridadRave." }),
    C("c-clinicapc", { legalName: "Clínica de la PC", tradeName: "Clínica de la PC", taxCondition: "Monotributo", email: "", phone: "", industry: "Servicio técnico de computadoras", web: "https://raveholding.github.io/Clinicadelapc/", notes: "Sistema de taller (versión de prueba en el negocio, datos en el navegador)." }),
  ];
  const R = (id, clientId, name, publicName, kind, endpoint, region = "github-pages") => ({ id, clientId, name, publicName, kind, endpoint, region, base: { cpu: 10, mem: 20, lat: 150 }, status: "unknown", statusSince: at, lastBeat: null, active: true, paused: false, stress: false, missedBeats: 3, uptimeDownMs: 0, check: "http" });
  s.resources = [
    R("r-svb", null, "sistema-integral-svb", "Sistema Integral SVB", "website", "https://raveholding.github.io/SistemaIntegralSVB/"),
    R("r-mt-web", "c-medicinalterps", "medicinalterps-web", "Sitio y panel", "website", "https://raveholding.github.io/Medicinal-Terps/"),
    R("r-mt-db", "c-medicinalterps", "medicinalterps-supabase", "Base de datos en la nube", "supabase_project", "https://yhxeznyqkfmczpkjwgep.supabase.co", "sa-east-1"),
    R("r-cm-web", "c-cannabismatica", "cannabismatica-web", "Sitio y panel", "website", "https://raveholding.github.io/Cannabismatica/"),
    R("r-cm-portero", "c-cannabismatica", "cannabismatica-portero", "Portero digital", "website", "https://raveholding.github.io/PorteroCannabismatica/"),
    R("r-sc-web", "c-sebachavez", "sebachavez-web", "Sistema del taller", "website", "https://raveholding.github.io/Sebachavezcarervice/"),
    R("r-ar-web", "c-almacenrave", "almacenrave-web", "Menú digital y sistema", "website", "https://raveholding.github.io/AlmacenRAVE/"),
    R("r-ar-portero", "c-almacenrave", "almacenrave-portero", "Seguridad y portero", "website", "https://raveholding.github.io/SeguridadRave/"),
    R("r-cp-web", "c-clinicapc", "clinicapc-web", "Sistema de taller", "website", "https://raveholding.github.io/Clinicadelapc/"),
  ];
  s.interactions = s.clients.map((c) => ({ id: uid(), clientId: c.id, userId: "u1", kind: "note", subject: "Alta en Sistema Integral SVB", body: "Cliente cargado al iniciar el sistema en la nube.", at }));
  return s;
}

function loadState() {
  const REQUIRED = ["users", "clients", "plans", "subscriptions", "contracts", "contractVersions", "resources", "alerts", "alertRules", "sessions", "documents", "movements", "employees", "goals", "commissions", "pages", "leads", "tickets", "ticketMessages", "notifications", "audit", "interactions", "subChanges", "registers", "schemes", "sites", "pageVersions", "deployments"];
  let raw = null;
  try { raw = localStorage.getItem(APP_KEY); } catch { /* almacenamiento bloqueado (modo privado) */ }
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d && d.version === 1 && REQUIRED.every((k) => Array.isArray(d[k])) && d.settings && d.rolePerms && d.session) { S = d; if (S.demo === undefined) S.demo = S.users.some((u) => u.email === "ventas@vincular.business"); S.samples = S.samples || {}; S.metrics = S.metrics || {}; S.seq = S.seq || {}; return; }
    } catch { /* JSON inválido */ }
    try { localStorage.setItem(APP_KEY + "_dañado_" + Date.now(), raw); } catch { }   // se conserva una copia
  }
  S = seedState();
  // primer evento de la cadena
  audit("SYSTEM_INIT", "system", null, null, { company: S.settings.company });
  try { saveNow(); } catch { /* sin almacenamiento: funciona en memoria */ }
}
</script>
