from pathlib import Path

from PIL import Image
from fpdf import FPDF


def iter_page_images(images_dir: Path):
    return sorted(images_dir.glob("quran-page-*.png"))


def create_temp_jpegs(source_images, temp_dir: Path):
    temp_dir.mkdir(parents=True, exist_ok=True)
    generated = []

    for img_path in source_images:
        with Image.open(img_path) as image:
            rgb = image.convert("RGB")
            target_width = 920
            if rgb.width > target_width:
                target_height = int((target_width / rgb.width) * rgb.height)
                rgb = rgb.resize((target_width, target_height), Image.Resampling.LANCZOS)

            out_name = f"{img_path.stem}.jpg"
            out_path = temp_dir / out_name
            rgb.save(out_path, format="JPEG", quality=28, optimize=True, progressive=True)
            generated.append(out_path)

    return generated


def build_pdf(jpeg_pages, output_pdf: Path):
    if not jpeg_pages:
        raise RuntimeError("No page images found for compression.")

    pdf = FPDF(unit="pt")

    for page_path in jpeg_pages:
        with Image.open(page_path) as image:
            width, height = image.size
        pdf.add_page(format=(width, height))
        pdf.image(str(page_path), x=0, y=0, w=width, h=height)

    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_pdf))


def main():
    root = Path(__file__).resolve().parents[1]
    source_dir = root / "assets" / "images" / "quran-pages"
    temp_dir = root / "assets" / "images" / "quran-pages-jpg"
    output_pdf = root / "assets" / "quran1_compressed.pdf"

    source_images = iter_page_images(source_dir)
    print(f"source_pages={len(source_images)}")
    jpeg_pages = create_temp_jpegs(source_images, temp_dir)
    print(f"jpeg_pages={len(jpeg_pages)}")
    build_pdf(jpeg_pages, output_pdf)
    print(f"output={output_pdf}")


if __name__ == "__main__":
    main()
