from services import csv as csv_service


def test_normalize_header_removes_accents_case_and_outer_spaces():
    assert csv_service._normalize_header("  Fecha de Emisión ") == "fecha de emision"


def test_best_column_match_prefers_normalized_exact_match():
    headers = ["Correo", "Nombre del Participante", "Fecha de Emisión"]

    assert csv_service._best_column_match(
        headers, csv_service._FIELD_SYNONYMS["__name__"]
    ) == "Nombre del Participante"
    assert csv_service._best_column_match(headers, ["inexistente"]) is None


def test_best_column_match_accepts_a_close_known_variant():
    assert csv_service._best_column_match(
        ["Nombre participante"], csv_service._FIELD_SYNONYMS["__name__"]
    ) == "Nombre participante"


def test_resolve_fields_maps_known_columns_and_preserves_extra_data():
    row = {
        " Nombre completo ": " Ana Solís ",
        "Fecha de emisión": " 2026-08-12 ",
        "Duración": " 8 horas ",
        "Departamento": " QA ",
    }

    fields = csv_service._resolve_fields(row, "recipient_name", "issue_date")

    assert fields["recipient_name"] == "Ana Solís"
    assert fields["issue_date"] == "2026-08-12"
    assert fields["hours_issue"] == "8 horas"
    assert fields["Departamento"] == "QA"
