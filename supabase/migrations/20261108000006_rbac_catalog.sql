-- =============================================================================
-- Sistema Integral SVB · 0006 · Catálogo RBAC (permisos y matriz por rol)
-- =============================================================================
insert into public.permissions (code, module, description) values
  ('monitor.read',        'monitor',  'Ver telemetría, recursos y alertas'),
  ('monitor.manage',      'monitor',  'Alta de recursos, reglas, canales y ACK de alertas'),
  ('docs.read',           'docs',     'Ver contratos y versiones'),
  ('docs.write',          'docs',     'Crear contratos y subir versiones'),
  ('docs.sign',           'docs',     'Marcar contratos como firmados'),
  ('crm.read',            'crm',      'Ver clientes, interacciones y suscripciones'),
  ('crm.write',           'crm',      'Editar clientes, contactos e interacciones'),
  ('billing.manage',      'crm',      'Planes, altas y cambios de suscripción'),
  ('pos.operate',         'pos',      'Abrir/cerrar caja propia y emitir comprobantes'),
  ('pos.supervise',       'pos',      'Ver todas las cajas, egresos y retiros'),
  ('pos.void',            'pos',      'Anular tickets, recibos y señas'),
  ('hr.read',             'hr',       'Ver equipo, metas y comisiones'),
  ('hr.manage',           'hr',       'Editar equipo, metas, esquemas y calcular comisiones'),
  ('commissions.approve', 'hr',       'Aprobar y marcar pagadas las comisiones'),
  ('cms.read',            'cms',      'Ver sitios, páginas y métricas'),
  ('cms.write',           'cms',      'Editar páginas (borrador)'),
  ('cms.publish',         'cms',      'Publicar páginas y disparar despliegues'),
  ('tickets.read',        'portal',   'Ver tickets de soporte'),
  ('tickets.manage',      'portal',   'Responder, asignar y cerrar tickets'),
  ('audit.read',          'audit',    'Consultar la pista de auditoría'),
  ('settings.manage',     'settings', 'Usuarios, roles, cajas y configuración del tenant')
on conflict (code) do nothing;

-- Matriz rol -> permisos
with matrix(role, perms) as (values
  ('owner'::public.app_role,   array(select code from public.permissions)),
  ('partner',    array(select code from public.permissions)),
  ('admin',      array['monitor.read','docs.read','docs.write','docs.sign','crm.read','crm.write','billing.manage',
                       'pos.operate','pos.supervise','pos.void','hr.read','hr.manage','cms.read','cms.write',
                       'tickets.read','tickets.manage','audit.read']),
  ('employee',   array['crm.read','pos.operate','tickets.read','cms.read','docs.read']),
  ('seller',     array['crm.read','crm.write','docs.read','pos.operate','cms.read','tickets.read']),
  ('technician', array['monitor.read','monitor.manage','tickets.read','tickets.manage','cms.read','cms.write','crm.read']),
  ('client_admin', array[]::text[]),
  ('client_user',  array[]::text[])
)
insert into public.role_permissions (role, permission_code)
select m.role, unnest(m.perms) from matrix m
on conflict do nothing;
