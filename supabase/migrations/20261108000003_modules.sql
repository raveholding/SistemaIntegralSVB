-- =============================================================================
-- Sistema Integral SVB · 0003 · Tablas de los 7 módulos
-- =============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. MONITOR DE SALUD E INFRAESTRUCTURA
-- ═════════════════════════════════════════════════════════════════════════════
create type public.resource_kind  as enum ('server', 'database', 'supabase_project', 'api', 'website', 'worker');
create type public.health_status  as enum ('operational', 'degraded', 'down', 'maintenance', 'unknown');
create type public.alert_severity as enum ('info', 'warning', 'critical');
create type public.alert_status   as enum ('open', 'acknowledged', 'resolved');

create table public.monitored_resources (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  client_id             uuid references public.clients (id) on delete set null,
  name                  text not null,
  public_name           text,                    -- nombre "amigable" para el portal
  kind                  public.resource_kind not null,
  endpoint              text,                    -- URL / host (interno, nunca al portal)
  region                text,
  agent_token_hash      bytea,                   -- sha256 del token del agente
  heartbeat_interval_s  int not null default 60 check (heartbeat_interval_s between 10 and 3600),
  missed_beats_down     int not null default 3,  -- latidos perdidos para marcar DOWN
  status                public.health_status not null default 'unknown',
  status_changed_at     timestamptz not null default now(),
  last_heartbeat_at     timestamptz,
  is_active             boolean not null default true,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
create index monitored_resources_tenant_idx on public.monitored_resources (tenant_id, status);
create index monitored_resources_client_idx on public.monitored_resources (client_id);

-- Series temporales particionadas por mes (retención barata: DROP PARTITION)
create table public.metric_samples (
  resource_id     uuid not null references public.monitored_resources (id) on delete cascade,
  tenant_id       uuid not null,
  ts              timestamptz not null default now(),
  cpu_pct         real check (cpu_pct between 0 and 100),
  mem_pct         real check (mem_pct between 0 and 100),
  disk_pct        real check (disk_pct between 0 and 100),
  latency_ms      real check (latency_ms >= 0),
  db_connections  int,
  extra           jsonb,
  primary key (resource_id, ts)
) partition by range (ts);
create index metric_samples_tenant_ts_idx on public.metric_samples (tenant_id, ts desc);
create table public.metric_samples_default partition of public.metric_samples default;

create or replace function public.ensure_metric_partition(p_month date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_name  text := format('metric_samples_%s', to_char(v_start, 'YYYY_MM'));
begin
  execute format(
    'create table if not exists public.%I partition of public.metric_samples for values from (%L) to (%L)',
    v_name, v_start, v_end);
end $$;
select public.ensure_metric_partition(current_date);
select public.ensure_metric_partition((current_date + interval '1 month')::date);

create table public.notification_channels (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  kind        text not null check (kind in ('telegram', 'email', 'webhook')),
  name        text not null,
  -- telegram: {"chat_id": "-100..."}  ·  el bot token vive en Supabase Vault
  config      jsonb not null default '{}'::jsonb,
  secret_ref  text,                         -- nombre del secreto en vault.secrets
  min_severity public.alert_severity not null default 'warning',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.alert_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  resource_id uuid references public.monitored_resources (id) on delete cascade, -- null = todas
  metric      text not null check (metric in ('cpu_pct','mem_pct','disk_pct','latency_ms','db_connections','heartbeat')),
  operator    text not null default '>' check (operator in ('>','>=','<','<=')),
  threshold   real not null,
  for_samples int not null default 3,       -- muestras consecutivas que deben violar
  severity    public.alert_severity not null default 'warning',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.alerts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  resource_id      uuid references public.monitored_resources (id) on delete cascade,
  rule_id          uuid references public.alert_rules (id) on delete set null,
  severity         public.alert_severity not null,
  status           public.alert_status not null default 'open',
  title            text not null,
  message          text,
  value            real,
  fingerprint      text not null,           -- dedupe: resource+rule
  opened_at        timestamptz not null default now(),
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references auth.users (id),
  resolved_at      timestamptz,
  notified_at      timestamptz,
  telegram_msg_id  bigint
);
-- Sólo una alerta abierta por huella
create unique index alerts_open_fingerprint_uq on public.alerts (tenant_id, fingerprint)
  where status <> 'resolved';
create index alerts_tenant_time_idx on public.alerts (tenant_id, opened_at desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. GESTOR DOCUMENTAL Y DE CONTRATOS
-- ═════════════════════════════════════════════════════════════════════════════
create type public.contract_status as enum ('draft', 'pending_signature', 'signed', 'expired', 'terminated');

create table public.contracts (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  client_id            uuid not null references public.clients (id) on delete restrict,
  subscription_id      uuid,                 -- FK agregada luego de crear subscriptions
  code                 text not null,        -- ej. CTR-2026-0012
  title                text not null,
  status               public.contract_status not null default 'draft',
  start_date           date,
  end_date             date,
  auto_renew           boolean not null default false,
  notice_days          int[] not null default '{30,15,7}',  -- avisos previos al vencimiento
  value_amount         numeric(14,2),
  currency             char(3) not null default 'ARS',
  current_version_id   uuid,
  signed_at            timestamptz,
  signed_by_name       text,
  created_by           uuid references auth.users (id) default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, code),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (status <> 'signed' or (signed_at is not null and current_version_id is not null))
);
create index contracts_expiry_idx on public.contracts (tenant_id, end_date) where status = 'signed';
create index contracts_client_idx on public.contracts (client_id);

-- Versiones inmutables del PDF en Storage (bucket privado "contracts")
create table public.contract_versions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  contract_id   uuid not null references public.contracts (id) on delete cascade,
  version_no    int not null,
  storage_path  text not null,               -- {tenant}/{client}/{contract}/v{n}.pdf
  file_sha256   text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_size     bigint not null check (file_size > 0 and file_size <= 26214400), -- 25 MB
  mime_type     text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  change_note   text,
  uploaded_by   uuid references auth.users (id) default auth.uid(),
  uploaded_at   timestamptz not null default now(),
  unique (contract_id, version_no),
  unique (storage_path)
);
alter table public.contracts
  add constraint contracts_current_version_fk
  foreign key (current_version_id) references public.contract_versions (id) deferrable initially deferred;

create trigger contracts_touch before update on public.contracts
  for each row execute function public.tg_touch_updated_at();

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. CRM Y SUSCRIPCIONES MULTI-NIVEL
-- ═════════════════════════════════════════════════════════════════════════════
create table public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  client_id   uuid not null references public.clients (id) on delete cascade,
  full_name   text not null,
  position    text,
  email       citext,
  phone       text,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index client_contacts_primary_uq on public.client_contacts (client_id) where is_primary;

create type public.interaction_kind as enum ('call', 'email', 'meeting', 'whatsapp', 'note', 'demo', 'ticket');

create table public.interactions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  client_id    uuid not null references public.clients (id) on delete cascade,
  user_id      uuid references auth.users (id) default auth.uid(),
  kind         public.interaction_kind not null,
  subject      text not null,
  body         text,
  next_step    text,
  next_step_at timestamptz,
  occurred_at  timestamptz not null default now()
);
create index interactions_client_time_idx on public.interactions (client_id, occurred_at desc);

create table public.plans (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  code           text not null,
  name           text not null,
  tier           int not null,                 -- orden para upgrade/downgrade
  price_monthly  numeric(14,2) not null check (price_monthly >= 0),
  currency       char(3) not null default 'ARS',
  includes_ai    boolean not null default false,
  features       jsonb not null default '[]'::jsonb,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, tier)
);

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'canceled');

create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  client_id             uuid not null references public.clients (id) on delete restrict,
  plan_id               uuid not null references public.plans (id),
  status                public.subscription_status not null default 'active',
  price_override        numeric(14,2),           -- precio pactado distinto al de lista
  billing_day           int not null default 1 check (billing_day between 1 and 28),
  started_at            date not null default current_date,
  current_period_start  date not null default date_trunc('month', current_date)::date,
  current_period_end    date not null default (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  canceled_at           timestamptz,
  created_at            timestamptz not null default now()
);
create index subscriptions_client_idx on public.subscriptions (client_id, status);

alter table public.contracts
  add constraint contracts_subscription_fk foreign key (subscription_id) references public.subscriptions (id);

create table public.subscription_changes (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  subscription_id  uuid not null references public.subscriptions (id) on delete cascade,
  from_plan_id     uuid references public.plans (id),
  to_plan_id       uuid not null references public.plans (id),
  kind             text not null check (kind in ('upgrade', 'downgrade', 'create', 'cancel')),
  prorated_amount  numeric(14,2) not null default 0,
  effective_at     date not null,
  requested_by     uuid references auth.users (id) default auth.uid(),
  created_at       timestamptz not null default now()
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. PUNTO DE VENTA, CAJA Y AUDITORÍA
-- ═════════════════════════════════════════════════════════════════════════════
create type public.payment_method as enum ('cash', 'debit', 'credit', 'transfer', 'mercadopago', 'check', 'other');
create type public.cash_session_status as enum ('open', 'closed');
create type public.sales_doc_type as enum (
  'invoice_a', 'invoice_b', 'invoice_c', 'ticket', 'deposit_receipt', 'receipt', 'credit_note'
);
create type public.sales_doc_status as enum ('issued', 'voided');
create type public.cash_movement_kind as enum ('sale', 'deposit', 'refund', 'income', 'expense', 'withdrawal', 'reversal');

create table public.cash_registers (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null,
  location    text,
  point_of_sale int not null default 1,      -- punto de venta ARCA
  is_active   boolean not null default true,
  unique (tenant_id, name)
);

create table public.cash_sessions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null,
  register_id      uuid not null references public.cash_registers (id),
  status           public.cash_session_status not null default 'open',
  opened_by        uuid not null references auth.users (id),
  opened_at        timestamptz not null default clock_timestamp(),
  opening_amount   numeric(14,2) not null check (opening_amount >= 0),
  closed_by        uuid references auth.users (id),
  closed_at        timestamptz,
  expected_cash    numeric(14,2),            -- calculado al cierre
  counted_cash     numeric(14,2),            -- arqueo físico declarado
  difference       numeric(14,2) generated always as (counted_cash - expected_cash) stored,
  totals_by_method jsonb,                    -- snapshot al cierre
  notes            text,
  check ((status = 'closed') = (closed_at is not null))
);
-- Una sola caja abierta por registradora
create unique index cash_sessions_one_open_uq on public.cash_sessions (register_id) where status = 'open';

create table public.document_sequences (
  tenant_id      uuid not null,
  doc_type       public.sales_doc_type not null,
  point_of_sale  int not null,
  last_number    bigint not null default 0,
  primary key (tenant_id, doc_type, point_of_sale)
);

create table public.sales_documents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  session_id          uuid references public.cash_sessions (id),
  client_id           uuid references public.clients (id),
  subscription_id     uuid references public.subscriptions (id),
  seller_id           uuid references auth.users (id),        -- para comisiones
  doc_type            public.sales_doc_type not null,
  point_of_sale       int not null,
  number              bigint not null,
  issued_at           timestamptz not null default clock_timestamp(),
  customer_name       text,
  customer_tax_id     text,
  subtotal            numeric(14,2) not null default 0,
  tax_total           numeric(14,2) not null default 0,
  total               numeric(14,2) not null check (total >= 0),
  currency            char(3) not null default 'ARS',
  status              public.sales_doc_status not null default 'issued',
  related_document_id uuid references public.sales_documents (id),  -- seña aplicada / NC
  cae                 text,                   -- autorización ARCA (sv.arca.sdk)
  cae_due_date        date,
  issued_by           uuid not null references auth.users (id),
  voided_by           uuid references auth.users (id),
  voided_at           timestamptz,
  void_reason         text,
  unique (tenant_id, doc_type, point_of_sale, number)
);
create index sales_documents_client_idx on public.sales_documents (client_id, issued_at desc);
create index sales_documents_seller_idx on public.sales_documents (tenant_id, seller_id, issued_at);

create table public.sales_document_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  document_id  uuid not null references public.sales_documents (id) on delete restrict,
  description  text not null,
  quantity     numeric(12,3) not null check (quantity > 0),
  unit_price   numeric(14,2) not null check (unit_price >= 0),
  tax_rate     numeric(5,2) not null default 21.00,
  line_total   numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored
);

-- Movimientos de caja: libro mayor inmutable (correcciones = asiento 'reversal')
create table public.cash_movements (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  session_id          uuid not null references public.cash_sessions (id),
  kind                public.cash_movement_kind not null,
  document_id         uuid references public.sales_documents (id),
  method              public.payment_method not null,
  amount              numeric(14,2) not null check (amount <> 0),  -- con signo: + entra, - sale
  reference           text,                   -- nro operación, últimos 4, etc.
  reverses_id         uuid references public.cash_movements (id),
  created_by          uuid not null references auth.users (id),
  created_at          timestamptz not null default clock_timestamp()
);
create index cash_movements_session_idx on public.cash_movements (session_id, created_at);
create unique index cash_movements_reversed_once_uq on public.cash_movements (reverses_id) where reverses_id is not null;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. RECURSOS HUMANOS Y RENDIMIENTO
-- ═════════════════════════════════════════════════════════════════════════════
create type public.staff_type as enum ('partner', 'employee', 'seller', 'technician');

create table public.commission_schemes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete cascade,
  name        text not null,
  base_rate   numeric(5,2) not null default 0,  -- % si no alcanza ningún tramo
  -- tramos por % de cumplimiento de meta: [{"from_pct":0,"rate":5},{"from_pct":100,"rate":8},{"from_pct":120,"rate":10}]
  tiers       jsonb not null default '[]'::jsonb,
  applies_to  text not null default 'all' check (applies_to in ('all', 'new_sales', 'recurring')),
  is_active   boolean not null default true
);

create table public.employees (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  user_id               uuid references auth.users (id),
  full_name             text not null,
  email                 citext,
  position              text,
  staff_type            public.staff_type not null,
  hire_date             date,
  base_salary           numeric(14,2),
  commission_scheme_id  uuid references public.commission_schemes (id),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.sales_goals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  employee_id   uuid not null references public.employees (id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  unique (employee_id, period_start),
  check (period_end >= period_start)
);

create type public.commission_status as enum ('pending', 'approved', 'paid', 'canceled');

create table public.commission_entries (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null,
  employee_id    uuid not null references public.employees (id),
  period_start   date not null,
  period_end     date not null,
  sales_amount   numeric(14,2) not null,
  goal_amount    numeric(14,2),
  achievement_pct numeric(7,2),
  rate           numeric(5,2) not null,
  amount         numeric(14,2) not null,
  status         public.commission_status not null default 'pending',
  approved_by    uuid references auth.users (id),
  approved_at    timestamptz,
  paid_at        timestamptz,
  calculated_at  timestamptz not null default now(),
  unique (employee_id, period_start, period_end)
);

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. GESTOR WEB Y CMS
-- ═════════════════════════════════════════════════════════════════════════════
create table public.sites (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete cascade,
  name             text not null,
  domain           text,
  deploy_provider  text not null default 'vercel' check (deploy_provider in ('vercel', 'netlify', 'github_pages', 'custom')),
  deploy_hook_ref  text,                    -- nombre del secreto en Vault
  created_at       timestamptz not null default now()
);

create type public.page_status as enum ('draft', 'scheduled', 'published', 'archived');

create table public.pages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  site_id       uuid not null references public.sites (id) on delete cascade,
  slug          text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(/[a-z0-9]+(?:-[a-z0-9]+)*)*$|^$'),
  title         text not null,
  kind          text not null default 'page' check (kind in ('page', 'landing', 'post')),
  status        public.page_status not null default 'draft',
  seo           jsonb not null default '{}'::jsonb,   -- {title, description, og_image}
  blocks        jsonb not null default '[]'::jsonb,   -- [{type:"hero", props:{...}}, ...]
  version_no    int not null default 1,
  publish_at    timestamptz,
  published_at  timestamptz,
  updated_by    uuid references auth.users (id) default auth.uid(),
  updated_at    timestamptz not null default now(),
  unique (site_id, slug)
);

create table public.page_versions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  page_id     uuid not null references public.pages (id) on delete cascade,
  version_no  int not null,
  title       text not null,
  blocks      jsonb not null,
  seo         jsonb not null,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  unique (page_id, version_no)
);

create table public.deployments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  site_id      uuid not null references public.sites (id) on delete cascade,
  status       text not null default 'queued' check (status in ('queued', 'building', 'ready', 'error', 'canceled')),
  commit_ref   text,
  url          text,
  duration_ms  int,
  log_excerpt  text,
  triggered_by uuid references auth.users (id) default auth.uid(),
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index deployments_site_idx on public.deployments (site_id, created_at desc);

create table public.page_metrics_daily (
  page_id          uuid not null references public.pages (id) on delete cascade,
  tenant_id        uuid not null,
  day              date not null,
  views            int not null default 0,
  unique_visitors  int not null default 0,
  leads            int not null default 0,
  avg_load_ms      int,
  primary key (page_id, day)
);

create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'discarded');

create table public.leads (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants (id) on delete cascade,
  page_id              uuid references public.pages (id) on delete set null,
  full_name            text not null,
  email                citext,
  phone                text,
  company              text,
  message              text,
  utm                  jsonb not null default '{}'::jsonb,
  status               public.lead_status not null default 'new',
  assigned_to          uuid references auth.users (id),
  converted_client_id  uuid references public.clients (id),
  created_at           timestamptz not null default now()
);
create index leads_tenant_status_idx on public.leads (tenant_id, status, created_at desc);

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. PORTAL DE AUTOGESTIÓN · TICKETS DE SOPORTE
-- ═════════════════════════════════════════════════════════════════════════════
create type public.ticket_status   as enum ('open', 'in_progress', 'waiting_client', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  number       bigint not null,
  subject      text not null check (length(subject) between 3 and 200),
  description  text not null,
  category     text not null default 'general',
  priority     public.ticket_priority not null default 'normal',
  status       public.ticket_status not null default 'open',
  resource_id  uuid references public.monitored_resources (id) on delete set null,
  opened_by    uuid not null references auth.users (id) default auth.uid(),
  assigned_to  uuid references auth.users (id),
  sla_due_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (tenant_id, number)
);
create index support_tickets_client_idx on public.support_tickets (client_id, status);

create table public.ticket_messages (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  ticket_id    uuid not null references public.support_tickets (id) on delete cascade,
  author_id    uuid not null references auth.users (id) default auth.uid(),
  body         text not null,
  is_internal  boolean not null default false,   -- nota interna: invisible al cliente
  attachments  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.tg_touch_updated_at();
create trigger pages_touch before update on public.pages
  for each row execute function public.tg_touch_updated_at();
