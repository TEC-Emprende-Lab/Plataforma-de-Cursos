from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = (
    REPO_ROOT
    / "supabase"
    / "migrations"
    / "20260812000000_secure_svg_templates.sql"
)


def test_template_migration_removes_direct_browser_writes():
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "revoke insert, update, delete on public.svg_templates from anon, authenticated" in sql
    assert 'drop policy if exists "autenticados suben svg"' in sql
    assert 'drop policy if exists "autenticados eliminan svg"' in sql
    assert "array['image/svg+xml']" in sql
    assert "for insert\n  to authenticated" not in sql


def test_frontend_uses_trusted_backend_instead_of_direct_storage_writes():
    hook = (REPO_ROOT / "src" / "hooks" / "useTemplates.js").read_text(
        encoding="utf-8"
    )

    assert "/api/templates/upload" in hook
    assert "/api/templates/delete" in hook
    assert ".upload(" not in hook
    assert ".remove(" not in hook
