"""Generate Storylight narration.

Primary: local Qwen3-TTS VoiceDesign (set QWEN3_TTS_ROOT).
Fallback: edge-tts ru-RU-SvetlanaNeural (no API key).

Never read or write API keys. Paths come from env, never from a home folder.
"""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from shutil import which

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
PAGES = ROOT / "pages.json"

INSTRUCT = (
    "Warm elderly Russian fairy-tale narrator, like a grandmother reading "
    "a gentle bedtime story to a child. Soft, magical, calm, clear diction, "
    "medium-slow pace, kind and slightly smiling, cozy and tender, not cartoon."
)
LANG = "Russian"
EDGE_VOICE = "ru-RU-SvetlanaNeural"


def qwen_root() -> Path | None:
    raw = os.environ.get("QWEN3_TTS_ROOT", "").strip()
    if not raw:
        return None
    return Path(raw).expanduser().resolve()


def qwen_python(root: Path) -> Path | None:
    override = os.environ.get("QWEN3_TTS_PYTHON", "").strip()
    if override:
        p = Path(override)
        return p if p.is_file() else None
    for rel in (Path(".venv") / "Scripts" / "python.exe", Path(".venv") / "bin" / "python"):
        cand = root / rel
        if cand.is_file():
            return cand
    return None


def load_jobs() -> list[tuple[str, str]]:
    book = json.loads(PAGES.read_text(encoding="utf-8"))
    jobs: list[tuple[str, str]] = []
    for page in book["pages"]:
        stem = f"page-{page['id']}"
        jobs.append((stem, page["readText"]))
        for obj in page.get("objects") or []:
            audio = obj.get("audio") or ""
            if not audio:
                continue
            name = Path(audio).stem
            if any(j[0] == name for j in jobs):
                continue
            jobs.append((name, obj.get("speak") or obj.get("label") or name))
    return jobs


def save_wav_mp3(stem: str, wav, sr: int) -> None:
    import numpy as np
    import soundfile as sf

    AUDIO.mkdir(parents=True, exist_ok=True)
    wav_path = AUDIO / f"{stem}.wav"
    mp3_path = AUDIO / f"{stem}.mp3"
    audio = np.asarray(wav, dtype=np.float32).squeeze()
    peak = float(np.max(np.abs(audio)) + 1e-8)
    audio = np.clip(audio / peak * 0.92, -0.95, 0.95)
    sf.write(wav_path, audio, sr)
    ffmpeg = which("ffmpeg")
    if ffmpeg:
        subprocess.run(
            [ffmpeg, "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-qscale:a", "4", str(mp3_path)],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    if not mp3_path.exists():
        mp3_path.write_bytes(wav_path.read_bytes())
    print(f"OK {stem} ({len(audio) / sr:.2f}s)")


def generate_qwen(jobs: list[tuple[str, str]], root: Path) -> str:
    import gc

    import numpy as np
    import torch
    from qwen_tts import Qwen3TTSModel

    design_dir = root / "models" / "Qwen3-TTS-12Hz-1.7B-VoiceDesign"
    if not (design_dir / "config.json").is_file():
        raise FileNotFoundError(f"VoiceDesign missing: {design_dir}")

    print("Loading Qwen3-TTS VoiceDesign ...")
    model = Qwen3TTSModel.from_pretrained(
        str(design_dir),
        device_map="cuda:0" if torch.cuda.is_available() else "cpu",
        dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
    )
    engine = "qwen3-tts-voicedesign"
    for i, (stem, text) in enumerate(jobs, 1):
        out_mp3 = AUDIO / f"{stem}.mp3"
        out_wav = AUDIO / f"{stem}.wav"
        if out_mp3.exists() or out_wav.exists():
            print(f"[{i}/{len(jobs)}] skip {stem}")
            continue
        print(f"[{i}/{len(jobs)}] {stem}: {text[:56]}...")
        wavs, sr = model.generate_voice_design(
            text=text,
            language=LANG,
            instruct=INSTRUCT,
            non_streaming_mode=True,
        )
        save_wav_mp3(stem, np.asarray(wavs[0], dtype=np.float32), sr)
    del model
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return engine


async def generate_edge(jobs: list[tuple[str, str]]) -> str:
    import edge_tts

    AUDIO.mkdir(parents=True, exist_ok=True)
    for i, (stem, text) in enumerate(jobs, 1):
        out = AUDIO / f"{stem}.mp3"
        if out.exists() and out.stat().st_size > 1000:
            print(f"[{i}/{len(jobs)}] skip {stem}")
            continue
        print(f"[edge {i}/{len(jobs)}] {stem}")
        communicate = edge_tts.Communicate(text, EDGE_VOICE, rate="-8%")
        await communicate.save(str(out))
    return "edge-tts-svetlana"


def write_manifest(engine: str, jobs: list[tuple[str, str]]) -> None:
    files = []
    for stem, text in jobs:
        path = AUDIO / f"{stem}.mp3"
        if not path.exists():
            path = AUDIO / f"{stem}.wav"
        files.append(
            {
                "id": stem,
                "text": text,
                "file": f"audio/{path.name}" if path.exists() else None,
                "exists": path.exists(),
                "bytes": path.stat().st_size if path.exists() else 0,
            }
        )
    manifest = {
        "engine": engine,
        "voice_note": INSTRUCT if "qwen" in engine else EDGE_VOICE,
        "files": files,
    }
    (AUDIO / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("manifest", AUDIO / "manifest.json")


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    jobs = load_jobs()
    print("jobs", len(jobs))
    engine = "none"
    root = qwen_root()
    try:
        if not root:
            raise FileNotFoundError("QWEN3_TTS_ROOT is not set")
        engine = generate_qwen(jobs, root)
    except Exception as exc:
        print("Qwen TTS failed:", exc)
        print("Falling back to edge-tts ...")
        engine = asyncio.run(generate_edge(jobs))
    write_manifest(engine, jobs)
    print("done", engine)


if __name__ == "__main__":
    main()
