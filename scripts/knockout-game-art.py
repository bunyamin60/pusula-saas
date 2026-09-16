"""Knock out studio gray/beige backdrops on lobby game PNGs.

Reads originals from public/games/_source (copied on first run),
writes transparent, trimmed PNGs back to public/games.

Re-run:
  python scripts/knockout-game-art.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1] / "public" / "games"
SOURCE = ROOT / "_source"
TRIM_PAD = 16


def ensure_source() -> None:
    SOURCE.mkdir(parents=True, exist_ok=True)
    for src in ROOT.glob("*.png"):
        dest = SOURCE / src.name
        if not dest.exists():
            shutil.copy2(src, dest)


def knockout(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = np.asarray(image).astype(np.float32)
    rgb = pixels[:, :, :3]
    height, width, _ = pixels.shape
    chroma = rgb.max(axis=2) - rgb.min(axis=2)

    border = np.concatenate(
        [chroma[0, :], chroma[-1, :], chroma[:, 0], chroma[:, -1]]
    )
    weak_t = max(18.0, float(np.percentile(border, 95) + 10.0))
    strong_t = max(weak_t + 10.0, 30.0)
    strong = chroma >= strong_t
    weak = chroma >= weak_t

    mask = strong
    for _ in range(24):
        grown = ndimage.binary_dilation(mask, iterations=2) & weak
        if np.array_equal(grown, mask):
            break
        mask = grown

    mask = ndimage.binary_fill_holes(mask)
    mask = ndimage.binary_dilation(mask, iterations=2)
    labeled, count = ndimage.label(mask)
    if count > 1:
        sizes = ndimage.sum(mask, labeled, range(1, count + 1))
        keep = sizes >= max(float(np.max(sizes)) * 0.04, 400.0)
        keep_ids = {i + 1 for i, ok in enumerate(keep) if ok}
        mask = np.isin(labeled, list(keep_ids))

    alpha = ndimage.gaussian_filter(mask.astype(np.float32), sigma=1.1)
    alpha = np.clip(alpha, 0.0, 1.0)

    out = pixels.copy()
    out[:, :, 3] = alpha * 255.0
    result = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")

    bbox = result.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        left = max(0, left - TRIM_PAD)
        top = max(0, top - TRIM_PAD)
        right = min(width, right + TRIM_PAD)
        bottom = min(height, bottom + TRIM_PAD)
        result = result.crop((left, top, right, bottom))

    dest = ROOT / path.name
    result.save(dest, "PNG", optimize=True)
    print(
        f"{path.name}: {image.size} -> {result.size}  weak>={weak_t:.0f} strong>={strong_t:.0f}"
    )


def main() -> None:
    ensure_source()
    for src in sorted(SOURCE.glob("*.png")):
        knockout(src)


if __name__ == "__main__":
    main()
