from pathlib import Path

import pytest
from sqlmodel import Session

from app.catalog import import_csv, match_ocr_lines, normalize, read_csv_rows, search

HEADER = '"Denumire comerciala";"DCI";"Forma farmaceutica";"Cod ATC";"Cod CIM";"Concentratie";"Ambalaj";"Firma detinatoare";"Nr. autorizare";"Link prospect";"Link RCP";"Link ambalaj"'


def _row(name, dci, conc, pack, leaflet, form="COMPR."):
    return f'"{name}";"{dci}";"{form}";"N02BE01";"W1";"{conc}";"{pack}";"FIRMA SRL - ROMANIA";"1/2020/01";"{leaflet}";"{leaflet}.rcp";"x"'


@pytest.fixture
def csv_file(tmp_path: Path) -> Path:
    rows = [
        HEADER,
        _row("PARACETAMOL 500 mg", "PARACETAMOLUM", "500mg", "Cutie x 10 compr.", "http://anm/PRO_1.pdf"),
        # same product, different pack size -> deduplicated
        _row("PARACETAMOL 500 mg", "PARACETAMOLUM", "500mg", "Cutie x 20 compr.", "http://anm/PRO_1.pdf"),
        _row("NUROFEN 200 mg", "IBUPROFENUM", "200mg", "Cutie x 12 draj.", "http://anm/PRO_2.pdf", form="DRAJ."),
        _row("ASPENTER 75 mg", "ACIDUM ACETYLSALICYLICUM", "75mg", "Cutie x 28 compr.", "http://anm/PRO_3.pdf"),
        _row("FENIBUT ŞTIINŢĂ", "PHENIBUTUM", "250mg", "Cutie", "http://anm/PRO_4.pdf"),
    ]
    path = tmp_path / "catalog.csv"
    path.write_text("\n".join(rows), encoding="utf-8")
    return path


@pytest.fixture
def imported(engine, csv_file):
    with Session(engine) as session:
        import_csv(session, csv_file)
    return engine


def test_normalize_strips_diacritics_and_punctuation():
    assert normalize("Fenibut ştiinţă / 250-mg") == "FENIBUT STIINTA 250 MG"
    assert normalize(None) == ""


def test_read_csv_deduplicates_pack_sizes(csv_file):
    rows = read_csv_rows(csv_file)
    assert [r["name"] for r in rows] == ["PARACETAMOL 500 mg", "NUROFEN 200 mg", "ASPENTER 75 mg", "FENIBUT ŞTIINŢĂ"]
    assert rows[0]["leaflet_url"] == "http://anm/PRO_1.pdf"
    assert rows[0]["spc_url"] == "http://anm/PRO_1.pdf.rcp"
    assert "pack" not in rows[0]


def test_read_csv_rejects_wrong_columns(tmp_path):
    path = tmp_path / "bad.csv"
    path.write_text('"Nume";"Altceva"\n"a";"b"', encoding="utf-8")
    with pytest.raises(ValueError, match="missing columns"):
        read_csv_rows(path)


def test_import_replaces_existing_catalog(engine, csv_file):
    with Session(engine) as session:
        assert import_csv(session, csv_file) == 4
        assert import_csv(session, csv_file) == 4
        assert len(search(session, "paracetamol")) == 1


def test_search_by_name_prefix_typo_and_dci(imported):
    with Session(imported) as session:
        assert search(session, "parac")[0][0].name == "PARACETAMOL 500 mg"
        assert search(session, "nurofne")[0][0].name == "NUROFEN 200 mg"
        assert search(session, "ibuprofen")[0][0].name == "NUROFEN 200 mg"
        assert search(session, "fenibut stiinta")[0][0].name == "FENIBUT ŞTIINŢĂ"
        assert search(session, "   ") == []
        # unrelated names are not padded into the results
        assert [e.name for e, _ in search(session, "paracetamol")] == ["PARACETAMOL 500 mg"]


def test_match_ocr_lines_ignores_noise_lines(imported):
    lines = ["firma srl", "nurofen", "200 mg", "12 drajeuri", "lot 4421"]
    with Session(imported) as session:
        matches = match_ocr_lines(session, lines)
    assert matches[0][0].name == "NUROFEN 200 mg"
    assert matches[0][1] >= 90


def test_match_ocr_lines_with_only_numbers_matches_nothing(imported):
    with Session(imported) as session:
        assert match_ocr_lines(session, ["500 mg", "20", "x"]) == []


def test_search_endpoint(client, engine, csv_file):
    with Session(engine) as session:
        import_csv(session, csv_file)
    resp = client.get("/catalog/search", params={"q": "aspenter"})
    assert resp.status_code == 200
    first = resp.json()[0]
    assert first["entry"]["name"] == "ASPENTER 75 mg"
    assert first["entry"]["leaflet_url"] == "http://anm/PRO_3.pdf"
    assert first["score"] == 100.0


def test_search_endpoint_validates_query(client):
    assert client.get("/catalog/search", params={"q": "a"}).status_code == 422


def test_get_entry_and_404(client, engine, csv_file):
    with Session(engine) as session:
        import_csv(session, csv_file)
    entry_id = client.get("/catalog/search", params={"q": "nurofen"}).json()[0]["entry"]["id"]
    assert client.get(f"/catalog/{entry_id}").json()["dci"] == "IBUPROFENUM"
    assert client.get("/catalog/99999").status_code == 404
