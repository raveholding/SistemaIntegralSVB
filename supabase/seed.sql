-- =============================================================================
-- Datos de demostración · Vincular Business
-- (ejecutar sólo en entornos de desarrollo: `supabase db reset` lo aplica solo)
-- =============================================================================
-- Usuarios demo (en Supabase real se crean desde Auth; acá se insertan directo)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'nico@vincular.business',   '{"full_name":"Nico (Socio)"}'),
  ('00000000-0000-0000-0000-000000000002', 'ventas@vincular.business', '{"full_name":"Lucía Vendedora"}'),
  ('00000000-0000-0000-0000-000000000003', 'soporte@vincular.business','{"full_name":"Martín Técnico"}'),
  ('00000000-0000-0000-0000-000000000010', 'it@barberiajuan.com.ar',   '{"full_name":"Juan (Barbería Juan)"}'),
  ('00000000-0000-0000-0000-000000000011', 'admin@clubcamping.com.ar', '{"full_name":"Admin Club Camping"}')
on conflict do nothing;

insert into public.tenants (id, name, slug, tax_id) values
  ('11111111-1111-1111-1111-111111111111', 'Vincular Business', 'vincular', '20-00000000-0')
on conflict do nothing;

insert into public.clients (id, tenant_id, legal_name, trade_name, tax_id, tax_condition, email, city, industry, status, owner_id) values
  ('c0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'Barbería Juan SRL', 'Barbería Juan', '30-11111111-1', 'RI', 'it@barberiajuan.com.ar', 'Salta', 'Servicios', 'active', '00000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'Club Camping Asoc. Civil', 'Club Camping', '30-22222222-2', 'Exento', 'admin@clubcamping.com.ar', 'Salta', 'Clubes', 'active', '00000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', 'Estudio Contable Norte', 'Estudio Norte', '30-33333333-3', 'RI', 'info@estudionorte.com.ar', 'Salta', 'Contable', 'lead', '00000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.memberships (tenant_id, user_id, role, client_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'owner', null),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'seller', null),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'technician', null),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000010', 'client_admin', 'c0000000-0000-0000-0000-00000000000a'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000011', 'client_admin', 'c0000000-0000-0000-0000-00000000000b')
on conflict do nothing;

insert into public.plans (id, tenant_id, code, name, tier, price_monthly, includes_ai, features) values
  ('b1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ESENCIAL', 'Abono Esencial', 1, 50000, false,
   '["Sistema de gestión a medida","Hosting y backups","Soporte en horario comercial","Monitoreo 24/7"]'),
  ('b1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'PRO_IA', 'Abono Pro + IA', 2, 80000, true,
   '["Todo lo del plan Esencial","Automatizaciones (WhatsApp, email, reportes)","Asistente con IA integrado","Soporte prioritario 4 h"]')
on conflict do nothing;

insert into public.subscriptions (id, tenant_id, client_id, plan_id, status) values
  ('5b000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', 'b1000000-0000-0000-0000-000000000001', 'active'),
  ('5b000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'b1000000-0000-0000-0000-000000000002', 'active')
on conflict do nothing;

insert into public.cash_registers (id, tenant_id, name, location, point_of_sale) values
  ('ca000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Caja Principal', 'Oficina Salta', 1)
on conflict do nothing;

insert into public.commission_schemes (id, tenant_id, name, base_rate, tiers) values
  ('cc000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Vendedores 2026', 3,
   '[{"from_pct":0,"rate":5},{"from_pct":100,"rate":8},{"from_pct":120,"rate":10}]')
on conflict do nothing;

insert into public.employees (id, tenant_id, user_id, full_name, email, position, staff_type, hire_date, commission_scheme_id) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Nico', 'nico@vincular.business', 'Socio fundador', 'partner', '2024-01-01', null),
  ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'Lucía Vendedora', 'ventas@vincular.business', 'Ejecutiva comercial', 'seller', '2025-03-01', 'cc000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'Martín Técnico', 'soporte@vincular.business', 'DevOps', 'technician', '2025-06-01', null)
on conflict do nothing;

insert into public.sales_goals (tenant_id, employee_id, period_start, period_end, target_amount)
select '11111111-1111-1111-1111-111111111111', 'e0000000-0000-0000-0000-000000000002',
       date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 500000
on conflict do nothing;

-- Recursos monitoreados (token del agente demo: "demo-agent-token")
insert into public.monitored_resources (id, tenant_id, client_id, name, public_name, kind, endpoint, region, agent_token_hash, heartbeat_interval_s) values
  ('aa000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', 'barberia-prod-db', 'Base de datos', 'supabase_project', 'db.xxxx.supabase.co', 'sa-east-1', sha256('demo-agent-token'::bytea), 60),
  ('aa000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', 'barberia-web', 'Sitio web y turnero', 'website', 'https://barberiajuan.com.ar', 'sa-east-1', sha256('demo-agent-token'::bytea), 60),
  ('aa000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'camping-api', 'Sistema de socios', 'api', 'https://api.clubcamping.com.ar', 'sa-east-1', sha256('demo-agent-token'::bytea), 60)
on conflict do nothing;

insert into public.alert_rules (tenant_id, metric, operator, threshold, for_samples, severity) values
  ('11111111-1111-1111-1111-111111111111', 'cpu_pct',    '>', 90,   3, 'critical'),
  ('11111111-1111-1111-1111-111111111111', 'mem_pct',    '>', 85,   3, 'warning'),
  ('11111111-1111-1111-1111-111111111111', 'latency_ms', '>', 1500, 3, 'warning'),
  ('11111111-1111-1111-1111-111111111111', 'disk_pct',   '>', 90,   1, 'critical');

insert into public.notification_channels (tenant_id, kind, name, config, secret_ref, min_severity) values
  ('11111111-1111-1111-1111-111111111111', 'telegram', 'Guardia DevOps', '{"chat_id":"-1000000000000"}', 'telegram_bot_token', 'warning');

insert into public.sites (id, tenant_id, name, domain, deploy_provider) values
  ('5e000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Sitio corporativo', 'vincular.business', 'vercel')
on conflict do nothing;

insert into public.pages (id, tenant_id, site_id, slug, title, kind, status, published_at, seo, blocks) values
  ('9a000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001', '', 'Inicio', 'page', 'published', now(),
   '{"title":"Vincular Business · Software a medida e IA"}',
   '[{"type":"hero","props":{"title":"Software a medida para tu comercio","cta":"Pedí una demo"}}]'),
  ('9a000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '5e000000-0000-0000-0000-000000000001', 'demo-gratis', 'Landing · Demo gratis', 'landing', 'published', now(),
   '{"title":"Probá tu sistema gratis"}',
   '[{"type":"hero","props":{"title":"Tu sistema en 7 días"}},{"type":"lead_form","props":{"fields":["name","email","phone","company"]}}]')
on conflict do nothing;

insert into public.contracts (id, tenant_id, client_id, subscription_id, code, title, status, start_date, end_date, value_amount) values
  ('c7000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', '5b000000-0000-0000-0000-00000000000a',
   'CTR-2026-0001', 'Contrato de servicio · Abono Esencial', 'draft', current_date - 30, current_date + 15, 600000)
on conflict do nothing;
