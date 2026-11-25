from pathlib import Path

from PIL import Image

work = Path(__file__).resolve().with_name(".render")
destination = work.parent.parent / "dist" / "art"

for path in sorted(work.glob("*.png")):
    step = "-s" in path.stem
    bounds = (12, 1, 317, 278) if step else (18, 2, 470, 413)
    with Image.open(path) as image:
        image.convert("RGBA").crop(bounds).save(
            destination / (path.stem + ".webp"), quality=83 if step else 91, method=5 if step else 6
        )
