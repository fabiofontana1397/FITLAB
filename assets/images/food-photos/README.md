# Food photos (meal tracker)

187 pictures, 360 × 360 WebP on a white background, one per food: the set
supplied with the "Alimenti" archive (600 × 600 JPEG in seven folders —
verdura, frutta, carne e pesce, frutta secca e semi, latticini e uova,
cereali, pasta e pane, legumi), resized and converted.

Which food shows which picture is decided in
`src/lib/nutrition/food-photos.ts`. A food is matched to a picture when its
name is the picture's name, or by a hand-made table for the others (a
"coscia di pollo" shows the chicken-thigh picture whether it is raw or
roasted). A food without a picture shows the grey placeholder tile.
