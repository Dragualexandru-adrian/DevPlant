"""Load the ANM authorised-medicines CSV into the drug_catalog table.

Usage (from backend/, venv active):
    python -m scripts.import_catalog "D:\\medicamente_autorizate_cu_prospecte.csv"

Replaces the whole catalog each run; cached AI summaries are kept (keyed by leaflet URL).
"""

import argparse
import time
from pathlib import Path

from sqlmodel import Session

from app.catalog import import_csv
from app.db import engine, init_db


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_path", type=Path, help="ANM CSV (';'-separated, UTF-8)")
    args = parser.parse_args()
    if not args.csv_path.is_file():
        parser.error(f"file not found: {args.csv_path}")

    init_db()
    started = time.perf_counter()
    with Session(engine) as session:
        count = import_csv(session, args.csv_path)
    print(f"Imported {count} catalog entries in {time.perf_counter() - started:.1f}s")


if __name__ == "__main__":
    main()
