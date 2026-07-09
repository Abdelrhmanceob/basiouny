"""Build a PDF copy with embedded bookmarks from toc.json."""
from __future__ import annotations

import json
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
except ImportError as exc:  # pragma: no cover
    raise SystemExit('Install pypdf first: pip install pypdf') from exc


def load_toc(root: Path) -> list[dict]:
    for source in (root / 'assets' / 'content.json', root / 'dist' / 'data' / 'toc.json'):
        if not source.is_file():
            continue
        data = json.loads(source.read_text(encoding='utf-8'))
        toc = data.get('toc', data if isinstance(data, list) else [])
        if isinstance(toc, list) and toc:
            return toc
    raise RuntimeError('No TOC data found in assets/content.json or dist/data/toc.json')


def build_indexed_pdf(pdf_name: str = 'quran1.pdf') -> Path:
    root = Path(__file__).resolve().parents[1]
    pdf_path = root / 'assets' / pdf_name
    if not pdf_path.is_file():
        raise FileNotFoundError(f'Missing PDF: {pdf_path}')

    toc = load_toc(root)
    reader = PdfReader(str(pdf_path))
    writer = PdfWriter()
    writer.append(reader)

    total_pages = len(reader.pages)
    added = 0
    for item in toc:
        title = str(item.get('title', '')).strip()
        page = int(item.get('page', 0) or 0)
        if not title or page < 1:
            continue
        page_index = min(page - 1, total_pages - 1)
        writer.add_outline_item(title, page_index)
        added += 1

    stem = pdf_path.stem
    output = root / 'assets' / f'{stem}_indexed.pdf'
    with output.open('wb') as handle:
        writer.write(handle)

    print(f'indexed_pdf={output}')
    print(f'bookmarks={added}')
    print(f'pages={total_pages}')
    return output


if __name__ == '__main__':
    build_indexed_pdf()
