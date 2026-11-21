"""Download an ANM patient leaflet (PDF) and pull out the sections the AI needs.

Romanian leaflets follow a fixed EMA/ANM template:
  1. Ce este X si pentru ce se utilizeaza
  2. Ce trebuie sa stiti inainte sa luati X
  3. Cum sa luati X              <- dose, interval, max daily dose
  4. Reactii adverse posibile    <- side effects
  5. Cum se pastreaza X
The headings appear twice (table of contents, then the body), so the *last*
occurrence of each heading is used.
"""

import re

import httpx
import pymupdf

# Enough for the dosing/side-effect sections of even long leaflets while
# keeping the LLM prompt small.
MAX_SECTION_CHARS = 7000
FALLBACK_CHARS = 12000

_HEADING = r"(?m)^[ \t]*{num}\.\s*{word}"
SECTION_PATTERNS = {
    "dosage": (_HEADING.format(num=3, word=r"Cum\s+s"), _HEADING.format(num=4, word=r"Reac")),
    "side_effects": (_HEADING.format(num=4, word=r"Reac"), _HEADING.format(num=5, word=r"Cum\s+se\s+p")),
}


class LeafletError(Exception):
    """Leaflet could not be downloaded or has no extractable text."""


def fetch_pdf(url: str, timeout: float = 30.0) -> bytes:
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=timeout)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise LeafletError(f"Nu am putut descărca prospectul: {exc}") from exc
    if not resp.content.startswith(b"%PDF"):
        raise LeafletError("Linkul prospectului nu a returnat un PDF.")
    return resp.content


def pdf_to_text(data: bytes) -> str:
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            text = "\n".join(page.get_text() for page in doc)
    except Exception as exc:  # pymupdf raises its own assorted error types
        raise LeafletError(f"PDF-ul prospectului nu poate fi citit: {exc}") from exc
    if len(text.strip()) < 200:
        raise LeafletError("Prospectul este scanat (imagine), fără text extractibil.")
    return text


def _section(text: str, start_pat: str, end_pat: str) -> str | None:
    starts = list(re.finditer(start_pat, text))
    if not starts:
        return None
    start = starts[-1].start()
    end_match = re.search(end_pat, text[start + 1 :])
    end = start + 1 + end_match.start() if end_match else len(text)
    section = text[start:end].strip()
    return section[:MAX_SECTION_CHARS] or None


def extract_sections(text: str) -> dict[str, str]:
    """{'dosage': ..., 'side_effects': ...}; falls back to the raw text if the template isn't found."""
    sections = {
        name: body
        for name, (start, end) in SECTION_PATTERNS.items()
        if (body := _section(text, start, end))
    }
    if not sections:
        sections["full_text"] = text[:FALLBACK_CHARS]
    return sections


def load_leaflet_sections(url: str) -> dict[str, str]:
    return extract_sections(pdf_to_text(fetch_pdf(url)))
