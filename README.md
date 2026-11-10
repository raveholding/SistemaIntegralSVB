# Sistema Integral SVB

Plataforma SaaS multi-tenant de **Vincular Business** (software a medida e IA) — interfaz ejecutiva en *dark mode* con 7 módulos:

| # | Módulo | Ruta | Destacado |
|---|---|---|---|
| 1 | Monitor de salud e infraestructura | `/monitor` | CPU / memoria / latencia, heartbeat, alertas → Telegram con botón de ACK |
| 2 | Gestor documental y de contratos | `/documentos` | PDF versionados con SHA-256, estados, avisos de vencimiento a 30/15/7 días |
| 3 | CRM y suscripciones multi-nivel | `/crm` | Abono Esencial $50.000 vs Pro + IA $80.000, upgrade con prorrateo |
| 4 | Punto de venta, caja y auditoría | `/caja` | Apertura/cierre/arqueo, facturas, tickets, señas, pagos mixtos, audit trail |
| 5 | Recursos humanos y rendimiento | `/rrhh` | RBAC granular, metas y comisiones por tramos |
| 6 | Gestor web y CMS | `/cms` | Páginas y landings, leads, métricas y despliegues |
| 7 | Portal de autogestión del cliente | `/portal` | Estado en verde, contrato, facturas y tickets — sin complejidad técnica |

📐 [Arquitectura lógica](docs/ARQUITECTURA.md) · 🗄️ [Esquema de base de datos](docs/BASE_DE_DATOS.md)

## Estructura

```
apps/web/                 Next.js 15 + React 19 + Tailwind (App Router, Server Actions)
supabase/migrations/      Esquema, RLS, auditoría, lógica de negocio (7 migraciones)
supabase/seed.sql         Datos demo (Vincular Business, planes, clientes, recursos)
supabase/tests/           Pruebas de integración SQL (caja, RLS, portal, alertas, comisiones…)
services/alerting/        FastAPI: ingesta de heartbeat, watchdog, vencimientos, bot de Telegram
services/monitor-agent/   Agente Node sin dependencias para servidores de clientes (+ unit systemd)
docs/                     Arquitectura y modelo de datos
```

## Versión HTML5 (un solo archivo, 100 % funcional)

[`index.html`](index.html) contiene la plataforma completa en **un único archivo HTML5**: no necesita servidor, base de datos ni instalar nada.
Se abre con doble clic, o se publica con **GitHub Pages** (Settings → Pages → rama `main`, carpeta `/`).

- Ingreso por perfil (Dueño, Vendedora, Técnico, Administración y usuarios de cliente), con menús y acciones según permisos (RBAC editable).
- Datos persistentes en el navegador: `localStorage`, más IndexedDB para los PDF de contratos. Incluye respaldo e importación en JSON.
- Auditoría inmutable con SHA-256 encadenado, verificación de integridad y exportación a CSV.
- Monitor con heartbeat simulado, reglas, watchdog y avisos reales por **Telegram** (en Ajustes, con el token del bot).
- Caja: apertura, ventas con pagos mixtos, señas aplicables, anulaciones y notas de crédito, cierre con arqueo y comprobantes imprimibles.

El código fuente está en `html5/src/`. Se compila con `cd html5 && npm install && npm run build`, que genera `index.html` compatible con navegadores de celular desde iOS 11 y Android 7.

La versión Next.js + Supabase de `apps/web` es la evolución multi-usuario en la nube del mismo diseño.

## Inicio rápido

### Ver la interfaz en 1 minuto (modo demo, sin base de datos)
```bash
cd apps/web && npm install && npm run dev     # http://localhost:3000  ·  portal: /portal
```

### Con Supabase
```bash
supabase start                                # o un proyecto en supabase.com
supabase db reset                             # aplica migraciones + seed
cp apps/web/.env.example apps/web/.env.local  # URL y anon key
```
En **Auth → Hooks** active *Custom Access Token* apuntando a `public.custom_access_token_hook`.

### Servicio de alertas y agente
```bash
cd services/alerting && cp .env.example .env && pip install -r requirements.txt
uvicorn app.main:app --port 8080
# en cada servidor del cliente (token generado con rotate_agent_token desde el panel):
SVB_ENDPOINT=https://alertas.tu-dominio SVB_RESOURCE_ID=<uuid> SVB_TOKEN=<token> node services/monitor-agent/agent.mjs
```
Webhook del bot: `setWebhook?url=https://alertas.tu-dominio/v1/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`.

## Pruebas
```bash
PGURL=postgres://postgres@localhost:5432/svb_test ./supabase/tests/run.sh   # Postgres 15/16 vacío
cd services/alerting && pytest
cd apps/web && npm run typecheck && npm run build
```

---
Desarrollado por **Vincular Business** · WhatsApp (387) 4484132 · vincularbusiness@gmail.com
