# Review — "La formula sbagliata"

Render: `renders/brand-film_2026-10-31_19-14-37.mp4` — H.264, 1080×1920, 30 fps,
29,0 s, 1,5 MB, traccia AAC. `check` passa con **0 errori e 0 warning**.
Motion blur attivo: 28 elementi in movimento, 0 frame falliti.

## Beat sheet

| t | Scena | Verifica |
|---|---|---|
| 0,0 | hook | Frame 0 pieno e leggibile: formula a 52 px + eyebrow. Mai nero, mai logo. ✔ |
| 1,2 | hook | `2.750` atterra su `expo.out`, coda lunga, nessun rimbalzo sull'opacità ✔ |
| 5,5 | seam 1 | Il numero non si muove al taglio: stessa x, stessa scala, stesso font ✔ |
| 5,7 | verdict | Banda d'errore 2.480⟷3.020 si apre dal centro; il numero vira a grigio ✔ |
| 11,0 | seam 2 | La banda si allarga ×9 e porta fuori: object becomes the world ✔ |
| 11,2 | loop | Tre righe dati, stagger 0,45 s. Nessun frame morto in apertura ✔ |
| 15,5 | loop | Convergenza + "Ricalibra." ✔ |
| 18,6 | seam 3 | Whip verticale 0,3 s con sfocatura ✔ |
| 19,4 | correction | Conteggio 2.750 → **2.610**, separatore migliaia corretto ✔ |
| 21,1 | correction | `initial_estimate` → `current_target` ✔ |
| 24,4 | seam 4 | Colour flood volt, poi le ali escono dal volt ✔ |
| 24,7 | endcard | Due ali, 80 ms di sfasatura, `back.out(1.35)` ≈ damping 0,8 ✔ |
| 26,7 | endcard | Lockup 340 px = 31% della larghezza. Claim tenuto 3,0 s ✔ |

## Craft

- **Transizioni**: 4 tipi, ognuna causata da qualcosa in scena. Nessun crossfade fra mondi.
- **Titoli atterrati**: fermi. Nessun respiro, nessuna scala lenta, nessun pulsare.
- **Uscite**: 0,18–0,24 s contro entrate di 0,3–0,62 s — fra il 40% e il 50% più corte.
- **Entrate differenziate**: il numero atterra, la riga sfoca, il kicker rimbalza,
  le barre crescono, la linea si disegna, le ali volano. Nessuna si ripete.
- **Colore**: il volt compare solo su ciò che la tesi promuove — l'errore, la
  ricalibrazione, il target corretto, "Si osserva.". Mai decorativo.
- **Leggibilità**: nessun testo sotto 28 px; contrasto minimo 4,5:1 su testo piccolo
  e 3:1 su quello grande, verificato da `check`.
- **Banda verticale**: ogni parola fra 168 e 1330 px. Sotto, solo il glow di fondo.

## Debolezze note

1. **Nessuna fotografia.** Il film è tipografico e di dati. Le immagini di sport e
   nutrizione chieste non ci sono perché `api.heygen.com` è bloccato dal proxy e
   non esiste altra fonte reale in sessione. Inventarle avrebbe violato la regola
   "mai un mockup". Punti d'innesto naturali: dietro l'hook (0–5 s) e sotto le tre
   righe dati (11–18 s).
2. **Nessuna musica.** Solo 8 SFX bundled su lane separate. Un letto musicale
   cambierebbe parecchio la percezione di "premium": passa da HeyGen.
3. **Nessuna CTA.** Non ho un dominio o un handle reale di FITLAB, quindi non l'ho
   inventato. L'end card chiude sul claim. Serve il dato vero per aggiungerla.
4. **2.610 è derivato.** È l'unico numero non preso dallo spec: rappresenta l'esito
   del ciclo adattivo, non un valore di prodotto.
5. **I tre segmenti** riposo/NEAT/allenamento hanno larghezze indicative (58/26/16%).
   Lo spec definisce la scomposizione ma non la ripartizione; per questo non ho
   stampato numeri per segmento.
