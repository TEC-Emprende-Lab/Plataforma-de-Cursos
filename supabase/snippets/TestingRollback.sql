------
-- Running this should return a foreing key constraint
------
with new_course as (
  insert into public.courses (name, type)
  values ('Curso F3.3', 'curso')
  returning id
),
new_tag as (
  insert into public.tags (name, color)
  values ('F3.3 Test', '#000000')
  returning id
),
new_participant as (
  select public.create_participant_with_relations(
    p_name       => 'Juan Pérez',
    p_cedula     => '1-2345-6789',
    p_email      => 'juan@example.com',
    p_phone      => '8888-8888',
    p_status     => 'activo',
    p_payment    => 'pendiente',
    p_access     => false,
    p_fecha      => current_date,
    p_notes      => 'Nota de prueba',
    p_course_ids => array(select id from new_course),
    p_tag_ids    => array(select id from new_tag)
  ) as id
)
select public.update_participant_with_relations(
  (select id from new_participant),
  'Participante prueba',
  null,
  null,
  null,
  'activo',
  'pendiente',
  false,
  current_date,
  'Prueba F3.3',
  ARRAY[(select id from new_course)]::uuid[],
  ARRAY['00000000-0000-0000-0000-000000000000']::uuid[] -- invalid tag -> provokes rollback
);