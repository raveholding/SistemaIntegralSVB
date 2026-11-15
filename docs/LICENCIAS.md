# Licencias por paquete (candado por módulo)

| Paquete | Pago único (ARS) | Módulos |
|---|---|---|
| Menú (`menu`) | 100.000 | cms |
| Menú + CRM/POS (`crm_pos`) | 400.000 | cms, crm, pos |
| Completo (`completo`) | 700.000 | + docs, hr, monitor |
| Completo + App (`completo_app`) | 1.200.000 | + portal (app del cliente y soporte) |
| **Pro + IA** (extra, `ai_enabled`) | — | módulo `ai` sobre cualquier paquete |

Todos: mantenimiento mensual de $ 50.000. NFC es una ampliación de cualquier combo.

## Cómo se aplica
- **Base de datos (autoridad):** `tenant_licenses` + `license_packages` (migración `…0008_licenses.sql`).
  `tenants_with(perm)` exige permiso del rol **y** módulo licenciado (`perm_module`), por lo que RLS y todas las
  funciones de negocio (`require_perm`) quedan cerradas sin tocar cada tabla. `support_tickets`/`ticket_messages`
  llevan además una política *restrictive* por módulo `portal`. Sin licencia o `canceled` ⇒ candado total.
- **Quién cambia la licencia:** sólo `service_role` vía `set_license()`; ningún usuario autenticado puede auto-subirse de plan.
- **Mantenimiento impago:** NO bloquea. `flag_license_follow_up()` pasa la licencia a `follow_up` y notifica al equipo
  para hablar con el cliente; `clear_license_follow_up()` la normaliza. (permiso `billing.manage`, siempre disponible).
- **UI Next.js:** `lib/license.ts`, `my_license()` en `getContext`, ítems con candado en el menú, `requirePerm`
  redirige a `/plan` (Mi plan + "Mejorar plan" por WhatsApp).
- **UI HTML5:** constante `LICENSE` en `src/02_core.js` (la fija el desarrollador al entregar); `can()` respeta el módulo.
  Es un candado de interfaz: sin servidor no puede ser inviolable.

Pruebas: `supabase/tests/02_licenses.sql` (se ejecuta con `supabase/tests/run.sh`).
