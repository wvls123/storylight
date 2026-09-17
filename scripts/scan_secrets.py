#!/usr/bin/env python3
"""Fail if the kit tree looks like it contains API keys or credential files."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", ".venv", "venv", "node_modules", "__pycache__"}
SKIP_SUFFIX = {".mp3", ".wav", ".png", ".jpg", ".jpeg", ".bin", ".glb", ".gltf", ".woff", ".woff2"}

# Real credential shapes only. Do not flag karaokeToken / userData / "Bearer " docs.
PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    re.compile(r"sk-proj-[A-Za-z0-9_-]{20,}"),
    re.compile(r"hf_[A-Za-z0-9]{20,}"),
    re.compile(r"xai-[A-Za-z0-9]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"),
]

FORBIDDEN_NAMES = {
    ".env",
    "secrets.env",
    "credentials.json",
    "id_rsa",
    "id_ed25519",
}

TEXT_SUFFIX = {".md", ".py", ".js", ".json", ".html", ".css", ".txt", ".yml", ".yaml", ".toml", ".env.example"}


def iter_files():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def main() -> int:
    hits: list[str] = []
    for path in iter_files():
        rel = path.relative_to(ROOT).as_posix()
        if path.name in FORBIDDEN_NAMES or path.name.endswith(".pem"):
            hits.append(f"forbidden file: {rel}")
            continue
        if path.suffix.lower() in SKIP_SUFFIX:
            continue
        if path.suffix.lower() not in TEXT_SUFFIX and path.name not in {".gitignore", "LICENSE"}:
            if path.stat().st_size > 2_000_000:
                continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for pat in PATTERNS:
            if pat.search(text):
                hits.append(f"{rel}: matched {pat.pattern}")
                break
    if hits:
        print("SECRET SCAN FAIL")
        for h in hits:
            print(" -", h)
        return 1
    print("SECRET SCAN OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
