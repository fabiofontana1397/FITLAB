"""
Audit food and dish photos for defects in the source files themselves.

CSS can only show a file whole; it cannot restore what the file lacks. This
finds the two defects the current photo batches carry:

- straight seams: a perfectly straight row/column where the picture stops
  abruptly against white (a crop that was too tight, re-centred with white
  padding, or two crops stitched with a step) -- real object edges are soft
  and curved, so a long straight run is a cut;
- edge contact: the subject running off the file's own border (a plate cut
  by the frame).

Usage (needs Pillow and NumPy):  python3 scripts/assets/audit-photos.py
Exits 1 when any file is flagged, so a replacement batch can be checked
before it goes in.
"""
import glob
import sys

import numpy as np
from PIL import Image

SEAM_MIN_RUN = 0.22   # share of the side a straight cut must span
EDGE_MIN = 0.08       # share of a border row/column covered by the subject


def longest_run(mask):
    best = cur = 0
    for v in mask:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best


def seams(mn):
    light, dark = mn >= 212, mn < 175
    out = {}
    for name, Lt, Dk in (('row', light, dark), ('col', light.T, dark.T)):
        side = Lt.shape[1]
        for i in range(1, Lt.shape[0] - 4):
            run = max(longest_run(Lt[i] & Dk[i + 3]), longest_run(Dk[i] & Lt[i + 3]))
            if run >= SEAM_MIN_RUN * side and run / side > out.get(name, (0, 0))[1]:
                out[name] = (i, run / side)
    return out


def edges(a):
    subject = ~((a.min(axis=2) > 232) & ((a.max(axis=2) - a.min(axis=2)) < 14))
    cover = {'top': subject[0].mean(), 'bottom': subject[-1].mean(), 'left': subject[:, 0].mean(), 'right': subject[:, -1].mean()}
    return [k for k, v in cover.items() if v > EDGE_MIN]


def main():
    files = sorted(glob.glob('assets/images/foods/*.webp')) + sorted(glob.glob('public/images/meals/*.webp'))
    flagged = 0
    for f in files:
        a = np.asarray(Image.open(f).convert('RGB')).astype(int)
        s, e = seams(a.min(axis=2)), edges(a)
        notes = [f"straight cut at {k} {i} ({frac:.0%} of the side)" for k, (i, frac) in s.items()]
        if e:
            notes.append('subject runs off the ' + '/'.join(e) + ' border')
        flagged += bool(notes)
        print(f"{'FLAG' if notes else 'ok  '} {f}: {'; '.join(notes) or 'clean'}")
    print(f"\n{flagged} of {len(files)} files flagged")
    sys.exit(1 if flagged else 0)


if __name__ == '__main__':
    main()
