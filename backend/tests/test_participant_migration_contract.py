from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    REPO_ROOT
    / "supabase"
    / "migrations"
    / "20260819000000_harden_participant_transactions.sql"
)


def migration_sql():
    return " ".join(MIGRATION.read_text(encoding="utf-8").lower().split())


def test_participant_rpcs_keep_rls_and_restrict_execution():
    sql = migration_sql()

    assert sql.count("set search_path = ''") == 3
    assert "security definer" not in sql
    assert sql.count("from public, anon") == 3
    assert sql.count("to authenticated") == 3


def test_update_fails_before_replacing_relations_when_participant_is_missing():
    sql = migration_sql()

    update_start = sql.index("create or replace function public.update_participant_with_relations")
    not_found_check = sql.index("if not found then", update_start)
    delete_courses = sql.index("delete from public.participant_courses", update_start)

    assert "errcode = 'p0002'" in sql[not_found_check:delete_courses]
    assert "message = 'participant_not_found'" in sql[not_found_check:delete_courses]
    assert not_found_check < delete_courses


def test_bulk_update_uses_one_rpc_transaction_for_fields_and_courses():
    sql = migration_sql()

    bulk_start = sql.index(
        "create or replace function public.bulk_update_participants_with_courses"
    )
    update_participants = sql.index("update public.participants", bulk_start)
    insert_courses = sql.index("insert into public.participant_courses", bulk_start)

    assert update_participants < insert_courses
    assert "get diagnostics v_updated_count = row_count" in sql[bulk_start:insert_courses]
    assert "on conflict (participant_id, course_id) do nothing" in sql[insert_courses:]
