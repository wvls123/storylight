"""Generate cozy storybook page textures and icons with Pillow."""
from __future__ import annotations

import math
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "assets"
RNG = random.Random(42)


def font(size: int):
    candidates = [
        Path(os.environ.get("STORYLIGHT_FONT", "")),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"),
        Path("C:/Windows/Fonts/georgia.ttf"),
        Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for p in candidates:
        if p and p.is_file():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def grad(w, h, c1, c2, vertical=True):
    img = Image.new("RGB", (w, h), c1)
    draw = ImageDraw.Draw(img)
    for i in range(h if vertical else w):
        t = i / max(1, (h if vertical else w) - 1)
        col = tuple(int(c1[j] * (1 - t) + c2[j] * t) for j in range(3))
        if vertical:
            draw.line([(0, i), (w, i)], fill=col)
        else:
            draw.line([(i, 0), (i, h)], fill=col)
    return img


def soft_circle(draw, xy, r, fill, steps=8):
    x, y = xy
    for i in range(steps, 0, -1):
        a = int(fill[3] * (i / steps) ** 1.5) if len(fill) == 4 else 180
        col = (*fill[:3], a) if len(fill) == 4 else (*fill, a)
        rr = int(r * i / steps)
        draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=col)


def stars(draw, w, h, n=40, color=(255, 236, 170, 220)):
    for _ in range(n):
        x = RNG.randint(20, w - 20)
        y = RNG.randint(20, int(h * 0.55))
        s = RNG.randint(2, 5)
        soft_circle(draw, (x, y), s, color, steps=4)


def save(img: Image.Image, name: str):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print("art", path.name)


def page_bedroom():
    img = grad(1024, 768, (34, 42, 78), (92, 58, 48))
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle([620, 120, 920, 420], radius=28, fill=(20, 28, 55, 220), outline=(180, 140, 90, 255), width=8)
    soft_circle(d, (200, 520), 120, (255, 180, 90, 70))
    d.rounded_rectangle([120, 480, 520, 680], radius=30, fill=(140, 70, 55, 210))
    d.rounded_rectangle([140, 450, 300, 520], radius=24, fill=(240, 220, 190, 230))
    stars(d, 1024, 768, 12, (255, 255, 255, 40))
    out = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    save(out, "page-1-bedroom.png")
    save(out.resize((1024, 640)), "wall-bedroom.png")


def page_garden():
    img = grad(1024, 768, (18, 36, 28), (48, 78, 42))
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for x in (80, 220, 780, 920):
        d.polygon([(x, 700), (x + 40, 180), (x + 80, 700)], fill=(28, 52, 34, 230))
    d.polygon([(420, 760), (520, 300), (620, 760)], fill=(90, 70, 42, 160))
    for _ in range(28):
        soft_circle(
            d,
            (RNG.randint(200, 800), RNG.randint(220, 650)),
            RNG.randint(6, 14),
            (255, 230, 120, RNG.randint(90, 180)),
        )
    out = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    save(out, "page-2-garden.png")
    save(out.resize((1024, 640)), "wall-garden.png")


def page_meadow():
    img = grad(1024, 768, (28, 34, 70), (70, 92, 58))
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.ellipse([0, 420, 1024, 900], fill=(58, 92, 54, 220))
    for _ in range(18):
        x, y = RNG.randint(120, 900), RNG.randint(430, 640)
        soft_circle(d, (x, y), RNG.randint(10, 18), (255, 220, 140, 140))
        s = 10
        d.polygon(
            [(x, y - s), (x + 3, y - 3), (x + s, y), (x + 3, y + 3), (x, y + s), (x - 3, y + 3), (x - s, y), (x - 3, y - 3)],
            fill=(255, 236, 170, 200),
        )
    out = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    save(out, "page-3-meadow.png")
    save(out.resize((1024, 640)), "wall-meadow.png")


def page_home():
    img = grad(1024, 768, (16, 22, 48), (88, 64, 40))
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rectangle([480, 420, 540, 720], fill=(70, 48, 28, 230))
    for i, y in enumerate(range(180, 520, 70)):
        w = 90 + i * 28
        d.polygon([(510, y), (510 - w, y + 95), (510 + w, y + 95)], fill=(34, 70, 42, 235))
    soft_circle(d, (510, 250), 70, (210, 230, 255, 90))
    stars(d, 1024, 768, 55, (255, 240, 180, 210))
    out = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    save(out, "page-4-home.png")
    save(out.resize((1024, 640)), "wall-home.png")


def cover():
    img = grad(1024, 1280, (48, 34, 70), (160, 96, 54))
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    stars(d, 1024, 1280, 80)
    soft_circle(d, (512, 520), 180, (255, 200, 120, 70))
    d.ellipse([390, 560, 630, 760], fill=(210, 120, 60, 240))
    f = font(54)
    d.text((512, 180), "Лучик", font=f, fill=(255, 236, 190, 255), anchor="mm")
    f2 = font(36)
    d.text((512, 1000), "Медвежонок Миша", font=f2, fill=(255, 246, 220, 255), anchor="mm")
    out = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    save(out, "cover-misha.png")


def icon(name, painter):
    img = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    soft_circle(d, (256, 256), 230, (255, 245, 220, 255), steps=3)
    painter(d)
    save(img, name)


def paper_tex():
    img = Image.new("RGB", (1024, 1280), (243, 227, 200))
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(1200):
        x, y = RNG.randint(0, 1023), RNG.randint(0, 1279)
        d.point((x, y), fill=(180, 140, 90, RNG.randint(10, 40)))
    save(img, "tex-paper.png")


def main():
    page_bedroom()
    page_garden()
    page_meadow()
    page_home()
    cover()
    paper_tex()
    print("art done")


if __name__ == "__main__":
    main()
