-- =============================================================================
-- Pruebas de integración: caja, auditoría, RLS multi-tenant, portal, monitoreo,
-- contratos, suscripciones y comisiones. Falla con excepción ante el primer error.
-- =============================================================================
\set QUIET on
\o /dev/null
\set seller   '00000000-0000-0000-0000-000000000002'
\set owner    '00000000-0000-0000-0000-000000000001'
\set clientA  '00000000-0000-0000-0000-000000000010'
\set clientB  '00000000-0000-0000-0000-000000000011'

create or replace function public.t_expect_error(p_sql text, p_like text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'SE ESPERABA ERROR (%): %', p_like, p_sql;
exception when others then
  if sqlerrm like 'SE ESPERABA ERROR%' then raise; end if;
  if sqlerrm not ilike '%' || p_like || '%' then
    raise exception 'Error inesperado para %: % (esperado: %)', p_sql, sqlerrm, p_like;
  end if;
end $$;
grant execute on function public.t_expect_error(text, text) to anon, authenticated, service_role;

-- ─── 1. POS como vendedora ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"' || :'seller' || '"}', false);
set role authenticated;

create temp table t_ctx as select public.open_cash_session('ca000000-0000-0000-0000-000000000001', 10000) as session_id;

select public.t_expect_error($$select public.open_cash_session('ca000000-0000-0000-0000-000000000001', 0)$$, 'caja abierta');

-- Seña de $20.000 en efectivo
alter table t_ctx add column deposit_id uuid;
update t_ctx set deposit_id = public.issue_sales_document(
  session_id, 'deposit_receipt',
  '[{"description":"Seña desarrollo módulo turnos","quantity":1,"unit_price":20000}]',
  '[{"method":"cash","amount":20000}]', 'c0000000-0000-0000-0000-00000000000a');

-- Pagos que no cuadran
select public.t_expect_error(format($$select public.issue_sales_document(%L, 'invoice_b',
  '[{"description":"x","quantity":1,"unit_price":80000}]', '[{"method":"cash","amount":1}]')$$,
  (select session_id from t_ctx)), 'no coinciden');

-- Factura B de $80.000 aplicando la seña: restan $60.000 (40k efectivo + 20k transferencia)
alter table t_ctx add column invoice_id uuid;
update t_ctx set invoice_id = public.issue_sales_document(
  session_id, 'invoice_b',
  '[{"description":"Abono Pro + IA · noviembre","quantity":1,"unit_price":80000,"tax_rate":21}]',
  '[{"method":"cash","amount":40000},{"method":"transfer","amount":20000,"reference":"op 99812"}]',
  'c0000000-0000-0000-0000-00000000000a', deposit_id);

-- La seña no se puede reutilizar
select public.t_expect_error(format($$select public.issue_sales_document(%L, 'ticket',
  '[{"description":"x","quantity":1,"unit_price":20000}]', '[]', null, %L)$$,
  (select session_id from t_ctx), (select deposit_id from t_ctx)), 'ya fue aplicada');

-- Vendedora no puede hacer retiros (pos.supervise) ni escribir el libro directo
select public.t_expect_error(format($$select public.register_cash_movement(%L, 'withdrawal', 'cash', 5000, 'retiro socio')$$,
  (select session_id from t_ctx)), 'Permiso denegado');
select public.t_expect_error(format($$insert into public.cash_movements (session_id, kind, method, amount, created_by)
  values (%L, 'income', 'cash', 999999, %L)$$, (select session_id from t_ctx), :'seller'), 'permission denied');
-- Ni anular la factura
select public.t_expect_error(format($$select public.void_sales_document(%L, %L, 'error de carga')$$,
  (select invoice_id from t_ctx), (select session_id from t_ctx)), 'Permiso denegado');

do $$
declare b record;
begin
  select * into b from public.cash_session_balances where session_id = (select session_id from t_ctx);
  if b.cash_balance <> 70000 then raise exception 'Saldo efectivo esperado 70000, obtuve %', b.cash_balance; end if;
end $$;

-- Cierre con diferencia sin justificar -> error; luego cierre correcto
select public.t_expect_error(format($$select public.close_cash_session(%L, 69000)$$, (select session_id from t_ctx)), 'justificarla');
do $$
declare s public.cash_sessions;
begin
  s := public.close_cash_session((select session_id from t_ctx), 70000, null);
  if s.difference <> 0 or s.expected_cash <> 70000 then raise exception 'Cierre incorrecto %', row_to_json(s); end if;
  if (s.totals_by_method ->> 'transfer')::numeric <> 20000 then raise exception 'Totales por método mal: %', s.totals_by_method; end if;
end $$;

do $$
declare d public.sales_documents;
begin
  select * into d from public.sales_documents where id = (select invoice_id from t_ctx);
  if d.total <> 80000 or d.tax_total <> 13884.30 or d.number <> 1 then
    raise exception 'Factura B mal calculada: total %, iva %, nro %', d.total, d.tax_total, d.number;
  end if;
end $$;
reset role;

-- ─── 2. Inmutabilidad y cadena de auditoría ──────────────────────────────────
select public.t_expect_error($$update public.cash_movements set amount = 1$$, 'inmutable');
select public.t_expect_error($$delete from public.sales_documents$$, 'no se eliminan');
select public.t_expect_error($$update public.cash_sessions set notes = 'x'$$, 'cerrada');
select public.t_expect_error($$update audit.events set amount = 0$$, 'inmutable');

do $$
declare n int; v record;
begin
  select count(*) into n from audit.events
   where table_name = 'public.cash_movements' and actor_id = '00000000-0000-0000-0000-000000000002'
     and amount is not null and payment_method is not null;
  if n < 3 then raise exception 'Faltan eventos de caja en auditoría (%)', n; end if;
  select * into v from audit.verify_chain('11111111-1111-1111-1111-111111111111');
  if v.broken_event_id is not null then raise exception 'Cadena rota: %', row_to_json(v); end if;
end $$;

-- Manipulación detectada (superusuario desactiva el trigger dentro de una tx que se revierte)
begin;
alter table audit.events disable trigger events_no_update;
update audit.events set amount = 1 where id = (select min(id) + 3 from audit.events);
do $$
declare v record;
begin
  select * into v from audit.verify_chain('11111111-1111-1111-1111-111111111111');
  if v.broken_event_id is null then raise exception 'La manipulación NO fue detectada'; end if;
end $$;
rollback;

-- ─── 3. Portal: aislamiento entre clientes ───────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"' || :'clientA' || '"}', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.clients;               if n <> 1 then raise exception 'Cliente A ve % clientes', n; end if;
  select count(*) into n from public.monitored_resources;   if n <> 0 then raise exception 'Cliente ve infraestructura interna'; end if;
  select count(*) into n from public.portal_service_status(); if n <> 2 then raise exception 'Portal A debería ver 2 servicios, ve %', n; end if;
  select count(*) into n from public.sales_documents;       if n <> 2 then raise exception 'Cliente A debería ver 2 comprobantes, ve %', n; end if;
  select count(*) into n from public.cash_movements;        if n <> 0 then raise exception 'Cliente ve movimientos de caja'; end if;
  select count(*) into n from public.contracts;             if n <> 0 then raise exception 'Cliente ve contratos en borrador'; end if;
  select count(*) into n from public.employees;             if n <> 0 then raise exception 'Cliente ve RRHH'; end if;
  select count(*) into n from public.plans;                 if n <> 2 then raise exception 'Cliente debería ver planes para upgrade'; end if;
end $$;
insert into public.support_tickets (client_id, subject, description, priority)
values ('c0000000-0000-0000-0000-00000000000a', 'No carga el turnero', 'Desde las 10 h da error 500', 'urgent');
select public.request_plan_upgrade('b1000000-0000-0000-0000-000000000002', 'Queremos el asistente IA');
-- no puede abrir tickets a nombre de otro cliente
select public.t_expect_error($$insert into public.support_tickets (client_id, subject, description)
  values ('c0000000-0000-0000-0000-00000000000b', 'hack', 'hack')$$, 'row-level security');
reset role;

-- Nota interna del técnico: invisible para el cliente
insert into public.ticket_messages (ticket_id, author_id, body, is_internal)
select id, '00000000-0000-0000-0000-000000000003', 'Revisar pool de conexiones, posible fuga', true
from public.support_tickets where subject = 'No carga el turnero';
insert into public.ticket_messages (ticket_id, author_id, body)
select id, '00000000-0000-0000-0000-000000000003', 'Estamos trabajando en ello'
from public.support_tickets where subject = 'No carga el turnero';

select set_config('request.jwt.claims', '{"sub":"' || :'clientA' || '"}', false);
set role authenticated;
do $$
declare n int; t public.support_tickets;
begin
  select count(*) into n from public.ticket_messages; if n <> 1 then raise exception 'Cliente ve notas internas (%)', n; end if;
  select * into t from public.support_tickets where subject = 'No carga el turnero';
  if t.number is null or t.sla_due_at > now() + interval '5 hours' then raise exception 'SLA/numeración incorrecta'; end if;
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"' || :'clientB' || '"}', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.support_tickets; if n <> 0 then raise exception 'Cliente B ve tickets de A'; end if;
  select count(*) into n from public.sales_documents; if n <> 0 then raise exception 'Cliente B ve facturas de A'; end if;
end $$;
reset role;

-- ─── 4. Monitoreo: heartbeat + reglas + watchdog ─────────────────────────────
set role service_role;
select public.t_expect_error($$select public.record_heartbeat('aa000000-0000-0000-0000-000000000001', 'malo', '{}')$$, 'Token');
do $$
declare r jsonb; i int;
begin
  for i in 1..3 loop
    r := public.record_heartbeat('aa000000-0000-0000-0000-000000000001', 'demo-agent-token',
         jsonb_build_object('ts', now() - make_interval(secs => 10 * (3 - i)), 'cpu_pct', 95, 'mem_pct', 40, 'latency_ms', 120));
  end loop;
  if r ->> 'status' <> 'down' or jsonb_array_length(r -> 'events') <> 1 then
    raise exception 'Regla CPU crítica no disparó: %', r;
  end if;
  r := public.record_heartbeat('aa000000-0000-0000-0000-000000000001', 'demo-agent-token',
       jsonb_build_object('cpu_pct', 20, 'mem_pct', 40, 'latency_ms', 90));
  if r ->> 'status' <> 'operational' or r -> 'events' -> 0 ->> 'event' <> 'resolved' then
    raise exception 'La alerta no se resolvió: %', r;
  end if;
end $$;
-- Recurso sin latidos -> DOWN + alerta crítica (una sola vez)
update public.monitored_resources set last_heartbeat_at = now() - interval '10 minutes', status = 'operational'
 where id = 'aa000000-0000-0000-0000-000000000003';
do $$
declare n int;
begin
  select count(*) into n from public.detect_missed_heartbeats() where resource_name = 'camping-api';
  if n <> 1 then raise exception 'Watchdog no detectó caída'; end if;
  select count(*) into n from public.detect_missed_heartbeats(); if n <> 0 then raise exception 'Watchdog duplicó alertas'; end if;
end $$;
reset role;

-- authenticated no puede ingerir telemetría
select set_config('request.jwt.claims', '{"sub":"' || :'seller' || '"}', false);
set role authenticated;
select public.t_expect_error($$select public.record_heartbeat('aa000000-0000-0000-0000-000000000001', 'demo-agent-token', '{}')$$, 'permission denied');
reset role;

-- ─── 5. Owner: contratos, upgrade y comisiones ───────────────────────────────
select set_config('request.jwt.claims', '{"sub":"' || :'owner' || '"}', false);
set role authenticated;
select public.add_contract_version('c7000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111/c0000000-0000-0000-0000-00000000000a/c7000000-0000-0000-0000-000000000001/v1.pdf',
  repeat('ab', 32), 120000, 'Versión inicial');
select public.t_expect_error($$select public.add_contract_version('c7000000-0000-0000-0000-000000000001',
  'otro-tenant/x/y/v2.pdf', repeat('ab', 32), 1000)$$, 'fuera del espacio');
select public.sign_contract('c7000000-0000-0000-0000-000000000001', 'Juan Pérez (Barbería Juan)');
select public.t_expect_error($$update public.contracts set value_amount = 1 where id = 'c7000000-0000-0000-0000-000000000001'$$, 'firmado');

do $$
declare ch public.subscription_changes;
begin
  ch := public.change_subscription_plan('5b000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000002');
  if ch.kind <> 'upgrade' or ch.prorated_amount <= 0 or ch.prorated_amount > 30000 then
    raise exception 'Prorrateo de upgrade incorrecto: %', row_to_json(ch);
  end if;
end $$;

do $$
declare c public.commission_entries;
begin
  select * into c from public.calculate_commissions('11111111-1111-1111-1111-111111111111',
     date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date)
  where employee_id = 'e0000000-0000-0000-0000-000000000002';
  -- ventas 80.000 (la seña no computa) / meta 500.000 = 16 % -> tramo 5 % = 4.000
  if c.sales_amount <> 80000 or c.rate <> 5 or c.amount <> 4000 then
    raise exception 'Comisión incorrecta: %', row_to_json(c);
  end if;
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.audit_feed('11111111-1111-1111-1111-111111111111');
  if n = 0 then raise exception 'Owner no puede leer auditoría'; end if;
end $$;
reset role;

-- Vendedora no lee auditoría
select set_config('request.jwt.claims', '{"sub":"' || :'seller' || '"}', false);
set role authenticated;
select public.t_expect_error($$select * from public.audit_feed('11111111-1111-1111-1111-111111111111')$$, 'Permiso denegado');
reset role;

-- Vencimientos: aviso a 15 días, sin duplicar
do $$
declare n int;
begin
  select count(*) into n from public.process_contract_expirations(current_date); if n <> 1 then raise exception 'Aviso de vencimiento no generado (%)', n; end if;
  select count(*) into n from public.process_contract_expirations(current_date); if n <> 0 then raise exception 'Aviso duplicado'; end if;
end $$;

-- Ahora el cliente A ve su contrato firmado
select set_config('request.jwt.claims', '{"sub":"' || :'clientA' || '"}', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.contracts) <> 1 or (select count(*) from public.contract_versions) <> 1 then
    raise exception 'Cliente A no ve su contrato firmado';
  end if;
end $$;
reset role;

-- ─── 6. Landing pública (anon) ───────────────────────────────────────────────
select set_config('request.jwt.claims', '', false);
set role anon;
select public.submit_lead('9a000000-0000-0000-0000-000000000002', 'María Gómez', 'maria@gimnasio.com', '3875550000', 'Gym Norte', 'Quiero una demo');
select public.t_expect_error($$select public.submit_lead('9a000000-0000-0000-0000-000000000002', 'María Gómez', 'maria@gimnasio.com')$$, 'duplicada');
select public.t_expect_error($$select * from public.leads$$, 'permission denied');
select public.t_expect_error($$select * from public.calculate_commissions(null, null, null)$$, 'permission denied');
reset role;


-- ─── 7. RPCs de UI y hook de JWT ────────────────────────────────────────────
\o
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', false) \g /dev/null
set role authenticated;
select (public.audit_verify('11111111-1111-1111-1111-111111111111')).ok as auditoria_integra;
select public.dashboard_kpis('11111111-1111-1111-1111-111111111111') as kpis;
select count(*) as permisos_owner from public.my_permissions('11111111-1111-1111-1111-111111111111');
reset role;
select public.custom_access_token_hook('{"user_id":"00000000-0000-0000-0000-000000000010","claims":{}}') -> 'claims' as claims_portal;

drop function public.t_expect_error(text, text);
\echo '✔ 01_flows: OK'
