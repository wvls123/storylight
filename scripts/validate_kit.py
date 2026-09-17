#!/usr/bin/env python3
"""Check that the book kit is complete and pages.json matches files on disk."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def fail(msg: str) -> None:
    print("VALIDATE FAIL:", msg)
    raise SystemExit(1)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", default="book")
    args = parser.parse_args()
    book = (ROOT / args.book).resolve()
    if not book.is_dir():
        fail(f"missing book dir {book}")

    for rel in ("index.html", "app.js", "style.css", "pages.json", "audio/manifest.json"):
        if not (book / rel).is_file():
            fail(f"missing {rel}")

    pages = json.loads((book / "pages.json").read_text(encoding="utf-8"))
    if not pages.get("pages"):
        fail("pages.json has no pages")
    for page in pages["pages"]:
        pid = page.get("id")
        for key in ("title", "readText", "audio", "image", "words"):
            if key not in page:
                fail(f"page {pid}: missing {key}")
        for rel in (page["audio"], page["image"]):
            if not (book / rel).is_file():
                fail(f"page {pid}: file not found {rel}")
        if not page["words"]:
            fail(f"page {pid}: empty words")
        duration = sum(float(w.get("d") or 0) for w in page["words"])
        if duration < 3:
            fail(f"page {pid}: karaoke duration too short ({duration:.2f}s)")
        for obj in page.get("objects") or []:
            icon = obj.get("icon")
            audio = obj.get("audio")
            if icon and not (book / icon).is_file():
                fail(f"page {pid} object {obj.get('id')}: missing icon {icon}")
            if audio and not (book / audio).is_file():
                fail(f"page {pid} object {obj.get('id')}: missing audio {audio}")

    manifest = json.loads((book / "audio/manifest.json").read_text(encoding="utf-8"))
    missing = [f["id"] for f in manifest.get("files") or [] if not f.get("exists")]
    if missing:
        fail("audio manifest missing files: " + ", ".join(missing))

    models = [
        "assets/models/WoodenTable_01/WoodenTable_01_1k.gltf",
        "assets/models/vintage_oil_lamp/vintage_oil_lamp_1k.gltf",
        "assets/models/wooden_lantern_01/wooden_lantern_01_1k.gltf",
        "assets/models/plush_bear/plush_bear.glb",
    ]
    for rel in models:
        if not (book / rel).is_file():
            fail(f"missing model {rel}")

    print(f"VALIDATE OK pages={len(pages['pages'])} audio={len(manifest.get('files') or [])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
