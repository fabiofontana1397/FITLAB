"""
Put every dish photo in the same frame: the plate centred on a white square,
with air all around it, so no tile in the app ever cuts it.

The source photos come from different batches: some plates run off the file's
border, some sit off-centre, some are much smaller than the others. For each
file this script

1. dissolves the outermost pixels into white (a plate or shadow that touched
   the border ends in a soft fade, not in a straight cut);
2. finds the subject (everything that is not the white background);
3. scales it so its longer side takes SUBJECT_SHARE of the square and centres
   it on a white 512 x 512 canvas.

It is idempotent: a photo already in the frame is left alone.

A photo whose plate or food runs off the file's border is cut at the source: no
reframing can give back the missing rim, and in the app it reads as a cut
plate. Such a file is REJECTED (listed, left untouched, exit code 1): replace
it with a whole picture. `--feather` forces the old behaviour (fade the border
into white) for a file that cannot be replaced yet.

Usage (needs Pillow and NumPy):
    python3 scripts/assets/normalize-meal-photos.py            # all of public/images/meals
    python3 scripts/assets/normalize-meal-photos.py a.webp b.webp
    python3 scripts/assets/normalize-meal-photos.py --check     # only report cut photos, change nothing
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

SIZE = 512
SUBJECT_SHARE = 0.86  # longer side of the subject, as a share of the square
FEATHER = 16          # px over which the border dissolves into white
WHITE_MIN = 238       # a pixel whose darkest channel is above this is background
TOLERANCE = 0.03      # scale and offset within this are "already in the frame"
CUT_MAX = 212         # darker than this on the border is the plate or the food, not its soft shadow
EDGE_MIN = 0.04       # share of a border row/column the subject may cover before the photo counts as cut


def feather_to_white(rgb: np.ndarray) -> np.ndarray:
    """Blend the outer FEATHER px into white with a smooth ramp."""
    h, w, _ = rgb.shape
    ys = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    xs = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    t = np.clip(np.minimum(ys, xs) / FEATHER, 0.0, 1.0)
    keep = (t * t * (3 - 2 * t))[:, :, None]  # smoothstep
    return rgb * keep + 255.0 * (1 - keep)


def subject_box(rgb: np.ndarray):
    mask = rgb.min(axis=2) < WHITE_MIN
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def is_cut(image: Image.Image) -> bool:
    """True when the plate or the food runs off the border of the file. A soft shadow reaching the border
    does not count: normalize() fades it into white and nothing of the subject is lost."""
    rgb = np.asarray(image.convert('RGB')).astype(np.float32)
    mask = rgb.min(axis=2) < CUT_MAX
    borders = (mask[:2], mask[-2:], mask[:, :2], mask[:, -2:])
    return any(float(b.mean()) > EDGE_MIN for b in borders)


def normalize(image: Image.Image) -> tuple[Image.Image, bool]:
    """The photo in the standard frame, and whether anything had to change."""
    image = image.convert('RGB')
    if image.size != (SIZE, SIZE):
        # pad to a square on white first, then bring it to SIZE
        side = max(image.size)
        square = Image.new('RGB', (side, side), 'white')
        square.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
        image = square.resize((SIZE, SIZE), Image.LANCZOS)
        resized = True
    else:
        resized = False

    rgb = np.asarray(image).astype(np.float32)
    box = subject_box(rgb)
    if box is None:
        return image, resized
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    scale = SUBJECT_SHARE * SIZE / max(w, h)
    off_x = (x0 + x1) / 2 - SIZE / 2
    off_y = (y0 + y1) / 2 - SIZE / 2
    touches = x0 == 0 or y0 == 0 or x1 == SIZE or y1 == SIZE
    if not touches and abs(scale - 1) <= TOLERANCE and abs(off_x) <= SIZE * TOLERANCE and abs(off_y) <= SIZE * TOLERANCE:
        return image, resized

    if touches:
        rgb = feather_to_white(rgb)
        x0, y0, x1, y1 = subject_box(rgb)
        w, h = x1 - x0, y1 - y0
        scale = SUBJECT_SHARE * SIZE / max(w, h)
    subject = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).crop((x0, y0, x1, y1))
    new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
    subject = subject.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new('RGB', (SIZE, SIZE), 'white')
    canvas.paste(subject, ((SIZE - new_w) // 2, (SIZE - new_h) // 2))
    return canvas, True


def main() -> None:
    args = sys.argv[1:]
    check_only = '--check' in args
    feather = '--feather' in args
    paths = [a for a in args if not a.startswith('--')]
    root = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'images', 'meals')
    files = paths or sorted(glob.glob(os.path.join(root, '*.webp')))
    changed = 0
    cut = []
    for path in files:
        image = Image.open(path)
        if is_cut(image) and not feather:
            cut.append(os.path.basename(path))
            print(f'CUT     {os.path.basename(path)}')
            continue
        if check_only:
            continue
        result, did = normalize(image)
        if did:
            result.save(path, 'WEBP', quality=84, method=6)
            changed += 1
            print(f'framed  {os.path.basename(path)}')
    print(f'{changed} of {len(files)} photo(s) reframed, {len(cut)} cut at the source')
    if cut:
        sys.exit(1)


if __name__ == '__main__':
    main()
