-- Endurece las RPC de participantes creadas en Fase 3 y añade una
-- operación atómica para la actualización posterior a importaciones.

alter function public.create_participant_with_relations(
    text, text, text, text, text, text, boolean, date, text, uuid[], uuid[]
) set search_path = '';

create or replace function public.update_participant_with_relations(
    p_participant_id uuid,
    p_name text,
    p_cedula text,
    p_email text,
    p_phone text,
    p_status text,
    p_payment text,
    p_access boolean,
    p_fecha date,
    p_notes text,
    p_course_ids uuid[],
    p_tag_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    update public.participants
    set
        name = p_name,
        cedula = p_cedula,
        email = p_email,
        phone = p_phone,
        status = p_status,
        payment = p_payment,
        access = p_access,
        fecha = p_fecha,
        notes = p_notes
    where id = p_participant_id;

    if not found then
        raise exception using
            errcode = 'P0002',
            message = 'PARTICIPANT_NOT_FOUND';
    end if;

    delete from public.participant_courses
    where participant_id = p_participant_id;

    if p_course_ids is not null and cardinality(p_course_ids) > 0 then
        insert into public.participant_courses (participant_id, course_id)
        select p_participant_id, course_id
        from unnest(p_course_ids) as course_id;
    end if;

    delete from public.participant_tags
    where participant_id = p_participant_id;

    if p_tag_ids is not null and cardinality(p_tag_ids) > 0 then
        insert into public.participant_tags (participant_id, tag_id)
        select p_participant_id, tag_id
        from unnest(p_tag_ids) as tag_id;
    end if;
end;
$$;

create or replace function public.bulk_update_participants_with_courses(
    p_participant_ids uuid[],
    p_payment text,
    p_access boolean,
    p_fecha date,
    p_course_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_expected_count integer;
    v_updated_count integer;
begin
    if p_participant_ids is null or cardinality(p_participant_ids) = 0 then
        return;
    end if;

    select count(*)
    into v_expected_count
    from (
        select distinct participant_id
        from unnest(p_participant_ids) as requested_id(participant_id)
    ) as requested;

    update public.participants
    set
        payment = coalesce(p_payment, payment),
        access = coalesce(p_access, access),
        fecha = coalesce(p_fecha, fecha)
    where id = any(p_participant_ids);

    get diagnostics v_updated_count = row_count;

    if v_updated_count <> v_expected_count then
        raise exception using
            errcode = 'P0002',
            message = 'PARTICIPANT_NOT_FOUND';
    end if;

    if p_course_ids is not null and cardinality(p_course_ids) > 0 then
        insert into public.participant_courses (participant_id, course_id)
        select distinct participant_id, course_id
        from unnest(p_participant_ids) as participants(participant_id)
        cross join unnest(p_course_ids) as courses(course_id)
        on conflict (participant_id, course_id) do nothing;
    end if;
end;
$$;

revoke execute on function public.create_participant_with_relations(
    text, text, text, text, text, text, boolean, date, text, uuid[], uuid[]
) from public, anon;

revoke execute on function public.update_participant_with_relations(
    uuid, text, text, text, text, text, text, boolean, date, text, uuid[], uuid[]
) from public, anon;

revoke execute on function public.bulk_update_participants_with_courses(
    uuid[], text, boolean, date, uuid[]
) from public, anon;

grant execute on function public.create_participant_with_relations(
    text, text, text, text, text, text, boolean, date, text, uuid[], uuid[]
) to authenticated;

grant execute on function public.update_participant_with_relations(
    uuid, text, text, text, text, text, text, boolean, date, text, uuid[], uuid[]
) to authenticated;

grant execute on function public.bulk_update_participants_with_courses(
    uuid[], text, boolean, date, uuid[]
) to authenticated;
