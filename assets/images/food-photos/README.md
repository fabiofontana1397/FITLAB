# Food photos (meal tracker)

Pictures, one per food (some foods share one), on a pure white background, from three
supplied sets, the newest on top:

- **Alimenti_3 (the third archive, 220 pictures used)**: sharp 600 px
  pictures named after the foods themselves, saved at 512 × 512 WebP. They
  show 298 foods, every one with a picture of that exact name or, for a
  preparation the set has no picture of (raw / cooked of the same cut), the
  closest one. Where a name was already taken the file carries a `-3`.
- **The second set (Alimenti_2)**: soft, blocky 600 px JPEGs, cleaned and kept
  at 600 × 600; where no picture of the third set exists they still show their
  food. A name taken twice carries a `-2`, or the folder (`-carboidrati`…).
- **The first set ("Alimenti")**: 360 × 360 WebP from 600 × 600 JPEGs in
  seven folders (verdura, frutta, carne e pesce, frutta secca e semi,
  latticini e uova, cereali, pasta e pane, legumi).

A picture no food shows any more is deleted (git keeps it), so every file
here is used.

Which food shows which picture is decided in
`src/lib/nutrition/food-photos.ts`. A food is matched to a picture when its
name is the picture's name, or by a hand-made table for the others (a
"coscia di pollo" shows the chicken-thigh picture whether it is raw or
roasted). A food without a picture shows the grey placeholder tile.
