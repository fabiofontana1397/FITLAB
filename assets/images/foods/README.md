# Food photos (meal tracker)

49 WebP cut-outs, 256 × 256 with a transparent background: each food
whole, centred, shown inside its tile without cropping. Which food shows
which photo is decided in
`src/lib/nutrition/food-photos.ts`; a food with no fitting photo shows its
Fluent Emoji 3D picture (`assets/images/food-icons`) instead.

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
food is the whole cell above its own printed label, with the label left
out, and its white backdrop removed with the BiRefNet (general, lite)
segmentation model through rembg; specks the model left apart from the
food are dropped. The rebuilt board is not continuous — every 320 px down
it changes source crop and the two sides of the join do not line up — so
a thin join can show across some foods, and in the bowl rows the slice of
rim above the join is left out. The board's columns had also been cropped
narrower than its cells, so some foods keep a straight edge where the
batch itself cut them.

Seven foods of the batch are not here because the original crops lost
almost all of the board's last row: olio extravergine, burro, limone,
aglio, basilico, rosmarino, origano.

## Licence

From the batch's own notes: generated content — verify the image
generation service's terms before commercial redistribution. The batch
also recommends regenerating each food individually for production.
