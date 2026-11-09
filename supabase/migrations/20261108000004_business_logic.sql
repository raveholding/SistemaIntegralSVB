-- =============================================================================
-- Sistema Integral SVB · 0004 · Lógica de negocio, integridad y triggers
-- =============================================================================
-- Regla de oro: las operaciones con dinero o valor legal (caja, comprobantes,
-- contratos firmados, comisiones) NO se escriben con INSERT/UPDATE directos
-- desde el cliente: pasan por funciones SECURITY DEFINER que validan permisos,
-- reglas de negocio y quedan auditadas en la misma transacción.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Herencia de tenant desde la fila padre (impide "spoofing" de tenant_id)
-- uso: execute function public.tg_inherit_tenant('public.clients', 'client_id')
-- ---------------------------------------------------------------------------
create or replace function public.tg_inherit_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  execute format('select tenant_id from %s where id = $1', tg_argv[0])
    into v_tenant using (to_jsonb(new) ->> tg_argv[1])::uuid;
  if v_tenant is null then
    raise exception 'Fila padre inexistente en % (%)', tg_argv[0], tg_argv[1];
  end if;
  new.tenant_id := v_tenant;
  return new;
end $$;

create trigger client_contacts_tenant     before insert or update of client_id   on public.client_contacts     for each row execute function public.tg_inherit_tenant('public.clients', 'client_id');
create trigger interactions_tenant        before insert or update of client_id   on public.interactions        for each row execute function public.tg_inherit_tenant('public.clients', 'client_id');
create trigger contract_versions_tenant   before insert                          on public.contract_versions   for each row execute function public.tg_inherit_tenant('public.contracts', 'contract_id');
create trigger subscription_changes_tenant before insert                         on public.subscription_changes for each row execute function public.tg_inherit_tenant('public.subscriptions', 'subscription_id');
create trigger cash_sessions_tenant       before insert                          on public.cash_sessions       for each row execute function public.tg_inherit_tenant('public.cash_registers', 'register_id');
create trigger cash_movements_tenant      before insert                          on public.cash_movements      for each row execute function public.tg_inherit_tenant('public.cash_sessions', 'session_id');
create trigger sales_items_tenant         before insert                          on public.sales_document_items for each row execute function public.tg_inherit_tenant('public.sales_documents', 'document_id');
create trigger sales_goals_tenant         before insert or update of employee_id on public.sales_goals         for each row execute function public.tg_inherit_tenant('public.employees', 'employee_id');
create trigger commission_entries_tenant  before insert                          on public.commission_entries  for each row execute function public.tg_inherit_tenant('public.employees', 'employee_id');
create trigger pages_tenant               before insert or update of site_id     on public.pages               for each row execute function public.tg_inherit_tenant('public.sites', 'site_id');
create trigger page_versions_tenant       before insert                          on public.page_versions       for each row execute function public.tg_inherit_tenant('public.pages', 'page_id');
create trigger deployments_tenant         before insert                          on public.deployments         for each row execute function public.tg_inherit_tenant('public.sites', 'site_id');
create trigger page_metrics_tenant        before insert                          on public.page_metrics_daily  for each row execute function public.tg_inherit_tenant('public.pages', 'page_id');
create trigger support_tickets_tenant     before insert                          on public.support_tickets     for each row execute function public.tg_inherit_tenant('public.clients', 'client_id');
create trigger ticket_messages_tenant     before insert                          on public.ticket_messages     for each row execute function public.tg_inherit_tenant('public.support_tickets', 'ticket_id');
create trigger metric_samples_tenant      before insert                          on public.metric_samples      for each row execute function public.tg_inherit_tenant('public.monitored_resources', 'resource_id');

-- ---------------------------------------------------------------------------
-- Inmutabilidad de libros
-- ---------------------------------------------------------------------------
create trigger cash_movements_immutable   before update or delete on public.cash_movements      for each row execute function audit.tg_immutable();
create trigger sales_items_immutable      before update or delete on public.sales_document_items for each row execute function audit.tg_immutable();
create trigger contract_versions_immutable before update or delete on public.contract_versions  for each row execute function audit.tg_immutable();
create trigger page_versions_immutable    before update or delete on public.page_versions       for each row execute function audit.tg_immutable();

-- Comprobantes: sólo se permite anular (issued -> voided) o completar CAE una vez
create or replace function public.tg_sales_document_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los comprobantes no se eliminan: anúlelos o emita nota de crédito' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['status','voided_by','voided_at','void_reason','cae','cae_due_date'])
     is distinct from
     (to_jsonb(old) - array['status','voided_by','voided_at','void_reason','cae','cae_due_date']) then
    raise exception 'Comprobante emitido: campos fiscales inmutables' using errcode = '42501';
  end if;
  if old.status = 'voided' then
    raise exception 'Comprobante ya anulado' using errcode = '42501';
  end if;
  if old.cae is not null and new.cae is distinct from old.cae then
    raise exception 'CAE ya asignado' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger sales_documents_guard before update or delete on public.sales_documents
  for each row execute function public.tg_sales_document_guard();

-- Caja cerrada = inmutable
create or replace function public.tg_cash_session_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las sesiones de caja no se eliminan' using errcode = '42501';
  end if;
  if old.status = 'closed' then
    raise exception 'La caja ya fue cerrada y es inmutable' using errcode = '42501';
  end if;
  if new.opening_amount <> old.opening_amount or new.opened_by <> old.opened_by
     or new.opened_at <> old.opened_at or new.register_id <> old.register_id then
    raise exception 'Datos de apertura inmutables' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger cash_sessions_guard before update or delete on public.cash_sessions
  for each row execute function public.tg_cash_session_guard();

-- Contrato firmado: sólo puede pasar a expired/terminated
create or replace function public.tg_contract_guard()
returns trigger language plpgsql as $$
begin
  if old.status = 'signed' then
    if new.status not in ('signed', 'expired', 'terminated')
       or new.current_version_id is distinct from old.current_version_id
       or new.value_amount is distinct from old.value_amount
       or new.start_date is distinct from old.start_date
       or new.client_id is distinct from old.client_id then
      raise exception 'Contrato firmado: sólo puede vencer, rescindirse o renovar su fecha fin'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger contracts_guard before update on public.contracts
  for each row execute function public.tg_contract_guard();

-- ---------------------------------------------------------------------------
-- Auditoría: adjuntar trigger a todas las tablas sensibles
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clients','memberships','contracts','contract_versions','plans','subscriptions',
    'subscription_changes','cash_registers','cash_sessions','sales_documents','employees',
    'commission_schemes','sales_goals','commission_entries','sites','pages','monitored_resources',
    'alert_rules','alerts','notification_channels','support_tickets','leads','client_contacts'
  ] loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function audit.tg_log()', t || '_audit', t);
  end loop;
end $$;
-- Movimientos de caja con monto y método denormalizados en el evento
create trigger cash_movements_audit after insert on public.cash_movements
  for each row execute function audit.tg_log('amount', 'method');

-- ═════════════════════════════════════════════════════════════════════════════
-- POS · CAJA
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.open_cash_session(p_register uuid, p_opening numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid;
begin
  select tenant_id into v_tenant from cash_registers where id = p_register and is_active;
  if v_tenant is null then raise exception 'Caja inexistente o inactiva'; end if;
  perform require_perm(v_tenant, 'pos.operate');

  insert into cash_sessions (register_id, opened_by, opening_amount)
  values (p_register, auth.uid(), p_opening)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Ya existe una caja abierta para esta registradora';
end $$;

create or replace function public.next_document_number(p_tenant uuid, p_type sales_doc_type, p_pos int)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into document_sequences (tenant_id, doc_type, point_of_sale, last_number)
  values (p_tenant, p_type, p_pos, 1)
  on conflict (tenant_id, doc_type, point_of_sale)
  do update set last_number = document_sequences.last_number + 1
  returning last_number into v;
  return v;
end $$;

-- Emite factura / ticket / recibo / recibo de seña, con sus pagos, en una sola tx.
-- p_items:    [{"description":"Abono PRO IA","quantity":1,"unit_price":80000,"tax_rate":21}]
-- p_payments: [{"method":"cash","amount":50000},{"method":"transfer","amount":30000,"reference":"op 123"}]
-- p_apply_deposit: id de un recibo de seña previo cuyo importe se descuenta del total a cobrar.
create or replace function public.issue_sales_document(
  p_session        uuid,
  p_doc_type       sales_doc_type,
  p_items          jsonb,
  p_payments       jsonb,
  p_client         uuid default null,
  p_apply_deposit  uuid default null,
  p_seller         uuid default null,
  p_customer_name  text default null,
  p_customer_tax_id text default null,
  p_subscription   uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s          cash_sessions;
  v_pos      int;
  v_doc      uuid;
  v_sub      numeric := 0;
  v_tax      numeric := 0;
  v_total    numeric;
  v_dep      sales_documents;
  v_due      numeric;
  v_paid     numeric := 0;
  it         jsonb;
  pay        jsonb;
  v_line     numeric;
  v_rate     numeric;
begin
  if p_doc_type = 'credit_note' then
    raise exception 'Use issue_credit_note() para notas de crédito';
  end if;

  select * into s from cash_sessions where id = p_session for update;
  if s.id is null or s.status <> 'open' then raise exception 'La caja no está abierta'; end if;
  perform require_perm(s.tenant_id, 'pos.operate');

  if p_client is not null and not exists (select 1 from clients where id = p_client and tenant_id = s.tenant_id) then
    raise exception 'Cliente inválido';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El comprobante requiere al menos un ítem';
  end if;

  -- Totales (Factura A discrimina IVA; B/ticket/recibos lo incluyen; C sin IVA)
  for it in select * from jsonb_array_elements(p_items) loop
    v_line := round((it ->> 'quantity')::numeric * (it ->> 'unit_price')::numeric, 2);
    v_rate := case when p_doc_type = 'invoice_c' then 0 else coalesce((it ->> 'tax_rate')::numeric, 21) end;
    v_sub  := v_sub + v_line;
    v_tax  := v_tax + case
                when p_doc_type = 'invoice_a' then round(v_line * v_rate / 100, 2)
                else round(v_line - v_line / (1 + v_rate / 100), 2)
              end;
  end loop;
  v_total := case when p_doc_type = 'invoice_a' then v_sub + v_tax else v_sub end;

  -- Seña aplicada
  v_due := v_total;
  if p_apply_deposit is not null then
    select * into v_dep from sales_documents
     where id = p_apply_deposit and tenant_id = s.tenant_id
       and doc_type = 'deposit_receipt' and status = 'issued' for update;
    if v_dep.id is null then raise exception 'Seña inexistente o anulada'; end if;
    if exists (select 1 from sales_documents where related_document_id = v_dep.id and status = 'issued') then
      raise exception 'La seña ya fue aplicada a otro comprobante';
    end if;
    if v_dep.total > v_total then raise exception 'La seña supera el total del comprobante'; end if;
    v_due := v_total - v_dep.total;
  end if;

  select coalesce(sum((x ->> 'amount')::numeric), 0) into v_paid from jsonb_array_elements(p_payments) x;
  if v_paid <> v_due then
    raise exception 'Pagos (%) no coinciden con el saldo a cobrar (%)', v_paid, v_due;
  end if;

  select point_of_sale into v_pos from cash_registers where id = s.register_id;

  insert into sales_documents (tenant_id, session_id, client_id, subscription_id, seller_id, doc_type,
                               point_of_sale, number, customer_name, customer_tax_id, subtotal,
                               tax_total, total, related_document_id, issued_by)
  values (s.tenant_id, s.id, p_client, p_subscription, coalesce(p_seller, auth.uid()), p_doc_type,
          v_pos, next_document_number(s.tenant_id, p_doc_type, v_pos),
          p_customer_name, p_customer_tax_id,
          case when p_doc_type = 'invoice_a' then v_sub else v_sub - v_tax end,
          v_tax, v_total, p_apply_deposit, auth.uid())
  returning id into v_doc;

  insert into sales_document_items (document_id, description, quantity, unit_price, tax_rate)
  select v_doc, x ->> 'description', (x ->> 'quantity')::numeric, (x ->> 'unit_price')::numeric,
         case when p_doc_type = 'invoice_c' then 0 else coalesce((x ->> 'tax_rate')::numeric, 21) end
  from jsonb_array_elements(p_items) x;

  for pay in select * from jsonb_array_elements(p_payments) loop
    if (pay ->> 'amount')::numeric <= 0 then raise exception 'Importe de pago inválido'; end if;
    insert into cash_movements (session_id, kind, document_id, method, amount, reference, created_by)
    values (s.id,
            (case when p_doc_type = 'deposit_receipt' then 'deposit' else 'sale' end)::cash_movement_kind,
            v_doc, (pay ->> 'method')::payment_method, (pay ->> 'amount')::numeric,
            pay ->> 'reference', auth.uid());
  end loop;

  return v_doc;
end $$;

-- Anulación (sólo tickets / recibos / señas: las facturas se revierten con NC)
create or replace function public.void_sales_document(p_document uuid, p_session uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare d sales_documents; s cash_sessions; m cash_movements;
begin
  select * into d from sales_documents where id = p_document for update;
  if d.id is null then raise exception 'Comprobante inexistente'; end if;
  perform require_perm(d.tenant_id, 'pos.void');
  if d.doc_type in ('invoice_a','invoice_b','invoice_c') then
    raise exception 'Las facturas no se anulan: emita una nota de crédito';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 5 then raise exception 'Indique el motivo de anulación'; end if;
  if exists (select 1 from sales_documents where related_document_id = d.id and status = 'issued') then
    raise exception 'La seña ya fue aplicada; anule primero el comprobante que la usa';
  end if;

  select * into s from cash_sessions where id = p_session and tenant_id = d.tenant_id and status = 'open';
  if s.id is null then raise exception 'Se requiere una caja abierta para registrar la reversión'; end if;

  for m in select * from cash_movements where document_id = d.id and reverses_id is null loop
    insert into cash_movements (session_id, kind, document_id, method, amount, reference, reverses_id, created_by)
    values (s.id, 'reversal', d.id, m.method, -m.amount, 'Anulación: ' || p_reason, m.id, auth.uid());
  end loop;

  update sales_documents set status = 'voided', voided_by = auth.uid(), voided_at = clock_timestamp(),
                             void_reason = p_reason
  where id = d.id;
end $$;

-- Ingresos / egresos / retiros manuales
create or replace function public.register_cash_movement(
  p_session uuid, p_kind cash_movement_kind, p_method payment_method, p_amount numeric, p_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare s cash_sessions; v_id uuid;
begin
  if p_kind not in ('income', 'expense', 'withdrawal') then
    raise exception 'Tipo no permitido para movimiento manual';
  end if;
  if p_amount <= 0 then raise exception 'El importe debe ser positivo'; end if;
  if coalesce(length(trim(p_reference)), 0) < 3 then raise exception 'Indique concepto/referencia'; end if;
  select * into s from cash_sessions where id = p_session and status = 'open';
  if s.id is null then raise exception 'La caja no está abierta'; end if;
  perform require_perm(s.tenant_id, case when p_kind = 'income' then 'pos.operate' else 'pos.supervise' end);

  insert into cash_movements (session_id, kind, method, amount, reference, created_by)
  values (s.id, p_kind, p_method,
          case when p_kind = 'income' then p_amount else -p_amount end, p_reference, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Saldo en vivo de una sesión
create or replace view public.cash_session_balances with (security_invoker = true) as
select s.id as session_id, s.tenant_id, s.register_id, s.status, s.opened_at, s.opened_by,
       s.opening_amount,
       s.opening_amount + coalesce(sum(m.amount) filter (where m.method = 'cash'), 0) as cash_balance,
       coalesce(sum(m.amount), 0)                                                 as total_movements,
       coalesce(sum(m.amount) filter (where m.kind in ('sale','deposit')), 0)       as gross_sales,
       count(m.id)                                                                  as movement_count
from public.cash_sessions s
left join public.cash_movements m on m.session_id = s.id
group by s.id;

create or replace function public.close_cash_session(p_session uuid, p_counted numeric, p_notes text default null)
returns public.cash_sessions language plpgsql security definer set search_path = public as $$
declare s cash_sessions; v_expected numeric; v_totals jsonb;
begin
  select * into s from cash_sessions where id = p_session for update;
  if s.id is null or s.status <> 'open' then raise exception 'La caja no está abierta'; end if;
  perform require_perm(s.tenant_id, 'pos.operate');
  if p_counted < 0 then raise exception 'Arqueo inválido'; end if;

  select s.opening_amount + coalesce(sum(amount) filter (where method = 'cash'), 0),
         coalesce(jsonb_object_agg(method, total) filter (where method is not null), '{}'::jsonb)
    into v_expected, v_totals
  from (select method, sum(amount) as total, sum(amount) as amount
          from cash_movements where session_id = s.id group by method) t;

  if p_counted <> v_expected and coalesce(length(trim(p_notes)), 0) < 5 then
    raise exception 'Diferencia de arqueo de %: debe justificarla en notas', p_counted - v_expected;
  end if;

  update cash_sessions
     set status = 'closed', closed_by = auth.uid(), closed_at = clock_timestamp(),
         expected_cash = v_expected, counted_cash = p_counted,
         totals_by_method = v_totals, notes = p_notes
   where id = s.id
  returning * into s;
  return s;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- CONTRATOS
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.add_contract_version(
  p_contract uuid, p_storage_path text, p_sha256 text, p_size bigint, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare c contracts; v_no int; v_id uuid;
begin
  select * into c from contracts where id = p_contract for update;
  if c.id is null then raise exception 'Contrato inexistente'; end if;
  perform require_perm(c.tenant_id, 'docs.write');
  if c.status not in ('draft', 'pending_signature') then
    raise exception 'Sólo se versionan contratos en borrador o pendientes de firma';
  end if;
  if p_storage_path not like c.tenant_id::text || '/' || c.client_id::text || '/' || c.id::text || '/%' then
    raise exception 'Ruta de almacenamiento fuera del espacio del contrato';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_no from contract_versions where contract_id = c.id;
  insert into contract_versions (contract_id, version_no, storage_path, file_sha256, file_size, change_note)
  values (c.id, v_no, p_storage_path, lower(p_sha256), p_size, p_note)
  returning id into v_id;

  update contracts set current_version_id = v_id where id = c.id;
  return v_id;
end $$;

create or replace function public.sign_contract(p_contract uuid, p_signed_by text)
returns void language plpgsql security definer set search_path = public as $$
declare c contracts;
begin
  select * into c from contracts where id = p_contract for update;
  perform require_perm(c.tenant_id, 'docs.sign');
  if c.current_version_id is null then raise exception 'El contrato no tiene PDF cargado'; end if;
  if c.status not in ('draft', 'pending_signature') then raise exception 'Estado inválido para firmar'; end if;
  if c.start_date is null then raise exception 'Defina fecha de inicio'; end if;
  update contracts set status = 'signed', signed_at = clock_timestamp(), signed_by_name = p_signed_by
   where id = c.id;
end $$;

-- Job programado (pg_cron o servicio de alertas): vence contratos y genera avisos.
-- Devuelve los avisos NUEVOS para que el servicio los envíe por Telegram.
create or replace function public.process_contract_expirations(p_today date default current_date)
returns table (tenant_id uuid, contract_id uuid, code text, client_name text, end_date date, days_left int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  -- 1) Renovación automática
  update contracts c set end_date = (c.end_date + interval '1 year')::date
   where c.status = 'signed' and c.auto_renew and c.end_date < p_today;
  -- 2) Vencimiento
  update contracts c set status = 'expired'
   where c.status = 'signed' and not c.auto_renew and c.end_date < p_today;
  -- 3) Avisos por umbral (dedupe por contrato+umbral)
  return query
  with due as (
    select c.tenant_id, c.id, c.code, coalesce(cl.trade_name, cl.legal_name) as client_name,
           c.end_date, (c.end_date - p_today) as days_left, d as threshold
    from contracts c
    join clients cl on cl.id = c.client_id
    cross join lateral unnest(c.notice_days) d
    where c.status = 'signed' and c.end_date - p_today = d
  ), ins as (
    insert into notifications (tenant_id, kind, title, body, link, dedupe_key)
    select due.tenant_id, 'contract_expiry',
           format('Contrato %s vence en %s días', due.code, due.days_left),
           format('%s · vencimiento %s', due.client_name, to_char(due.end_date, 'DD/MM/YYYY')),
           '/documentos/' || due.id,
           format('contract:%s:%s:%s', due.id, due.end_date, due.threshold)
    from due
    on conflict (tenant_id, dedupe_key) do nothing
    returning notifications.tenant_id, split_part(dedupe_key, ':', 2)::uuid as cid
  )
  select due.tenant_id, due.id, due.code, due.client_name, due.end_date, due.days_left
  from due join ins on ins.cid = due.id and ins.tenant_id = due.tenant_id;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- SUSCRIPCIONES · upgrade con prorrateo
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.change_subscription_plan(p_subscription uuid, p_new_plan uuid, p_effective date default current_date)
returns public.subscription_changes
language plpgsql security definer set search_path = public as $$
declare
  s subscriptions; p_old plans; p_new plans; v_change subscription_changes;
  v_days int; v_remaining int; v_old_price numeric; v_prorated numeric;
begin
  select * into s from subscriptions where id = p_subscription for update;
  if s.id is null then raise exception 'Suscripción inexistente'; end if;
  perform require_perm(s.tenant_id, 'billing.manage');
  select * into p_old from plans where id = s.plan_id;
  select * into p_new from plans where id = p_new_plan and tenant_id = s.tenant_id and is_active;
  if p_new.id is null then raise exception 'Plan destino inválido'; end if;
  if p_new.id = p_old.id then raise exception 'La suscripción ya está en ese plan'; end if;

  v_old_price := coalesce(s.price_override, p_old.price_monthly);
  v_days      := (s.current_period_end - s.current_period_start) + 1;
  v_remaining := greatest(0, (s.current_period_end - p_effective) + 1);
  v_prorated  := round((p_new.price_monthly - v_old_price) * v_remaining / v_days, 2);

  insert into subscription_changes (subscription_id, from_plan_id, to_plan_id, kind, prorated_amount, effective_at)
  values (s.id, p_old.id, p_new.id,
          case when p_new.tier > p_old.tier then 'upgrade' else 'downgrade' end,
          v_prorated, p_effective)
  returning * into v_change;

  update subscriptions set plan_id = p_new.id, price_override = null where id = s.id;
  return v_change;
end $$;

-- Desde el portal: el cliente solicita upgrade -> ticket comercial + interacción CRM
create or replace function public.request_plan_upgrade(p_plan uuid, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_tenant uuid; v_plan plans; v_ticket uuid;
begin
  select m.client_id, m.tenant_id into v_client, v_tenant
    from memberships m where m.user_id = auth.uid() and m.role = 'client_admin' and m.is_active limit 1;
  if v_client is null then raise exception 'Sólo el administrador del cliente puede solicitar cambios de plan' using errcode = '42501'; end if;
  select * into v_plan from plans where id = p_plan and tenant_id = v_tenant and is_active;
  if v_plan.id is null then raise exception 'Plan inválido'; end if;

  insert into support_tickets (client_id, subject, description, category, priority)
  values (v_client, 'Solicitud de upgrade a ' || v_plan.name,
          coalesce(p_comment, 'Solicitud generada desde el portal'), 'upgrade', 'high')
  returning id into v_ticket;

  insert into interactions (client_id, kind, subject, body)
  values (v_client, 'ticket', 'Solicitud de upgrade: ' || v_plan.name, p_comment);
  return v_ticket;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- RRHH · comisiones por tramos de cumplimiento
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.calculate_commissions(p_tenant uuid, p_start date, p_end date)
returns setof public.commission_entries
language plpgsql security definer set search_path = public as $$
begin
  perform require_perm(p_tenant, 'hr.manage');
  return query
  with sales as (
    select e.id as employee_id,
           coalesce(sum(case when d.doc_type = 'credit_note' then -d.total else d.total end), 0) as amount
    from employees e
    left join sales_documents d
           on d.seller_id = e.user_id and d.tenant_id = e.tenant_id and d.status = 'issued'
          and d.doc_type <> 'deposit_receipt'           -- la seña se computa al facturar
          and d.issued_at >= p_start and d.issued_at < p_end + 1
    where e.tenant_id = p_tenant and e.is_active and e.commission_scheme_id is not null
    group by e.id
  ), calc as (
    select s.employee_id, s.amount, g.target_amount,
           case when g.target_amount > 0 then round(s.amount / g.target_amount * 100, 2) end as pct,
           cs.base_rate, cs.tiers
    from sales s
    join employees e on e.id = s.employee_id
    join commission_schemes cs on cs.id = e.commission_scheme_id
    left join sales_goals g on g.employee_id = s.employee_id
                           and g.period_start <= p_start and g.period_end >= p_end - 1
  ), rated as (
    select c.*, coalesce((
        select (t ->> 'rate')::numeric from jsonb_array_elements(c.tiers) t
        where (t ->> 'from_pct')::numeric <= coalesce(c.pct, 0)
        order by (t ->> 'from_pct')::numeric desc limit 1), c.base_rate) as rate
    from calc c
  )
  insert into commission_entries (tenant_id, employee_id, period_start, period_end, sales_amount,
                                  goal_amount, achievement_pct, rate, amount)
  select p_tenant, r.employee_id, p_start, p_end, r.amount, r.target_amount, r.pct, r.rate,
         round(r.amount * r.rate / 100, 2)
  from rated r
  on conflict (employee_id, period_start, period_end) do update
     set sales_amount = excluded.sales_amount, goal_amount = excluded.goal_amount,
         achievement_pct = excluded.achievement_pct, rate = excluded.rate,
         amount = excluded.amount, calculated_at = now()
     where commission_entries.status = 'pending'          -- no pisa lo aprobado/pagado
  returning *;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- MONITOREO · ingestión de heartbeat + evaluación de reglas (atómico)
-- ═════════════════════════════════════════════════════════════════════════════
-- Llamado por el servicio de alertas (service_role). Devuelve las alertas
-- abiertas/resueltas en esta llamada para que el servicio notifique a Telegram.
create or replace function public.record_heartbeat(p_resource uuid, p_token text, p_metrics jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r          monitored_resources;
  rule       alert_rules;
  v_val      real;
  v_breaches int;
  v_events   jsonb := '[]'::jsonb;
  v_alert    alerts;
  v_status   health_status := 'operational';
  v_fp       text;
begin
  select * into r from monitored_resources where id = p_resource and is_active for update;
  if r.id is null or r.agent_token_hash is null or r.agent_token_hash <> sha256(convert_to(p_token, 'UTF8')) then
    raise exception 'Token de agente inválido' using errcode = '28000';
  end if;

  insert into metric_samples (resource_id, ts, cpu_pct, mem_pct, disk_pct, latency_ms, db_connections, extra)
  values (r.id, coalesce((p_metrics ->> 'ts')::timestamptz, clock_timestamp()),
          (p_metrics ->> 'cpu_pct')::real, (p_metrics ->> 'mem_pct')::real, (p_metrics ->> 'disk_pct')::real,
          (p_metrics ->> 'latency_ms')::real, (p_metrics ->> 'db_connections')::int, p_metrics -> 'extra')
  on conflict (resource_id, ts) do nothing;            -- reintentos del agente = idempotentes

  -- Resolver alerta de heartbeat si estaba caído
  for v_alert in
    update alerts set status = 'resolved', resolved_at = now()
     where tenant_id = r.tenant_id and fingerprint = 'hb:' || r.id and status <> 'resolved'
    returning *
  loop
    v_events := v_events || jsonb_build_object('event', 'resolved', 'alert_id', v_alert.id,
                 'severity', v_alert.severity, 'title', v_alert.title);
  end loop;

  for rule in
    select * from alert_rules
     where tenant_id = r.tenant_id and is_active and metric <> 'heartbeat'
       and (resource_id is null or resource_id = r.id)
  loop
    execute format(
      'select count(*) from (select %1$I as v from public.metric_samples
          where resource_id = $1 order by ts desc limit $2) x
        where x.v %2$s $3', rule.metric, rule.operator)
      into v_breaches using r.id, rule.for_samples, rule.threshold;
    v_val := (p_metrics ->> rule.metric)::real;
    v_fp  := 'rule:' || rule.id || ':' || r.id;

    if v_breaches >= rule.for_samples then
      if rule.severity = 'critical' then v_status := 'down';
      elsif v_status = 'operational' then v_status := 'degraded'; end if;

      insert into alerts (tenant_id, resource_id, rule_id, severity, title, message, value, fingerprint)
      values (r.tenant_id, r.id, rule.id, rule.severity,
              format('%s: %s %s %s', r.name, rule.metric, rule.operator, rule.threshold),
              format('Valor actual %s durante %s muestras', v_val, rule.for_samples), v_val, v_fp)
      on conflict (tenant_id, fingerprint) where status <> 'resolved' do nothing
      returning * into v_alert;
      if v_alert.id is not null then
        v_events := v_events || jsonb_build_object('event', 'opened', 'alert_id', v_alert.id,
                     'severity', v_alert.severity, 'title', v_alert.title, 'message', v_alert.message);
      end if;
      v_alert := null;
    else
      for v_alert in
        update alerts set status = 'resolved', resolved_at = now()
         where tenant_id = r.tenant_id and fingerprint = v_fp and status <> 'resolved'
        returning *
      loop
        v_events := v_events || jsonb_build_object('event', 'resolved', 'alert_id', v_alert.id,
                     'severity', v_alert.severity, 'title', v_alert.title);
      end loop;
    end if;
  end loop;

  update monitored_resources
     set last_heartbeat_at = now(),
         status_changed_at = case when status <> v_status then now() else status_changed_at end,
         status = case when status = 'maintenance' then status else v_status end
   where id = r.id;

  return jsonb_build_object('resource_id', r.id, 'tenant_id', r.tenant_id, 'status', v_status, 'events', v_events);
end $$;

-- Watchdog: marca DOWN los recursos sin latido y abre alerta crítica
create or replace function public.detect_missed_heartbeats()
returns table (tenant_id uuid, alert_id uuid, resource_name text, last_heartbeat_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with stale as (
    update monitored_resources r
       set status = 'down', status_changed_at = now()
     where r.is_active and r.status not in ('down', 'maintenance')
       and coalesce(r.last_heartbeat_at, r.created_at)
           < now() - make_interval(secs => r.heartbeat_interval_s * r.missed_beats_down)
    returning r.*
  ), ins as (
    insert into alerts (tenant_id, resource_id, severity, title, message, fingerprint)
    select s.tenant_id, s.id, 'critical', s.name || ': sin heartbeat',
           format('Último latido: %s', coalesce(to_char(s.last_heartbeat_at, 'DD/MM HH24:MI:SS'), 'nunca')),
           'hb:' || s.id
    from stale s
    on conflict (tenant_id, fingerprint) where status <> 'resolved' do nothing
    returning alerts.id, alerts.tenant_id, alerts.resource_id
  )
  select ins.tenant_id, ins.id, s.name, s.last_heartbeat_at
  from ins join stale s on s.id = ins.resource_id;
end $$;

create or replace function public.acknowledge_alert(p_alert uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a alerts;
begin
  select * into a from alerts where id = p_alert;
  perform require_perm(a.tenant_id, 'monitor.manage');
  update alerts set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid()
   where id = p_alert and status = 'open';
end $$;

-- Rotación de token del agente: devuelve el token en claro UNA sola vez
create or replace function public.rotate_agent_token(p_resource uuid)
returns text language plpgsql security definer set search_path = public as $$
declare r monitored_resources; v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  select * into r from monitored_resources where id = p_resource;
  perform require_perm(r.tenant_id, 'monitor.manage');
  update monitored_resources set agent_token_hash = sha256(convert_to(v_token, 'UTF8')) where id = r.id;
  return v_token;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- PORTAL · vista simplificada del estado del servicio (sin datos técnicos)
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.portal_service_status()
returns table (resource_id uuid, service_name text, status health_status, since timestamptz, uptime_30d numeric)
language sql stable security definer set search_path = public as $$
  select r.id, coalesce(r.public_name, initcap(replace(r.kind::text, '_', ' '))), r.status, r.status_changed_at,
         round(100 - coalesce((
           select sum(extract(epoch from (coalesce(a.resolved_at, now()) - greatest(a.opened_at, now() - interval '30 days'))))
           from alerts a
           where a.resource_id = r.id and a.severity = 'critical'
             and coalesce(a.resolved_at, now()) > now() - interval '30 days'
         ), 0) / (30 * 86400) * 100, 2)
  from monitored_resources r
  where r.is_active and r.client_id in (select public.my_client_ids())
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- TICKETS · numeración y SLA
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.tg_ticket_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ticket:' || new.tenant_id, 0));
  select coalesce(max(number), 0) + 1 into new.number from support_tickets where tenant_id = new.tenant_id;
  new.sla_due_at := now() + case new.priority
    when 'urgent' then interval '4 hours' when 'high' then interval '1 day'
    when 'normal' then interval '3 days' else interval '5 days' end;
  return new;
end $$;
-- se ejecuta DESPUÉS de support_tickets_tenant (orden alfabético de triggers)
create trigger support_tickets_zz_defaults before insert on public.support_tickets
  for each row execute function public.tg_ticket_defaults();

-- ═════════════════════════════════════════════════════════════════════════════
-- CMS · publicación versionada y captación de leads
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.publish_page(p_page uuid)
returns int language plpgsql security definer set search_path = public as $$
declare p pages; v_no int;
begin
  select * into p from pages where id = p_page for update;
  perform require_perm(p.tenant_id, 'cms.publish');
  select coalesce(max(version_no), 0) + 1 into v_no from page_versions where page_id = p.id;
  insert into page_versions (page_id, version_no, title, blocks, seo, created_by)
  values (p.id, v_no, p.title, p.blocks, p.seo, auth.uid());
  update pages set status = 'published', published_at = now(), version_no = v_no where id = p.id;
  return v_no;
end $$;

-- Endpoint público (anon) para formularios de landing pages
create or replace function public.submit_lead(
  p_page uuid, p_name text, p_email text, p_phone text default null,
  p_company text default null, p_message text default null, p_utm jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare p pages; v_id uuid;
begin
  select * into p from pages where id = p_page and status = 'published';
  if p.id is null then raise exception 'Página no disponible'; end if;
  if length(coalesce(p_name, '')) < 2 or (p_email is null and p_phone is null) then
    raise exception 'Datos de contacto incompletos';
  end if;
  if p_email is not null and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email inválido';
  end if;
  -- anti-flood básico
  if exists (select 1 from leads where tenant_id = p.tenant_id and email = p_email::citext
             and created_at > now() - interval '2 minutes') then
    raise exception 'Solicitud duplicada';
  end if;

  insert into leads (tenant_id, page_id, full_name, email, phone, company, message, utm)
  values (p.tenant_id, p.id, left(p_name, 120), p_email, left(p_phone, 40), left(p_company, 120),
          left(p_message, 2000), coalesce(p_utm, '{}'))
  returning id into v_id;

  insert into page_metrics_daily (page_id, day, leads) values (p.id, current_date, 1)
  on conflict (page_id, day) do update set leads = page_metrics_daily.leads + 1;

  insert into notifications (tenant_id, kind, title, body, link)
  values (p.tenant_id, 'lead', 'Nuevo lead: ' || p_name, p.title, '/cms/leads');
  return v_id;
end $$;

create or replace function public.track_page_view(p_page uuid, p_unique boolean default false, p_load_ms int default null)
returns void language sql security definer set search_path = public as $$
  insert into page_metrics_daily (page_id, day, views, unique_visitors, avg_load_ms)
  select id, current_date, 1, p_unique::int, p_load_ms from pages where id = p_page and status = 'published'
  on conflict (page_id, day) do update
    set views = page_metrics_daily.views + 1,
        unique_visitors = page_metrics_daily.unique_visitors + excluded.unique_visitors,
        avg_load_ms = coalesce((coalesce(page_metrics_daily.avg_load_ms, excluded.avg_load_ms) * 9 + excluded.avg_load_ms) / 10,
                               page_metrics_daily.avg_load_ms)
$$;
