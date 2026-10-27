# Food photos (meal tracker)

469 pictures, 360 × 360 WebP on a white background, one per food, from two
supplied sets: the first "Alimenti" archive (187 pictures; 600 × 600 JPEG in
seven folders — verdura, frutta, carne e pesce, frutta secca e semi,
latticini e uova, cereali, pasta e pane, legumi) and the second one,
"Alimenti_3" (282 pictures in eight folders — proteine, carboidrati, grassi,
verdura, frutta, latticini, legumi, altro), both converted. The second set's JPEGs are soft and blocky at 600 px, so
each was kept at full size, cleaned of compression noise, lightly sharpened
and its off-white backdrop made pure white, so it sits on a white tile with
no visible square.
The second set covers the foods of the FitLab set (`fl…`) and the older
ones the first set had left without. Where a name was already taken the
new picture carries a `-2` (a different preparation, e.g. dry rice), and
where the same name appears in two folders, the folder (`-carboidrati`…).

Which food shows which picture is decided in
`src/lib/nutrition/food-photos.ts`. A food is matched to a picture when its
name is the picture's name, or by a hand-made table for the others (a
"coscia di pollo" shows the chicken-thigh picture whether it is raw or
roasted). A food without a picture shows the grey placeholder tile.
