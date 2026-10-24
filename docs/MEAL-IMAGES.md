# Foto dei piatti

Le foto compaiono accanto al nome del piatto nelle card del Piano alimentare.

## Dove stanno le cose

| Cosa | Dove |
|---|---|
| File WebP (512 × 512) | `public/images/meals/<id>.webp` |
| Catalogo delle foto (id, nome, categoria, percorso, alt) | `src/lib/planning/fitlab/data/meal-images.json` |
| Quale piatto usa quale foto | `DISH_IMAGE_IDS` in `src/lib/planning/fitlab/dish-images.ts` |
| Componente che la mostra | `src/components/nutrition/dish-photo.tsx` |
| Controllo automatico (anche in CI) | `npm run meals:check` |

Il catalogo delle foto è separato dai piatti (`dishes.ts`): id, alimenti e grammature dei piatti non cambiano. Una stessa foto può servire più piatti.

## Aggiungere una foto

1. Salva il file come `public/images/meals/<id>.webp`: id in minuscolo con trattini (es. `orzo-ceci-pomodorini`), WebP, 512 × 512, possibilmente sotto i 50 KB.
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
4. Esegui `npm run meals:check`. Controlla che il file esista e sia un WebP, che gli id siano unici e corrispondano al nome del file, che i piatti collegati esistano e che non ci siano file orfani.

I componenti non vanno toccati.

## Spostare le foto su una CDN

Imposta `EXPO_PUBLIC_MEAL_IMAGE_BASE_URL` (es. `https://cdn.example.com`) e carica lì la cartella `images/meals/` con gli stessi percorsi. Il campo `image` del catalogo resta com'è. Un `image` già assoluto (`https://…`) viene usato così com'è.

Senza questa variabile, il sito web serve le foto da sé. Un'eventuale build nativa iOS/Android ha bisogno della variabile: senza, mostra l'icona del piatto al posto della foto.
