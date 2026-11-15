# Foto dei piatti

Le foto compaiono accanto al nome del piatto nelle card del Piano alimentare e in testa alla scheda della ricetta.

Tutte hanno la stessa inquadratura: piatto visto dall'alto, sfondo bianco, soggetto centrato con margine bianco intorno. Così la tile (bianca, quadrata) non taglia mai il piatto.

## Dove stanno le cose

| Cosa | Dove |
|---|---|
| File WebP (512 × 512) | `public/images/meals/<id>.webp` |
| Catalogo delle foto (id, nome, categoria, percorso, alt) | `src/lib/planning/fitlab/data/meal-images.json` |
| Quale piatto usa quale foto | `DISH_IMAGE_IDS` in `src/lib/planning/fitlab/dish-images.ts` |
| Componente che la mostra | `src/components/nutrition/dish-photo.tsx` |
| Quale foto vale per quali alimenti del pasto | `PHOTO_KEYS` nello stesso file |
| Inquadratura uniforme (centra, lascia margine, porta a 512 × 512) | `python3 scripts/assets/normalize-meal-photos.py` |
| Controllo automatico (anche in CI) | `npm run meals:check` |

Il catalogo delle foto è separato dai piatti (`dishes.ts`): id, alimenti e grammature dei piatti non cambiano. Una stessa foto può servire più piatti.

## Aggiungere una foto

1. Salva il file come `public/images/meals/<id>.webp`: id in minuscolo con trattini (es. `orzo-ceci-pomodorini`, oppure l'id del piatto: `x323`, `x323-pollo` per una variante), WebP quadrato. Poi esegui `python3 scripts/assets/normalize-meal-photos.py`: centra il piatto, lascia il margine bianco e porta il file a 512 × 512 (le foto già a posto non vengono toccate).
2. Aggiungi la voce in `meal-images.json`:
   ```json
   {
     "id": "orzo-ceci-pomodorini",
     "name": "Orzo con ceci e pomodorini",
     "category": "lunch",
     "image": "/images/meals/orzo-ceci-pomodorini.webp",
     "alt": "Orzo con ceci e pomodorini"
   }
   ```
   `category` è uno tra `breakfast`, `lunch`, `dinner`, `snack`.
3. Collega i piatti che la foto rappresenta davvero, in `DISH_IMAGE_IDS` (id del piatto da `dishes.ts`):
   ```ts
   X306: 'orzo-ceci-pomodorini',
   ```
4. Se il piatto ammette più alimenti (un altro pesce, un'altra frutta), dichiara in `PHOTO_KEYS` cosa mostra la foto: viene usata solo per i pasti che contengono quegli alimenti. Una seconda foto dello stesso piatto con un altro ingrediente principale va in `DISH_IMAGE_VARIANTS`.
5. Esegui `npm run meals:check`. Controlla che il file esista e sia un WebP, che gli id siano unici e corrispondano al nome del file, che i piatti collegati esistano e che non ci siano file orfani.

I componenti non vanno toccati.

## Generare una foto che manca

Le foto dei piatti X e le varianti sono generate con ChatGPT, con questa richiesta (cambia solo la descrizione del piatto):

> Genera un'immagine quadrata 1:1. Fotografia realistica dall'alto (flat lay) di: **<descrizione del piatto con i suoi ingredienti visibili>**. Stoviglie di ceramica bianca, sfondo bianco puro uniforme, luce da studio morbida con ombra leggera. Il soggetto è perfettamente centrato, interamente visibile e non tagliato, con margine bianco tutto intorno. Stile food photography pulito e minimale. Niente testo, niente posate, niente mani, nessun altro oggetto.

## Spostare le foto su una CDN

Imposta `EXPO_PUBLIC_MEAL_IMAGE_BASE_URL` (es. `https://cdn.example.com`) e carica lì la cartella `images/meals/` con gli stessi percorsi. Il campo `image` del catalogo resta com'è. Un `image` già assoluto (`https://…`) viene usato così com'è.

Senza questa variabile, il sito web serve le foto da sé. Un'eventuale build nativa iOS/Android ha bisogno della variabile: senza, mostra l'icona del piatto al posto della foto.

I piatti che aspettano ancora una foto sono in `scripts/assets/meal-photo-queue.json`: per ciascuno l'id del file, il nome, la descrizione da dare a ChatGPT (`prompt`) e gli alimenti che la foto mostra (`shows`, da riportare in `PHOTO_KEYS`). Quando una foto entra nella libreria, togli la sua voce dalla coda.
