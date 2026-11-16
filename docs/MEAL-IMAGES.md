# Foto dei piatti

Le foto compaiono accanto al nome del piatto nelle card del Piano alimentare e in testa alla scheda della ricetta.

Tutte hanno la stessa inquadratura: piatto visto dall'alto, sfondo bianco, soggetto centrato con margine bianco intorno. Così la tile (bianca, quadrata) non taglia mai il piatto.

## Una foto per ricetta

Ogni ricetta del pool (`src/lib/planning/fitlab/dishes.ts`) ha **la sua foto**, fatta per lei: gli ingredienti di una ricetta non cambiano da persona a persona (cambiano solo i grammi), quindi la foto mostra sempre il piatto descritto dal nome. Nessuna foto serve due ricette e nessuna ricetta resta senza foto: `npm run meals:check` fallisce in entrambi i casi.

## Dove stanno le cose

| Cosa | Dove |
|---|---|
| File WebP (512 × 512) | `public/images/meals/<id>.webp` |
| Catalogo delle foto (id, nome, categoria, percorso, alt) | `src/lib/planning/fitlab/data/meal-images.json` |
| Quale ricetta usa quale foto | `DISH_IMAGE_IDS` in `src/lib/planning/fitlab/dish-images.ts` |
| Componente che la mostra | `src/components/nutrition/dish-photo.tsx` |
| Inquadratura uniforme e scarto delle foto tagliate | `python3 scripts/assets/normalize-meal-photos.py` |
| Descrizione da dare a ChatGPT per ogni ricetta | `scripts/assets/recipe-pool.py` (campo `look`) |
| Controllo automatico (anche in CI) | `npm run meals:check` |

## Aggiungere la foto di una ricetta nuova

1. Genera la foto con ChatGPT (sotto) e salvala come `public/images/meals/<id ricetta in minuscolo>.webp` (es. `l51.webp`).
2. Esegui `python3 scripts/assets/normalize-meal-photos.py public/images/meals/l51.webp`: se il piatto tocca il bordo la foto viene scartata (va rigenerata), altrimenti viene centrata con margine bianco e portata a 512 × 512.
3. Aggiungi la voce in `meal-images.json` (id, nome della ricetta, categoria, percorso, alt) e la riga `L51: 'l51'` in `DISH_IMAGE_IDS`.
4. Esegui `npm run meals:check`.

## Generare una foto che manca

Le foto sono generate con ChatGPT, con questa richiesta (cambia solo la descrizione del piatto):

> Genera un'immagine quadrata 1:1. Fotografia realistica dall'alto (flat lay) di: **<descrizione del piatto con i suoi ingredienti visibili>**. Tutto in un unico piatto o ciotola di ceramica bianca, sfondo bianco puro uniforme, luce da studio morbida con ombra leggera. Il piatto è piccolo rispetto all'inquadratura, perfettamente centrato, interamente visibile e non tagliato, con ampio margine bianco tutto intorno. Stile food photography pulito e minimale. Niente testo, niente posate, niente mani, nessun altro oggetto.

## Spostare le foto su una CDN

Imposta `EXPO_PUBLIC_MEAL_IMAGE_BASE_URL` (es. `https://cdn.example.com`) e carica lì la cartella `images/meals/` con gli stessi percorsi. Il campo `image` del catalogo resta com'è. Un `image` già assoluto (`https://…`) viene usato così com'è.

Senza questa variabile, il sito web serve le foto da sé. Un'eventuale build nativa iOS/Android ha bisogno della variabile: senza, mostra l'icona del piatto al posto della foto.

