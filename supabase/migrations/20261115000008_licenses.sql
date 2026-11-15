-- =============================================================================
-- Sistema Integral SVB · 0008 · Licencias por paquete (candado por módulo)
-- =============================================================================
-- Cada tenant (instalación vendida) tiene UNA licencia: un paquete (combo) y,
-- opcionalmente, el nivel extra "Pro + IA". El candado se aplica en la base:
-- tenants_with() (de la que cuelgan RLS y todas las funciones de negocio vía
-- require_perm) exige que el módulo del permiso esté incluido en la licencia.
-- La UI sólo refleja el estado; no es la autoridad.
--
-- Mantenimiento impago: NO bloquea. Marca la licencia "en seguimiento"
-- (follow_up) y avisa al equipo para hablar con el cliente y mantenerlo activo.
-- =============================================================================

create table public.license_packages (
  code        text primary key,
  name        text not null,
  tier        int  not null unique,
  modules     text[] not null,
  price_once  numeric(14,2) not null check (price_once >= 0),   -- pago único de lista (ARS)
  description text
);

insert into public.license_packages (code, name, tier, modules, price_once, description) values
  ('menu',         'Menú',            1, array['cms'],                                                  100000,  'Menú digital / web'),
  ('crm_pos',      'Menú + CRM/POS',  2, array['cms','crm','pos'],                                      400000,  'Menú, clientes, caja y punto de venta'),
  ('completo',     'Completo',        3, array['cms','crm','pos','docs','hr','monitor'],                700000,  'Gestión completa'),
  ('completo_app', 'Completo + App',  4, array['cms','crm','pos','docs','hr','monitor','portal'],       1200000, 'Gestión completa + app/portal para el cliente');

create type public.license_status as enum ('active', 'follow_up', 'canceled');

create table public.tenant_licenses (
  tenant_id          uuid primary key references public.tenants (id) on delete cascade,
  package_code       text not null references public.license_packages (code),
  ai_enabled         boolean not null default false,        -- nivel extra Pro + IA
  status             public.license_status not null default 'active',
  follow_up_since    date,
  follow_up_note     text,
  updated_at         timestamptz not null default now(),
  check ((status = 'follow_up') = (follow_up_since is not null))
);
create trigger tenant_licenses_touch before update on public.tenant_licenses
  for each row execute function public.tg_touch_updated_at();
create trigger tenant_licenses_audit after insert or update or delete on public.tenant_licenses
  for each row execute function audit.tg_log();

alter table public.license_packages enable row level security;
alter table public.tenant_licenses  enable row level security;
create policy license_packages_select on public.license_packages for select to authenticated using (true);
create policy tenant_licenses_select on public.tenant_licenses for select to authenticated
  using (tenant_id in (select tenant_id from public.memberships where user_id = auth.uid() and is_active));
-- Sin políticas de escritura: sólo service_role (o set_license) cambia licencias.
revoke insert, update, delete on public.tenant_licenses, public.license_packages from anon, authenticated;

-- Módulo que gobierna cada permiso (null = siempre disponible)
create or replace function public.perm_module(perm text)
returns text language sql immutable as $$
  select case split_part(perm, '.', 1)
    when 'cms' then 'cms'
    when 'crm' then 'crm'
    when 'pos' then 'pos'
    when 'docs' then 'docs'
    when 'hr' then 'hr'
    when 'commissions' then 'hr'
    when 'monitor' then 'monitor'
    when 'tickets' then 'portal'
    else null                       -- audit, settings, billing
  end
$$;

-- ¿Incluye la licencia del tenant este módulo?  ('ai' depende del nivel Pro + IA)
create or replace function public.module_enabled(p_tenant uuid, p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_module is null or coalesce((
    select l.status <> 'canceled'
       and case when p_module = 'ai' then l.ai_enabled
                else p_module = any (p.modules) end
    from public.tenant_licenses l
    join public.license_packages p on p.code = l.package_code
    where l.tenant_id = p_tenant
  ), false)
$$;

-- Licencia efectiva del tenant para la UI (candados, "Mejorar plan", seguimiento)
create or replace function public.my_license(p_tenant uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'package', l.package_code, 'package_name', p.name, 'tier', p.tier,
      'ai', l.ai_enabled, 'status', l.status, 'follow_up_since', l.follow_up_since,
      'modules', p.modules || case when l.ai_enabled then array['ai'] else array[]::text[] end)
    from public.tenant_licenses l join public.license_packages p on p.code = l.package_code
    where l.tenant_id = p_tenant and l.status <> 'canceled'
      and p_tenant in (select tenant_id from public.memberships where user_id = auth.uid() and is_active)
  ), jsonb_build_object('package', null, 'modules', '[]'::jsonb, 'status', 'none', 'ai', false))
$$;

-- EL CANDADO: tenants_with exige permiso del rol Y módulo licenciado
create or replace function public.tenants_with(perm text)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.is_active
    and public.module_enabled(m.tenant_id, public.perm_module(perm))
    and (
      exists (select 1 from public.member_permissions mp
              where mp.membership_id = m.id and mp.permission_code = perm and mp.granted)
      or (
        exists (select 1 from public.role_permissions rp
                where rp.role = m.role and rp.permission_code = perm)
        and not exists (select 1 from public.member_permissions mp
                        where mp.membership_id = m.id and mp.permission_code = perm and not mp.granted)
      )
    )
$$;

-- Portal del cliente: sin módulo 'portal' no hay tickets (defensa en profundidad)
create policy support_tickets_license on public.support_tickets as restrictive for all to authenticated
  using (public.module_enabled(tenant_id, 'portal')) with check (public.module_enabled(tenant_id, 'portal'));
create policy ticket_messages_license on public.ticket_messages as restrictive for all to authenticated
  using (public.module_enabled(tenant_id, 'portal')) with check (public.module_enabled(tenant_id, 'portal'));

-- Alta / cambio de paquete: sólo service_role (backoffice de Vincular)
create or replace function public.set_license(p_tenant uuid, p_package text, p_ai boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.tenant_licenses (tenant_id, package_code, ai_enabled)
  values (p_tenant, p_package, p_ai)
  on conflict (tenant_id) do update
    set package_code = excluded.package_code, ai_enabled = excluded.ai_enabled, status = 'active',
        follow_up_since = null, follow_up_note = null;
end $$;
revoke execute on function public.set_license(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.set_license(uuid, text, boolean) to service_role;

-- Mantenimiento impago: NO bloquea; marca seguimiento y avisa al equipo
create or replace function public.flag_license_follow_up(p_tenant uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm(p_tenant, 'billing.manage');
  update public.tenant_licenses
     set status = 'follow_up', follow_up_since = coalesce(follow_up_since, current_date),
         follow_up_note = p_note
   where tenant_id = p_tenant and status <> 'canceled';
  if not found then raise exception 'Licencia inexistente o cancelada' using errcode = 'P0002'; end if;
  insert into public.notifications (tenant_id, kind, title, body, link, dedupe_key)
  values (p_tenant, 'license_follow_up', 'Mantenimiento en seguimiento',
          'Hablar con el cliente para mantener el sistema activo. ' || coalesce(p_note, ''),
          '/crm', 'license_follow_up:' || current_date)
  on conflict (tenant_id, dedupe_key) do nothing;
end $$;

create or replace function public.clear_license_follow_up(p_tenant uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_perm(p_tenant, 'billing.manage');
  update public.tenant_licenses
     set status = 'active', follow_up_since = null, follow_up_note = null
   where tenant_id = p_tenant and status = 'follow_up';
end $$;
revoke execute on function public.flag_license_follow_up(uuid, text), public.clear_license_follow_up(uuid) from public, anon;
grant execute on function public.flag_license_follow_up(uuid, text), public.clear_license_follow_up(uuid) to authenticated;
