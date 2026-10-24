# Food photos (meal tracker)

49 WebP close-ups, 192 × 192, each cut square to fill its tile edge to
edge. Which food shows which photo is decided in
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
food is taken from above its own printed label, with the label left out.
The rebuilt board is not continuous — every 320 px down it changes source
crop, and the two halves of a food do not line up — so each square is cut
from inside one crop only, never across a join. Within it the square is
as tall as the crop allows and centred on the coloured part of the food
(the rice, not the white bowl), with no padding added: the food reaches
the tile's edges. Carrot and aubergine use the whole vegetable rather than
its slices.

Seven foods of the batch are not here because the original crops lost
almost all of the board's last row: olio extravergine, burro, limone,
aglio, basilico, rosmarino, origano.

## Licence

From the batch's own notes: generated content — verify the image
generation service's terms before commercial redistribution. The batch
also recommends regenerating each food individually for production.
