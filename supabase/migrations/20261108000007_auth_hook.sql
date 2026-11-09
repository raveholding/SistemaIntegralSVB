-- =============================================================================
-- Sistema Integral SVB · 0007 · Claims en el JWT y RPCs de soporte para la UI
-- =============================================================================
-- Custom Access Token Hook (Supabase Auth > Hooks): inyecta tenant/rol/cliente
-- en el JWT para que el middleware de Next.js enrute sin consultar la base.
-- La AUTORIZACIÓN real sigue en RLS; los claims sólo sirven para UX/enrutamiento.
-- =============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  m record;
begin
  select tenant_id, role, client_id into m
  from public.memberships
  where user_id = (event ->> 'user_id')::uuid and is_active
  order by case when role = any (public.staff_roles()) then 0 else 1 end, created_at
  limit 1;

  if m.tenant_id is not null then
    v_claims := v_claims || jsonb_build_object(
      'svb', jsonb_build_object(
        'tenant_id', m.tenant_id,
        'role',      m.role,
        'client_id', m.client_id,
        'portal',    m.role in ('client_admin', 'client_user')));
  end if;
  return jsonb_set(event, '{claims}', v_claims);
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
    grant select on public.memberships to supabase_auth_admin;
    create policy memberships_auth_hook on public.memberships for select to supabase_auth_admin using (true);
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon;
  end if;
end $$;

-- Permisos efectivos del usuario actual (para mostrar/ocultar UI)
create or replace function public.my_permissions(p_tenant uuid)
returns setof text language sql stable security definer set search_path = public as $$
  select p.code from public.permissions p where public.has_perm(p_tenant, p.code)
$$;

-- Verificación de integridad de auditoría expuesta a la UI
create or replace function public.audit_verify(p_tenant uuid)
returns table (ok boolean, broken_event_id bigint, reason text, events_checked bigint)
language plpgsql stable security definer set search_path = public, audit as $$
declare v record;
begin
  perform public.require_perm(p_tenant, 'audit.read');
  select * into v from audit.verify_chain(p_tenant) limit 1;
  ok := v.broken_event_id is null;
  broken_event_id := v.broken_event_id;
  reason := v.reason;
  select count(*) into events_checked from audit.events where tenant_id = p_tenant;
  return next;
end $$;

-- KPIs del tablero ejecutivo en una sola llamada
create or replace function public.dashboard_kpis(p_tenant uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if p_tenant not in (select public.staff_tenants()) then
    raise exception 'Sin acceso' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'mrr', (select coalesce(sum(coalesce(s.price_override, p.price_monthly)), 0)
              from subscriptions s join plans p on p.id = s.plan_id
             where s.tenant_id = p_tenant and s.status in ('active', 'past_due')),
    'active_clients', (select count(*) from clients where tenant_id = p_tenant and status = 'active'),
    'ai_share', (select round(100.0 * count(*) filter (where p.includes_ai) / nullif(count(*), 0), 1)
                   from subscriptions s join plans p on p.id = s.plan_id
                  where s.tenant_id = p_tenant and s.status = 'active'),
    'resources', (select jsonb_object_agg(status, n) from (
                    select status, count(*) n from monitored_resources
                     where tenant_id = p_tenant and is_active group by status) x),
    'open_alerts', (select count(*) from alerts where tenant_id = p_tenant and status <> 'resolved'),
    'open_tickets', (select count(*) from support_tickets where tenant_id = p_tenant and status in ('open','in_progress')),
    'contracts_expiring_30d', (select count(*) from contracts where tenant_id = p_tenant and status = 'signed'
                                 and end_date between current_date and current_date + 30),
    'sales_month', (select coalesce(sum(case when doc_type = 'credit_note' then -total else total end), 0)
                      from sales_documents where tenant_id = p_tenant and status = 'issued'
                       and doc_type <> 'deposit_receipt'
                       and issued_at >= date_trunc('month', now())),
    'new_leads_7d', (select count(*) from leads where tenant_id = p_tenant and created_at > now() - interval '7 days')
  ) into v;
  return v;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on function public.my_permissions(uuid), public.audit_verify(uuid), public.dashboard_kpis(uuid) from anon;
    grant execute on function public.my_permissions(uuid), public.audit_verify(uuid), public.dashboard_kpis(uuid) to authenticated;
  end if;
end $$;
