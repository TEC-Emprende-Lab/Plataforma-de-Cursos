def test_normalize_header_removes_accents_case_and_outer_spaces(backend_module):
    assert backend_module._normalize_header("  Fecha de Emisión ") == "fecha de emision"


def test_best_column_match_prefers_normalized_exact_match(backend_module):
    headers = ["Correo", "Nombre del Participante", "Fecha de Emisión"]

    assert backend_module._best_column_match(
        headers, backend_module._FIELD_SYNONYMS["__name__"]
    ) == "Nombre del Participante"
    assert backend_module._best_column_match(headers, ["inexistente"]) is None


def test_best_column_match_accepts_a_close_known_variant(backend_module):
    assert backend_module._best_column_match(
        ["Nombre participante"], backend_module._FIELD_SYNONYMS["__name__"]
    ) == "Nombre participante"


def test_resolve_fields_maps_known_columns_and_preserves_extra_data(backend_module):
    row = {
        " Nombre completo ": " Ana Solís ",
        "Fecha de emisión": " 2026-08-12 ",
        "Duración": " 8 horas ",
        "Departamento": " QA ",
    }

    fields = backend_module._resolve_fields(row, "recipient_name", "issue_date")

    assert fields["recipient_name"] == "Ana Solís"
    assert fields["issue_date"] == "2026-08-12"
    assert fields["hours_issue"] == "8 horas"
    assert fields["Departamento"] == "QA"
