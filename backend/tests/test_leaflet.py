import httpx
import pymupdf
import pytest

from app import leaflet
from app.leaflet import LeafletError, extract_sections, fetch_pdf, pdf_to_text

# Table of contents first, then the body: the body (last occurrence) must win.
LEAFLET_TEXT = """Prospect: Informatii pentru utilizator
Ce gasiti in acest prospect:
1. Ce este Paracetamol si pentru ce se utilizeaza
2. Ce trebuie sa stiti inainte sa luati Paracetamol
3. Cum să luaţi Paracetamol
4. Reacţii adverse posibile
5. Cum se păstrează Paracetamol

1.
Ce este Paracetamol si pentru ce se utilizeaza
Analgezic.
3.
Cum să luați Paracetamol
Adulti: 1-2 comprimate la 4-6 ore.
4.
Reacţii adverse posibile
Rare: mancarimi.
5.
Cum se păstrează Paracetamol
A nu se lasa la indemana copiilor.
"""


def test_extract_sections_uses_body_not_table_of_contents():
    sections = extract_sections(LEAFLET_TEXT)
    assert "1-2 comprimate la 4-6 ore" in sections["dosage"]
    assert "Reac" not in sections["dosage"]
    assert "Rare: mancarimi." in sections["side_effects"]
    assert "păstrează" not in sections["side_effects"]


def test_extract_sections_falls_back_to_full_text():
    sections = extract_sections("Un text fara structura de prospect.")
    assert sections == {"full_text": "Un text fara structura de prospect."}


def _pdf_bytes(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((40, 60), text)
    data = doc.tobytes()
    doc.close()
    return data


def test_pdf_to_text_reads_text_pdf():
    text = pdf_to_text(_pdf_bytes("Cum sa luati medicamentul.\n" * 20))
    assert "Cum sa luati medicamentul." in text


def test_pdf_to_text_rejects_scanned_pdf():
    with pytest.raises(LeafletError, match="scanat"):
        pdf_to_text(_pdf_bytes(""))


def test_fetch_pdf_rejects_non_pdf(monkeypatch):
    monkeypatch.setattr(leaflet.httpx, "get", lambda *a, **k: httpx.Response(200, content=b"<html>", request=httpx.Request("GET", "http://x")))
    with pytest.raises(LeafletError, match="nu a returnat un PDF"):
        fetch_pdf("http://x")


def test_fetch_pdf_wraps_http_errors(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(leaflet.httpx, "get", boom)
    with pytest.raises(LeafletError, match="Nu am putut descărca"):
        fetch_pdf("http://x")
