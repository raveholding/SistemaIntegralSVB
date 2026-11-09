-- =============================================================================
-- Sistema Integral SVB · 0002 · Pista de auditoría inmutable (Audit Trail)
-- =============================================================================
-- Garantías:
--   1. Append-only: UPDATE/DELETE/TRUNCATE bloqueados por trigger y por GRANT.
--   2. Encadenamiento criptográfico por tenant: hash = sha256(prev_hash || fila).
--      Alterar o borrar cualquier evento rompe la cadena -> audit.verify_chain().
--   3. Captura de contexto: usuario (auth.uid), rol, IP y User-Agent desde los
--      headers que PostgREST expone en request.headers, y request_id opcional.
--   4. Timestamp con clock_timestamp() (hora real del evento, no de la tx).
-- =============================================================================

create schema if not exists audit;

create table audit.events (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null,
  occurred_at  timestamptz not null default clock_timestamp(),
  actor_id     uuid,                    -- auth.uid(); null = sistema/servicio
  actor_role   text,                    -- rol app del actor en ese tenant
  db_role      text not null default current_user,
  action       text not null,           -- INSERT | UPDATE | DELETE | <evento de negocio>
  table_name   text not null,
  record_id    text,
  old_data     jsonb,
  new_data     jsonb,
  changed_cols text[],
  amount       numeric(14,2),           -- denormalizado para auditorías de caja
  payment_method text,
  ip           inet,
  user_agent   text,
  request_id   text,
  prev_hash    bytea,
  hash         bytea not null
);

create index audit_events_tenant_time_idx on audit.events (tenant_id, occurred_at desc);
create index audit_events_record_idx      on audit.events (table_name, record_id);
create index audit_events_actor_idx       on audit.events (actor_id, occurred_at desc);

-- Último hash por tenant (evita escanear la tabla para encadenar)
create table audit.chain_heads (
  tenant_id  uuid primary key,
  last_id    bigint not null,
  last_hash  bytea not null
);

-- ---------------------------------------------------------------------------
-- Contexto de la request (PostgREST) con fallback a GUCs propios app.*
-- ---------------------------------------------------------------------------
create or replace function audit.request_header(name text)
returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> name,
    nullif(current_setting('app.' || replace(name, '-', '_'), true), '')
  )
$$;

create or replace function audit.client_ip()
returns inet language plpgsql stable as $$
declare raw text;
begin
  raw := split_part(coalesce(audit.request_header('x-forwarded-for'),
                             audit.request_header('x-real-ip')), ',', 1);
  return nullif(trim(raw), '')::inet;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Escritura central de eventos (única puerta de entrada)
-- ---------------------------------------------------------------------------
create or replace function audit.write_event(
  p_tenant uuid, p_action text, p_table text, p_record text,
  p_old jsonb, p_new jsonb, p_amount numeric default null, p_method text default null
) returns bigint
language plpgsql security definer set search_path = audit, public as $$
declare
  v_prev   bytea;
  v_hash   bytea;
  v_id     bigint;
  v_actor  uuid := auth.uid();
  v_role   text;
  v_ts     timestamptz := clock_timestamp();
  v_cols   text[];
  v_ip     inet := audit.client_ip();
  v_ua     text := audit.request_header('user-agent');
  v_req    text := audit.request_header('x-request-id');
begin
  -- serializa la cadena por tenant
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text, 42));

  select role::text into v_role from public.memberships
   where tenant_id = p_tenant and user_id = v_actor;

  if p_old is not null and p_new is not null then
    select array_agg(k order by k) into v_cols
    from jsonb_object_keys(p_new) k
    where p_new -> k is distinct from p_old -> k;
  end if;

  select last_hash into v_prev from audit.chain_heads where tenant_id = p_tenant for update;

  v_hash := sha256(
    coalesce(v_prev, '\x'::bytea) ||
    convert_to(concat_ws('|',
      p_tenant, extract(epoch from v_ts), v_actor, p_action, p_table, p_record,
      p_old::text, p_new::text, p_amount, p_method), 'UTF8')
  );

  insert into audit.events (tenant_id, occurred_at, actor_id, actor_role, action, table_name,
                            record_id, old_data, new_data, changed_cols, amount, payment_method,
                            ip, user_agent, request_id, prev_hash, hash)
  values (p_tenant, v_ts, v_actor, v_role, p_action, p_table, p_record, p_old, p_new, v_cols,
          p_amount, p_method, v_ip, v_ua, v_req, v_prev, v_hash)
  returning id into v_id;

  insert into audit.chain_heads (tenant_id, last_id, last_hash)
  values (p_tenant, v_id, v_hash)
  on conflict (tenant_id) do update set last_id = excluded.last_id, last_hash = excluded.last_hash;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Trigger genérico para tablas de negocio.
-- Argumentos opcionales: TG_ARGV[0] = columna de monto, TG_ARGV[1] = columna método
-- ---------------------------------------------------------------------------
create or replace function audit.tg_log()
returns trigger language plpgsql security definer set search_path = audit, public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_amount numeric;
  v_method text;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;  -- no registrar updates vacíos
  end if;
  if tg_nargs > 0 then v_amount := nullif(v_row ->> tg_argv[0], '')::numeric; end if;
  if tg_nargs > 1 then v_method := v_row ->> tg_argv[1]; end if;

  perform audit.write_event(
    (v_row ->> 'tenant_id')::uuid, tg_op, tg_table_schema || '.' || tg_table_name,
    v_row ->> 'id', v_old, v_new, v_amount, v_method);

  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------------
-- Inmutabilidad
-- ---------------------------------------------------------------------------
create or replace function audit.tg_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Registro inmutable (%.%): operación % no permitida',
    tg_table_schema, tg_table_name, tg_op using errcode = '42501';
end $$;

create trigger events_no_update before update or delete on audit.events
  for each row execute function audit.tg_immutable();
create trigger events_no_truncate before truncate on audit.events
  for each statement execute function audit.tg_immutable();

revoke all on audit.events, audit.chain_heads from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on audit.events, audit.chain_heads from anon, authenticated;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Verificación de integridad: devuelve el primer evento roto (o nada si OK)
-- ---------------------------------------------------------------------------
create or replace function audit.verify_chain(p_tenant uuid)
returns table (broken_event_id bigint, reason text)
language plpgsql stable security definer set search_path = audit, public as $$
declare
  r      audit.events;
  v_prev bytea := null;
  v_calc bytea;
begin
  for r in select * from audit.events where tenant_id = p_tenant order by id loop
    if r.prev_hash is distinct from v_prev then
      broken_event_id := r.id; reason := 'prev_hash no coincide (evento faltante o reordenado)';
      return next; return;
    end if;
    v_calc := sha256(
      coalesce(v_prev, '\x'::bytea) ||
      convert_to(concat_ws('|',
        r.tenant_id, extract(epoch from r.occurred_at), r.actor_id, r.action, r.table_name, r.record_id,
        r.old_data::text, r.new_data::text, r.amount, r.payment_method), 'UTF8'));
    if v_calc <> r.hash then
      broken_event_id := r.id; reason := 'hash inválido (contenido alterado)';
      return next; return;
    end if;
    v_prev := r.hash;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Lectura para la UI: sólo quien tenga audit.read en el tenant
-- ---------------------------------------------------------------------------
create or replace function public.audit_feed(
  p_tenant uuid, p_table text default null, p_record text default null,
  p_limit int default 100, p_before bigint default null)
returns setof audit.events
language plpgsql stable security definer set search_path = audit, public as $$
begin
  perform public.require_perm(p_tenant, 'audit.read');
  return query
    select * from audit.events e
    where e.tenant_id = p_tenant
      and (p_table is null or e.table_name = p_table)
      and (p_record is null or e.record_id = p_record)
      and (p_before is null or e.id < p_before)
    order by e.id desc
    limit least(p_limit, 500);
end $$;

-- Evento de negocio explícito (ej. LOGIN, EXPORT, PRINT_TICKET)
create or replace function public.audit_business_event(
  p_tenant uuid, p_action text, p_entity text, p_record text, p_payload jsonb default '{}')
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if p_tenant not in (select public.staff_tenants())
     and p_tenant not in (select tenant_id from public.memberships where user_id = auth.uid()) then
    raise exception 'Sin acceso al tenant' using errcode = '42501';
  end if;
  return audit.write_event(p_tenant, upper(p_action), p_entity, p_record, null, p_payload);
end $$;
