-- =============================================================================
-- Sistema Integral SVB · 0001 · Núcleo multi-tenant, identidad y RBAC
-- =============================================================================
-- Modelo de aislamiento de dos niveles:
--   tenant  -> la empresa de software que opera la plataforma (ej. Vincular Business)
--   client  -> cliente corporativo del tenant (ve sólo lo suyo en el Portal)
-- Todo registro de negocio lleva tenant_id; los registros visibles en el portal
-- llevan además client_id. RLS se apoya en las funciones helper definidas acá.
-- =============================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'owner',          -- dueño de la cuenta
  'partner',        -- socio
  'admin',          -- administración
  'employee',       -- empleado general
  'seller',         -- vendedor
  'technician',     -- técnico / soporte / devops
  'client_admin',   -- usuario administrador del cliente corporativo (portal)
  'client_user'     -- usuario de lectura del cliente corporativo (portal)
);

-- ---------------------------------------------------------------------------
-- Tenants y perfiles
-- ---------------------------------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        citext not null unique,
  tax_id      text,                         -- CUIT
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       citext,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Clientes corporativos (CRM). Se define acá porque memberships lo referencia.
create type public.client_status as enum ('lead', 'active', 'paused', 'churned');

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete cascade,
  legal_name    text not null,
  trade_name    text,
  tax_id        text,                       -- CUIT
  tax_condition text,                       -- RI / Monotributo / Exento / CF
  email         citext,
  phone         text,
  address       text,
  city          text,
  industry      text,
  status        public.client_status not null default 'lead',
  owner_id      uuid references auth.users (id),   -- vendedor asignado
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, tax_id)
);
create index clients_tenant_status_idx on public.clients (tenant_id, status);
create index clients_owner_idx on public.clients (owner_id);

-- ---------------------------------------------------------------------------
-- Membresías: un usuario pertenece a N tenants con un rol.
-- Los roles client_* exigen client_id (scope del portal).
-- ---------------------------------------------------------------------------
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.app_role not null,
  client_id   uuid references public.clients (id) on delete cascade,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id),
  constraint memberships_client_scope_chk check (
    (role in ('client_admin', 'client_user')) = (client_id is not null)
  )
);
create index memberships_user_idx on public.memberships (user_id) where is_active;

-- ---------------------------------------------------------------------------
-- RBAC granular: permisos por rol + overrides por miembro
-- ---------------------------------------------------------------------------
create table public.permissions (
  code        text primary key,             -- ej. 'pos.operate'
  module      text not null,
  description text not null
);

create table public.role_permissions (
  role             public.app_role not null,
  permission_code  text not null references public.permissions (code) on delete cascade,
  primary key (role, permission_code)
);

create table public.member_permissions (
  membership_id    uuid not null references public.memberships (id) on delete cascade,
  permission_code  text not null references public.permissions (code) on delete cascade,
  granted          boolean not null,          -- true = concede extra, false = revoca
  primary key (membership_id, permission_code)
);

-- Notificaciones in-app (vencimientos, alertas, tickets)
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,  -- null = todo el staff
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (tenant_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (tenant_id, user_id, read_at);

-- ---------------------------------------------------------------------------
-- Helpers de seguridad (SECURITY DEFINER para evitar recursión de RLS).
-- Diseñados para usarse como  tenant_id in (select public.tenants_with('x'))
-- de modo que Postgres los evalúe UNA vez por sentencia (InitPlan).
-- ---------------------------------------------------------------------------
create or replace function public.staff_roles()
returns public.app_role[] language sql immutable as $$
  select array['owner','partner','admin','employee','seller','technician']::public.app_role[]
$$;

-- Tenants donde el usuario actual posee el permiso indicado
create or replace function public.tenants_with(perm text)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.tenant_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.is_active
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

create or replace function public.has_perm(p_tenant uuid, perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_tenant in (select public.tenants_with(perm))
$$;

-- Tenants donde el usuario es staff interno
create or replace function public.staff_tenants()
returns setof uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.memberships
  where user_id = auth.uid() and is_active and role = any (public.staff_roles())
$$;

-- Clientes corporativos a los que el usuario pertenece (rol portal)
create or replace function public.my_client_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select client_id from public.memberships
  where user_id = auth.uid() and is_active and client_id is not null
$$;

create or replace function public.my_role(p_tenant uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.memberships
  where user_id = auth.uid() and tenant_id = p_tenant and is_active
$$;

-- Lanza excepción si falta el permiso (para funciones de negocio)
create or replace function public.require_perm(p_tenant uuid, perm text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm(p_tenant, perm) then
    raise exception 'Permiso denegado: % en tenant %', perm, p_tenant
      using errcode = '42501';
  end if;
end $$;

-- updated_at genérico
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.tg_touch_updated_at();
create trigger clients_touch before update on public.clients
  for each row execute function public.tg_touch_updated_at();

-- Alta automática de perfil al registrarse
create or replace function public.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.tg_handle_new_user();
