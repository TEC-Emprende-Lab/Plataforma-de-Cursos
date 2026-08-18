-- ============================================================
-- F3.3 — Operaciones transaccionales de participantes
--
-- Garantiza que participantes y sus relaciones
-- participant_courses / participant_tags se modifiquen
-- de forma atómica.
-- ============================================================


-- ============================================================
-- CREATE PARTICIPANT + RELATIONS
-- ============================================================

create or replace function public.create_participant_with_relations(
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
returns uuid
language plpgsql
as $$
declare
    v_participant_id uuid;
begin

    -- Crear participante
    insert into public.participants (
        name,
        cedula,
        email,
        phone,
        status,
        payment,
        access,
        fecha,
        notes
    )
    values (
        p_name,
        p_cedula,
        p_email,
        p_phone,
        p_status,
        p_payment,
        p_access,
        p_fecha,
        p_notes
    )
    returning id into v_participant_id;


    -- Crear relaciones con cursos
    if p_course_ids is not null and cardinality(p_course_ids) > 0 then
        insert into public.participant_courses (
            participant_id,
            course_id
        )
        select
            v_participant_id,
            course_id
        from unnest(p_course_ids) as course_id;
    end if;


    -- Crear relaciones con tags
    if p_tag_ids is not null and cardinality(p_tag_ids) > 0 then
        insert into public.participant_tags (
            participant_id,
            tag_id
        )
        select
            v_participant_id,
            tag_id
        from unnest(p_tag_ids) as tag_id;
    end if;


    return v_participant_id;

end;
$$;


-- ============================================================
-- UPDATE PARTICIPANT + RELATIONS
-- ============================================================

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
as $$
begin

    -- Actualizar participante
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


    -- Reemplazar cursos
    delete from public.participant_courses
    where participant_id = p_participant_id;

    if p_course_ids is not null and cardinality(p_course_ids) > 0 then
        insert into public.participant_courses (
            participant_id,
            course_id
        )
        select
            p_participant_id,
            course_id
        from unnest(p_course_ids) as course_id;
    end if;


    -- Reemplazar tags
    delete from public.participant_tags
    where participant_id = p_participant_id;

    if p_tag_ids is not null and cardinality(p_tag_ids) > 0 then
        insert into public.participant_tags (
            participant_id,
            tag_id
        )
        select
            p_participant_id,
            tag_id
        from unnest(p_tag_ids) as tag_id;
    end if;

end;
$$;