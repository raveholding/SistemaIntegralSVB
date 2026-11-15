-- =============================================================================
-- Pruebas de licencias por paquete: candado por módulo, Pro+IA, seguimiento.
-- Corre después de 01_flows.sql (usa el seed: tenant 1111…, vendedora y dueño).
-- =============================================================================
\set QUIET on
\o /dev/null
\set seller  '00000000-0000-0000-0000-000000000002'
\set owner   '00000000-0000-0000-0000-000000000001'
\set tenant  '11111111-1111-1111-1111-111111111111'

reset role;
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

create or replace function public.t_count_perms(p_user uuid, p_tenant uuid) returns int
language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', '{"sub":"' || p_user || '"}', true);
  set local role authenticated;
  select count(*) into n from public.my_permissions(p_tenant);
  reset role;
  return n;
end $$;

-- 1. completo_app: el dueño tiene los 21 permisos
select public.set_license(:'tenant', 'completo_app', true);
do $$ begin
  if public.t_count_perms('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') <> 21 then
    raise exception 'completo_app debería habilitar los 21 permisos'; end if;
  if not public.module_enabled('11111111-1111-1111-1111-111111111111', 'ai') then
    raise exception 'Pro+IA debería habilitar ai'; end if;
end $$;

-- 2. Paquete Menú: sólo cms (+ audit/settings/billing que no dependen de módulo)
select public.set_license(:'tenant', 'menu', false);
do $$
declare v_perms text[];
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
  set local role authenticated;
  select array_agg(p order by p) into v_perms from public.my_permissions('11111111-1111-1111-1111-111111111111') p;
  reset role;
  if v_perms is distinct from array['audit.read','billing.manage','cms.publish','cms.read','cms.write','settings.manage'] then
    raise exception 'Permisos del paquete Menú inesperados: %', v_perms; end if;
  if public.module_enabled('11111111-1111-1111-1111-111111111111', 'pos') then raise exception 'pos no debe estar en Menú'; end if;
  if public.module_enabled('11111111-1111-1111-1111-111111111111', 'ai') then raise exception 'ai no debe estar sin Pro+IA'; end if;
end $$;

-- 3. RLS y funciones de negocio quedan cerradas bajo Menú (la vendedora no puede operar caja ni ver clientes)
select set_config('request.jwt.claims', '{"sub":"' || :'seller' || '"}', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.clients) <> 0 then raise exception 'RLS: clients visible sin módulo crm'; end if;
  if (select count(*) from public.cash_registers) <> 0 then raise exception 'RLS: cajas visibles sin módulo pos'; end if;
end $$;
select public.t_expect_error($$select public.open_cash_session('ca000000-0000-0000-0000-000000000001', 100)$$, 'Permiso denegado');
reset role;

-- 4. Un cliente NO puede auto-subirse de plan
select set_config('request.jwt.claims', '{"sub":"' || :'owner' || '"}', false);
set role authenticated;
select public.t_expect_error($$update public.tenant_licenses set package_code = 'completo_app'$$, 'permission denied');
select public.t_expect_error($$select public.set_license('11111111-1111-1111-1111-111111111111','completo_app',true)$$, 'permission denied');
reset role;

-- 5. Subir a crm_pos habilita crm y pos, pero no hr/docs/monitor/portal
select public.set_license(:'tenant', 'crm_pos', false);
select set_config('request.jwt.claims', '{"sub":"' || :'seller' || '"}', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.clients) = 0 then raise exception 'crm_pos debería ver clientes'; end if;
  if not public.has_perm('11111111-1111-1111-1111-111111111111', 'pos.operate') then raise exception 'crm_pos habilita pos'; end if;
  if public.has_perm('11111111-1111-1111-1111-111111111111', 'docs.read') then raise exception 'crm_pos NO habilita docs'; end if;
  if public.has_perm('11111111-1111-1111-1111-111111111111', 'tickets.read') then raise exception 'crm_pos NO habilita portal/tickets'; end if;
end $$;
reset role;

-- 6. Seguimiento por mora: NO bloquea, marca y notifica (idempotente en el día)
select set_config('request.jwt.claims', '{"sub":"' || :'owner' || '"}', false);
set role authenticated;
select public.flag_license_follow_up(:'tenant', 'Mantenimiento de octubre pendiente');
select public.flag_license_follow_up(:'tenant', 'Mantenimiento de octubre pendiente');
do $$ begin
  if (select status from public.tenant_licenses) <> 'follow_up' then raise exception 'debería quedar en seguimiento'; end if;
  if not public.has_perm('11111111-1111-1111-1111-111111111111', 'pos.operate') then raise exception 'seguimiento NO debe bloquear'; end if;
  if (select count(*) from public.notifications where kind = 'license_follow_up') <> 1 then raise exception 'aviso duplicado o ausente'; end if;
  if public.my_license('11111111-1111-1111-1111-111111111111') ->> 'status' <> 'follow_up' then raise exception 'my_license sin seguimiento'; end if;
end $$;
select public.clear_license_follow_up(:'tenant');
do $$ begin
  if (select status from public.tenant_licenses) <> 'active' then raise exception 'debería volver a active'; end if;
end $$;
reset role;

-- 7. Licencia cancelada o inexistente = candado total (sin licencia, nada)
update public.tenant_licenses set status = 'canceled';
select set_config('request.jwt.claims', '{"sub":"' || :'owner' || '"}', false);
set role authenticated;
do $$ begin
  if public.has_perm('11111111-1111-1111-1111-111111111111', 'crm.read') then raise exception 'cancelada debe bloquear'; end if;
end $$;
reset role;

-- Restaurar estado del seed
select public.set_license(:'tenant', 'completo_app', true);
\o
\echo licencias OK
