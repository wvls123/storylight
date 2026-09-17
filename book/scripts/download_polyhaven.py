"""Download Poly Haven CC0 glTF 1k packs. Powered by Poly Haven."""
import json
import ssl
import urllib.request
from pathlib import Path

UA = "blender-agent-bridge/1.0"
OUT = Path(__file__).resolve().parents[1] / "assets" / "models"
CTX = ssl.create_default_context()

IDS = [
    "WoodenTable_01",
    "vintage_oil_lamp",
    "wooden_lantern_01",
    "GothicBed_01",
    "ClassicNightstand_01",
    "painted_wooden_nightstand",
    "book_encyclopedia_set_01",
    "side_table_01",
]


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90, context=CTX) as resp:
        return resp.read()


def download_id(asset_id: str) -> Path:
    dest = OUT / asset_id
    dest.mkdir(parents=True, exist_ok=True)
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset_id}"))
    pack = files["gltf"]["1k"]["gltf"]
    gltf_name = pack["url"].rstrip("/").split("/")[-1]
    (dest / gltf_name).write_bytes(get(pack["url"]))
    for rel, meta in (pack.get("include") or {}).items():
        path = dest / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(get(meta["url"]))
    (dest / "meta.json").write_text(
        json.dumps(
            {
                "id": asset_id,
                "source": f"https://polyhaven.com/a/{asset_id}",
                "license": "CC0-1.0",
                "credit": "Powered by Poly Haven",
                "gltf": gltf_name,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("OK", asset_id, gltf_name, "files", 1 + len(pack.get("include") or {}))
    return dest / gltf_name


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for asset_id in IDS:
        download_id(asset_id)


if __name__ == "__main__":
    main()
