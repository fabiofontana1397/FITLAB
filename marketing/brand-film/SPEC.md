# FITLAB — "La formula sbagliata"

Brand film verticale. Tesi: *ogni equazione predittiva del metabolismo ha un errore
individuale; FITLAB non si ferma alla stima del giorno 0.* È il cambio di paradigma
dichiarato da `FITLAB_SPEC.md` §4.1 bis (Adaptive Nutrition Engine).

## Formato

| | |
|---|---|
| Canvas | 1080 × 1920, 30 fps, 28 s |
| Banda sicura | testo solo fra y=168 e y=1330; sotto 1330 solo decorazione |
| Motion blur | `data-motion-blur="on"` (render ~1.7×) |

## Palette — nessun default

| Token | Hex | Ruolo |
|---|---|---|
| `--ground` | `#08090B` | fondo |
| `--ink` | `#F2F3F5` | testo primario |
| `--mute` | `#71767F` | label, unità, stato superato |
| `--volt` | `#D4FF4F` | **solo** il valore corretto e la parola che porta la tesi |
| `--line` | `rgba(255,255,255,.10)` | righe, assi |

Vietati per nome: blu sfumato tech, viola→rosa, oro, glassmorphism, neon glow diffuso.

## Tipografia

- **Oswald** 600 — numeri eroe (TDEE, target). Condensato = atletico.
- **JetBrains Mono** 400/700 — formula, label dati, nomi campo (`initial_estimate`).
- **Inter** 500/700 — copy.

Minimo leggibile 34 px. Hero number 300 px. Claim 64 px. Label 26 px (decorative).

## Dati — tutti da FITLAB_SPEC.md, nessuno inventato

| Valore | Fonte |
|---|---|
| `10·peso + 6.25·altezza − 5·età` | §4.1 punto 1, Mifflin-St Jeor |
| TDEE 2.750 kcal | esempio §5 bis, layout "Target expenditure 2.750" |
| Intake 2.200 kcal | esempio §5 bis, "Food intake 2.200" |
| Bilancio −550 kcal | §5 bis, "Bilancio stimato: −550 kcal" |
| Dispendio = riposo + NEAT + allenamento | §5 bis punto 2, 3 componenti |
| Trend peso media mobile 7 gg | §5 bis punto 5 |
| `initial_estimate` → `current_target` | §4.1 bis, nomi di campo reali |

Il target corretto 2.610 è l'unico numero derivato: è 2.750 meno una correzione
plausibile dal ciclo. Marcato in film come esito del ciclo, mai come dato di prodotto.

## Battute

| t | Scena | Cosa accade | Suono |
|---|---|---|---|
| 0.0 | hook | Frame 0 **già pieno**: la formula in mono, grande. Mai nero, mai logo. | — |
| 1.2 | hook | `2.750` atterra, Oswald 300px, `expo.out` 0.5 s | impact-bass-1 |
| 3.2 | hook | "Il tuo fabbisogno, calcolato in un secondo." | — |
| 5.7 | verdict | Banda d'errore si apre attorno al numero: 2.480 ⟷ 3.020 | glitch-2 |
| 7.0 | verdict | "Ogni equazione predittiva ha un errore individuale." | — |
| 9.0 | verdict | "Anche questa." in volt | ping |
| 11.2 | loop | ADAPTIVE NUTRITION ENGINE — 3 righe, 0.6 s di stagger | whoosh-short |
| 15.5 | loop | Le tre convergono verso il basso: "ricalibra" | riser |
| 19.5 | correction | `2.750 → 2.610`, number wheel, volt | — |
| 21.0 | correction | label `initial_estimate` → `current_target` | chime |
| 22.0 | correction | "Il target non è una stima. È una conseguenza." | — |
| 24.2 | endcard | Le due ali entrano da sinistra, smear, spring 0.8 | impact-bass-2 |
| 25.0 | endcard | Wordmark FITLAB, wipe | — |

## Transizioni — 4 tipi, ognuna causata

1. hook→verdict — **carry across**: il numero resta, è il mondo a cambiargli attorno.
2. verdict→loop — **object becomes the world**: la banda d'errore si allarga oltre il frame.
3. loop→correction — **whip verticale** 0.2 s: la convergenza del ciclo spinge in basso.
4. correction→endcard — **colour flood**: il volt invade il fondo 0.4 s `power2.inOut`,
   e da quel volt si staccano le due ali.

## Vincoli di craft

- Titolo atterrato = fermo. Nessun respiro, nessuna scala lenta.
- Uscite 40–50% più corte delle entrate.
- Overlap: l'elemento successivo parte quando il precedente è al 30–50%.
- Nessun elemento entra due volte nello stesso modo.

## Non incluso e perché

- **Nessuna foto** di sport o nutrizione: `api.heygen.com` è bloccato dal proxy e
  non esiste altra fonte di immagini reali in questa sessione. Inventarle
  violerebbe "mai un mockup". Si innestano quando HeyGen è raggiungibile.
- **Nessuna musica**: stessa ragione (bgm passa da HeyGen). Solo SFX bundled.
- **Nessuna UI di prodotto**: non ho screenshot reali dell'app. Il film resta su
  dati e tipografia, non finge schermate.
