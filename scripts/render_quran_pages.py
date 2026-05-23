from pathlib import Path

import pypdfium2 as pdfium


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    pdf_path = root / "assets" / "quran1.pdf"
    out_dir = root / "assets" / "images" / "quran-pages"
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = pdfium.PdfDocument(str(pdf_path))
    total = len(doc)
    print(f"total_pages={total}")

    # Keep a moderate scale so generation finishes quickly.
    scale = 1.45
    for i in range(total):
        page = doc[i]
        bmp = page.render(scale=scale, rotation=0)
        image = bmp.to_pil()
        image.save(out_dir / f"quran-page-{i + 1:03d}.png", format="PNG", optimize=True)
        if (i + 1) % 50 == 0:
            print(f"done={i + 1}")

    print("finished=true")


if __name__ == "__main__":
    main()
