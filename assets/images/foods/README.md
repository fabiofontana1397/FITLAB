# Food photos (meal tracker)

49 WebP packshots, 192 × 192, white background. Which food shows which
photo is decided in `src/lib/nutrition/food-photos.ts`; a food with no
fitting photo keeps its lucide glyph.

## Where they come from

The "FitLab Food Library — lotto iniziale" batch: crops of a single
AI-generated composite board, **not** photographs and **not** from Open
Food Facts.

The batch as delivered could not be used directly. Its 320 × 320 crops had
been cut on a grid that did not match the board — the board's cells are
taller than 320 px because each carries a printed label — so from the
second row on the files drifted onto the wrong food (`petto-pollo.webp`
showed chickpeas, `spaghetti.webp` rice, `burro.webp` ricotta) and most had
another food's name printed in them.

These files were re-cut from the board rebuilt out of those crops: each
food is taken from above its own printed label, with the label left out
and the square re-centred on the food. The board's columns had also been
cropped narrower than its cells, so some foods remain cut along one side;
at thumbnail size that reads as a close-up.

Seven foods of the batch are not here because the original crops lost
almost all of the board's last row: olio extravergine, burro, limone,
aglio, basilico, rosmarino, origano.

## Licence

From the batch's own notes: generated content — verify the image
generation service's terms before commercial redistribution. The batch
also recommends regenerating each food individually for production.
