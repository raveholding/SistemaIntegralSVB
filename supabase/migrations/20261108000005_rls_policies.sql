-- =============================================================================
-- Sistema Integral SVB · 0005 · Row Level Security, grants y Storage
-- =============================================================================
-- Patrón:  tenant_id in (select public.tenants_with('<perm>'))
--          -> se evalúa como InitPlan una vez por consulta (rápido con índices).
-- Portal:  client_id in (select public.my_client_ids())
-- Tablas-libro (caja, comprobantes, versiones) NO tienen política de escritura:
-- sólo se escriben vía funciones SECURITY DEFINER auditadas.
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'tenants','profiles','clients','memberships','permissions','role_permissions','member_permissions',
    'notifications','monitored_resources','metric_samples','notification_channels','alert_rules','alerts',
    'contracts','contract_versions','client_contacts','interactions','plans','subscriptions',
    'subscription_changes','cash_registers','cash_sessions','document_sequences','sales_documents',
    'sales_document_items','cash_movements','commission_schemes','employees','sales_goals',
    'commission_entries','sites','pages','page_versions','deployments','page_metrics_daily','leads',
    'support_tickets','ticket_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── Identidad ────────────────────────────────────────────────────────────────
create policy tenants_select on public.tenants for select to authenticated
  using (id in (select tenant_id from public.memberships where user_id = auth.uid() and is_active));
create policy tenants_update on public.tenants for update to authenticated
  using (id in (select public.tenants_with('settings.manage')));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or id in (
    select m.user_id from public.memberships m where m.tenant_id in (select public.staff_tenants())));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or tenant_id in (select public.tenants_with('settings.manage'))
         or tenant_id in (select public.tenants_with('hr.read')));
create policy memberships_write on public.memberships for all to authenticated
  using (tenant_id in (select public.tenants_with('settings.manage')))
  with check (tenant_id in (select public.tenants_with('settings.manage')) and role <> 'owner');

create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy member_permissions_all on public.member_permissions for all to authenticated
  using (membership_id in (select id from public.memberships
                           where tenant_id in (select public.tenants_with('settings.manage'))))
  with check (membership_id in (select id from public.memberships
                           where tenant_id in (select public.tenants_with('settings.manage'))));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() or (user_id is null and tenant_id in (select public.staff_tenants())));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid() or (user_id is null and tenant_id in (select public.staff_tenants())));

-- ── 1. Monitor ───────────────────────────────────────────────────────────────
create policy resources_select on public.monitored_resources for select to authenticated
  using (tenant_id in (select public.tenants_with('monitor.read')));
create policy resources_write on public.monitored_resources for all to authenticated
  using (tenant_id in (select public.tenants_with('monitor.manage')))
  with check (tenant_id in (select public.tenants_with('monitor.manage')));

create policy metrics_select on public.metric_samples for select to authenticated
  using (tenant_id in (select public.tenants_with('monitor.read')));

create policy channels_all on public.notification_channels for all to authenticated
  using (tenant_id in (select public.tenants_with('monitor.manage')))
  with check (tenant_id in (select public.tenants_with('monitor.manage')));

create policy rules_select on public.alert_rules for select to authenticated
  using (tenant_id in (select public.tenants_with('monitor.read')));
create policy rules_write on public.alert_rules for all to authenticated
  using (tenant_id in (select public.tenants_with('monitor.manage')))
  with check (tenant_id in (select public.tenants_with('monitor.manage')));

create policy alerts_select on public.alerts for select to authenticated
  using (tenant_id in (select public.tenants_with('monitor.read')));

-- ── 2. Contratos ─────────────────────────────────────────────────────────────
create policy contracts_staff_select on public.contracts for select to authenticated
  using (tenant_id in (select public.tenants_with('docs.read')));
create policy contracts_portal_select on public.contracts for select to authenticated
  using (client_id in (select public.my_client_ids()) and status in ('signed', 'expired'));
create policy contracts_insert on public.contracts for insert to authenticated
  with check (tenant_id in (select public.tenants_with('docs.write')) and status in ('draft', 'pending_signature'));
create policy contracts_update on public.contracts for update to authenticated
  using (tenant_id in (select public.tenants_with('docs.write')))
  with check (tenant_id in (select public.tenants_with('docs.write')));

create policy contract_versions_staff on public.contract_versions for select to authenticated
  using (tenant_id in (select public.tenants_with('docs.read')));
create policy contract_versions_portal on public.contract_versions for select to authenticated
  using (id in (select c.current_version_id from public.contracts c
                where c.client_id in (select public.my_client_ids()) and c.status in ('signed', 'expired')));

-- ── 3. CRM y suscripciones ───────────────────────────────────────────────────
create policy clients_staff_select on public.clients for select to authenticated
  using (tenant_id in (select public.tenants_with('crm.read')));
create policy clients_portal_select on public.clients for select to authenticated
  using (id in (select public.my_client_ids()));
create policy clients_insert on public.clients for insert to authenticated
  with check (tenant_id in (select public.tenants_with('crm.write')));
create policy clients_update on public.clients for update to authenticated
  using (tenant_id in (select public.tenants_with('crm.write')))
  with check (tenant_id in (select public.tenants_with('crm.write')));
create policy clients_delete on public.clients for delete to authenticated
  using (tenant_id in (select public.tenants_with('settings.manage')));

create policy contacts_select on public.client_contacts for select to authenticated
  using (tenant_id in (select public.tenants_with('crm.read')));
create policy contacts_write on public.client_contacts for all to authenticated
  using (tenant_id in (select public.tenants_with('crm.write')))
  with check (tenant_id in (select public.tenants_with('crm.write')));  -- evaluado tras tg_inherit_tenant

create policy interactions_select on public.interactions for select to authenticated
  using (tenant_id in (select public.tenants_with('crm.read')));
create policy interactions_insert on public.interactions for insert to authenticated
  with check (client_id in (select id from public.clients where tenant_id in (select public.tenants_with('crm.write'))));
create policy interactions_update on public.interactions for update to authenticated
  using (user_id = auth.uid() and tenant_id in (select public.tenants_with('crm.write')));

create policy plans_select on public.plans for select to authenticated
  using (tenant_id in (select tenant_id from public.memberships where user_id = auth.uid() and is_active));
create policy plans_write on public.plans for all to authenticated
  using (tenant_id in (select public.tenants_with('billing.manage')))
  with check (tenant_id in (select public.tenants_with('billing.manage')));

create policy subs_staff_select on public.subscriptions for select to authenticated
  using (tenant_id in (select public.tenants_with('crm.read')));
create policy subs_portal_select on public.subscriptions for select to authenticated
  using (client_id in (select public.my_client_ids()));
create policy subs_insert on public.subscriptions for insert to authenticated
  with check (tenant_id in (select public.tenants_with('billing.manage')));
create policy subs_update on public.subscriptions for update to authenticated
  using (tenant_id in (select public.tenants_with('billing.manage')))
  with check (tenant_id in (select public.tenants_with('billing.manage')));

create policy sub_changes_select on public.subscription_changes for select to authenticated
  using (tenant_id in (select public.tenants_with('crm.read')));

-- ── 4. POS ───────────────────────────────────────────────────────────────────
create policy registers_select on public.cash_registers for select to authenticated
  using (tenant_id in (select public.tenants_with('pos.operate')));
create policy registers_write on public.cash_registers for all to authenticated
  using (tenant_id in (select public.tenants_with('settings.manage')))
  with check (tenant_id in (select public.tenants_with('settings.manage')));

create policy sessions_select on public.cash_sessions for select to authenticated
  using (tenant_id in (select public.tenants_with('pos.supervise'))
         or (opened_by = auth.uid() and tenant_id in (select public.tenants_with('pos.operate'))));

create policy movements_select on public.cash_movements for select to authenticated
  using (tenant_id in (select public.tenants_with('pos.supervise'))
         or (session_id in (select id from public.cash_sessions where opened_by = auth.uid())));

create policy docs_staff_select on public.sales_documents for select to authenticated
  using (tenant_id in (select public.tenants_with('pos.operate'))
         or tenant_id in (select public.tenants_with('crm.read')));
create policy docs_portal_select on public.sales_documents for select to authenticated
  using (client_id in (select public.my_client_ids()) and doc_type <> 'ticket');

create policy items_select on public.sales_document_items for select to authenticated
  using (document_id in (select id from public.sales_documents));  -- hereda RLS del padre

-- ── 5. RRHH ──────────────────────────────────────────────────────────────────
create policy schemes_select on public.commission_schemes for select to authenticated
  using (tenant_id in (select public.tenants_with('hr.read')));
create policy schemes_write on public.commission_schemes for all to authenticated
  using (tenant_id in (select public.tenants_with('hr.manage')))
  with check (tenant_id in (select public.tenants_with('hr.manage')));

create policy employees_select on public.employees for select to authenticated
  using (tenant_id in (select public.tenants_with('hr.read')) or user_id = auth.uid());
create policy employees_write on public.employees for all to authenticated
  using (tenant_id in (select public.tenants_with('hr.manage')))
  with check (tenant_id in (select public.tenants_with('hr.manage')));

create policy goals_select on public.sales_goals for select to authenticated
  using (tenant_id in (select public.tenants_with('hr.read'))
         or employee_id in (select id from public.employees where user_id = auth.uid()));
create policy goals_write on public.sales_goals for all to authenticated
  using (tenant_id in (select public.tenants_with('hr.manage')))
  with check (tenant_id in (select public.tenants_with('hr.manage')));

create policy commissions_select on public.commission_entries for select to authenticated
  using (tenant_id in (select public.tenants_with('hr.read'))
         or employee_id in (select id from public.employees where user_id = auth.uid()));
create policy commissions_approve on public.commission_entries for update to authenticated
  using (tenant_id in (select public.tenants_with('commissions.approve')))
  with check (tenant_id in (select public.tenants_with('commissions.approve')));

-- ── 6. CMS ───────────────────────────────────────────────────────────────────
create policy sites_select on public.sites for select to authenticated
  using (tenant_id in (select public.tenants_with('cms.read')));
create policy sites_write on public.sites for all to authenticated
  using (tenant_id in (select public.tenants_with('cms.publish')))
  with check (tenant_id in (select public.tenants_with('cms.publish')));

create policy pages_select on public.pages for select to authenticated
  using (tenant_id in (select public.tenants_with('cms.read')));
create policy pages_public_select on public.pages for select to anon
  using (status = 'published');
create policy pages_write on public.pages for all to authenticated
  using (tenant_id in (select public.tenants_with('cms.write')))
  with check (site_id in (select id from public.sites where tenant_id in (select public.tenants_with('cms.write')))
              and (status <> 'published' or tenant_id in (select public.tenants_with('cms.publish'))));

create policy page_versions_select on public.page_versions for select to authenticated
  using (tenant_id in (select public.tenants_with('cms.read')));
create policy deployments_select on public.deployments for select to authenticated
  using (tenant_id in (select public.tenants_with('cms.read')));
create policy deployments_insert on public.deployments for insert to authenticated
  with check (site_id in (select id from public.sites where tenant_id in (select public.tenants_with('cms.publish'))));
create policy page_metrics_select on public.page_metrics_daily for select to authenticated
  using (tenant_id in (select public.tenants_with('cms.read')));

create policy leads_select on public.leads for select to authenticated
  using (tenant_id in (select public.tenants_with('cms.read')) or tenant_id in (select public.tenants_with('crm.read')));
create policy leads_update on public.leads for update to authenticated
  using (tenant_id in (select public.tenants_with('crm.write')));

-- ── 7. Portal · tickets ──────────────────────────────────────────────────────
create policy tickets_staff_select on public.support_tickets for select to authenticated
  using (tenant_id in (select public.tenants_with('tickets.read')));
create policy tickets_portal_select on public.support_tickets for select to authenticated
  using (client_id in (select public.my_client_ids()));
create policy tickets_insert on public.support_tickets for insert to authenticated
  with check (
    (client_id in (select public.my_client_ids()) and opened_by = auth.uid() and assigned_to is null)
    or client_id in (select id from public.clients where tenant_id in (select public.tenants_with('tickets.manage'))));
create policy tickets_staff_update on public.support_tickets for update to authenticated
  using (tenant_id in (select public.tenants_with('tickets.manage')))
  with check (tenant_id in (select public.tenants_with('tickets.manage')));

create policy messages_staff_select on public.ticket_messages for select to authenticated
  using (tenant_id in (select public.tenants_with('tickets.read')));
create policy messages_portal_select on public.ticket_messages for select to authenticated
  using (not is_internal and ticket_id in (select id from public.support_tickets
                                           where client_id in (select public.my_client_ids())));
create policy messages_insert on public.ticket_messages for insert to authenticated
  with check (
    author_id = auth.uid() and (
      ticket_id in (select id from public.support_tickets where tenant_id in (select public.tenants_with('tickets.manage')))
      or (not is_internal and ticket_id in (select id from public.support_tickets
                                            where client_id in (select public.my_client_ids())
                                              and status not in ('closed')))));

-- =============================================================================
-- GRANTS de funciones
-- =============================================================================
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema audit  from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to anon, authenticated;
    -- Supabase concede EXECUTE a anon por default privileges: se revoca explícitamente
    revoke execute on all functions in schema public from anon;
    grant execute on all functions in schema public to authenticated;
    -- sólo el backend (service_role) ingiere telemetría y corre jobs
    revoke execute on function public.record_heartbeat(uuid, text, jsonb)        from authenticated;
    revoke execute on function public.detect_missed_heartbeats()                 from authenticated;
    revoke execute on function public.process_contract_expirations(date)         from authenticated;
    revoke execute on function public.ensure_metric_partition(date)              from authenticated;
    revoke execute on function public.next_document_number(uuid, public.sales_doc_type, int) from authenticated;
    grant execute on function public.record_heartbeat(uuid, text, jsonb), public.detect_missed_heartbeats(),
                              public.process_contract_expirations(date), public.ensure_metric_partition(date)
      to service_role;
    -- endpoints públicos de las landing pages
    grant execute on function public.submit_lead(uuid, text, text, text, text, text, jsonb),
                              public.track_page_view(uuid, boolean, int)
      to anon;
    -- las tablas-libro no se escriben directo
    revoke insert, update, delete on public.cash_movements, public.cash_sessions, public.sales_documents,
                                     public.sales_document_items, public.contract_versions, public.document_sequences,
                                     public.metric_samples, public.alerts, public.page_versions,
                                     public.subscription_changes, public.commission_entries
      from anon, authenticated;
    grant update (status, approved_by, approved_at, paid_at) on public.commission_entries to authenticated;
    grant update (status, acknowledged_at, acknowledged_by) on public.alerts to authenticated;
    revoke all on all tables in schema public from anon;
    grant select on public.pages to anon;
  end if;
end $$;

-- =============================================================================
-- STORAGE · bucket privado de contratos  ({tenant}/{client}/{contract}/vN.pdf)
-- =============================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('contracts', 'contracts', false, 26214400, array['application/pdf'])
    on conflict (id) do nothing;

    execute $p$
      create policy contracts_staff_read on storage.objects for select to authenticated
      using (bucket_id = 'contracts'
             and (storage.foldername(name))[1]::uuid in (select public.tenants_with('docs.read')))
    $p$;
    execute $p$
      create policy contracts_portal_read on storage.objects for select to authenticated
      using (bucket_id = 'contracts'
             and name in (select v.storage_path from public.contract_versions v
                          join public.contracts c on c.current_version_id = v.id
                          where c.client_id in (select public.my_client_ids())
                            and c.status in ('signed', 'expired')))
    $p$;
    execute $p$
      create policy contracts_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'contracts'
                  and (storage.foldername(name))[1]::uuid in (select public.tenants_with('docs.write'))
                  and lower(storage.extension(name)) = 'pdf')
    $p$;
    -- Sin UPDATE/DELETE: cada versión es un objeto nuevo e inmutable.
  end if;
end $$;

-- =============================================================================
-- REALTIME · el dashboard de salud escucha cambios en vivo
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.alerts, public.monitored_resources,
                                             public.notifications, public.ticket_messages;
  end if;
end $$;
