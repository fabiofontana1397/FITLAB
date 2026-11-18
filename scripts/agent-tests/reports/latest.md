# Test dei piani generati dai questionari

Generato il 2026-11-18 11:11 — 22 questionari finti, piani creati con i generatori reali dell’app.

**Totale:** 0 errori · 9 avvisi · 37 note

| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |
|---|---|---|---|---|---|---|
| Sofia, 16 anni | 1696 | 88/208/57 | 4 | 2/0 | 0 | 0 |
| Matteo, 17 anni | 2598 | 118/336/87 | 5 | 3/0 | 0 | 0 |
| Giulia, 24 anni | 1500 | 112/150/50 | 4 | 3/0 | 0 | 6 |
| Luca, 22 anni | 2730 | 129/349/91 | 9 | 5/0 | 0 | 0 |
| Alessandro, 29 anni | 3379 | 128/462/113 | 4 | 4/2 | 0 | 0 |
| Marco, 32 anni | 1904 | 142/190/64 | 6 | 3/0 | 0 | 0 |
| Chiara, 25 anni | 1591 | 119/159/53 | 3 | 2/2 | 0 | 1 |
| Paolo, 38 anni | 2552 | 108/339/85 | 4 | 0/4 | 0 | 0 |
| Andrea, 40 anni | 1702 | 127/170/57 | 3 | –/– | 0 | 0 |
| Ilaria, 29 anni | 2141 | 122/253/71 | 5 | 4/0 | 0 | 0 |
| Anna, 52 anni | 1246 | 93/108/49 | 5 | 2/0 | 0 | 0 |
| Roberto, 58 anni | 2388 | 115/302/80 | 4 | 2/0 | 0 | 0 |
| Franco, 60 anni | 1894 | 109/223/63 | 4 | 1/0 | 0 | 1 |
| Tommaso, 35 anni | 2187 | 128/255/73 | 4 | 1/0 | 0 | 0 |
| Nina, 33 anni | 1579 | 118/158/53 | 4 | 3/0 | 0 | 0 |
| Omar, 41 anni | 1734 | 130/171/59 | 5 | –/– | 0 | 0 |
| Elena, 27 anni | 1427 | 107/142/48 | 3 | 3/0 | 0 | 1 |
| Davide, 45 anni | 1814 | 136/182/60 | 4 | 3/0 | 0 | 0 |
| Paola, 36 anni | 1807 | 106/211/60 | 4 | 3/0 | 0 | 0 |
| Marta, 30 anni | 1678 | 93/200/56 | 4 | 3/0 | 0 | 0 |
| Luigi, 55 anni | 1832 | 137/182/62 | 4 | 3/0 | 0 | 0 |
| Sara, 26 anni | 1769 | 96/213/59 | 4 | 3/0 | 0 | 0 |

## Simulazione: ricalibrazione mensile su 6 mesi

Un corpo virtuale segue il piano; a fine mese l’agente di ricalibrazione vede le pesate (con rumore) e l’aderenza e rielabora dieta e allenamento. Si verifica che il peso vada verso l’obiettivo anche se il metabolismo reale si discosta dal modello del ±10%, e che con bassa aderenza non si corregga sui numeri.

### Sofia, 16 anni — studentessa, vuole tonificarsi

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 55 → 55.2 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 55 → 57.7 kg | 0.16 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 55 → 52.5 kg | -0.14 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 55 → 60.6 kg | 0.33 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Matteo, 17 anni — magro, vuole mettere massa

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 62 → 67.5 kg | 0.26 kg/sett. | on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 62 → 70.8 kg | 0.41 kg/sett. | too_fast › on_track › on_track › on_track › on_track | -100, -100, -100, -100, -100 |
| Metabolismo più veloce del 10% | 62 → 66.7 kg | 0.22 kg/sett. | plateau › too_slow › on_track › on_track › on_track | 150, 250, 250, 250, 250 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 78.6 kg | 0.78 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0 |

### Giulia, 24 anni — vuole dimagrire qualche kg

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 62 → 56.6 kg | -0.32 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 62 → 58.2 kg | -0.22 kg/sett. | too_slow › on_track › on_track › on_track | -100, -100, -100, -100 |
| Metabolismo più veloce del 10% | 62 → 54.6 kg | -0.43 kg/sett. | on_track › too_fast › on_track › on_track | 0, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 61.6 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Luca, 22 anni — massa muscolare, esperto

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 68 → 73 kg | 0.19 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 68 → 74.6 kg | 0.26 kg/sett. | too_fast › too_fast › too_fast › on_track › on_track › too_slow | -100, -200, -300, -300, -300, -200 |
| Metabolismo più veloce del 10% | 68 → 71 kg | 0.12 kg/sett. | wrong_direction › on_track › on_track › too_slow › on_track › on_track | 150, 150, 150, 250, 250, 250 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 68 → 88 kg | 0.78 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0, 0 |

### Alessandro, 29 anni — molto attivo, anni di esperienza

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 80 → 80.2 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 80 → 84.1 kg | 0.24 kg/sett. | too_fast › on_track › too_fast › on_track | -100, -100, -200, -200 |
| Metabolismo più veloce del 10% | 80 → 76.7 kg | -0.20 kg/sett. | too_slow › on_track › on_track › on_track | 100, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 80 → 93.6 kg | 0.79 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Marco, 32 anni — dimagrimento, sedentario

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 92 → 82 kg | -0.39 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 92 → 84 kg | -0.31 kg/sett. | too_slow › on_track › too_slow › on_track › on_track › on_track | -100, -100, -200, -200, -200, -200 |
| Metabolismo più veloce del 10% | 92 → 76.7 kg | -0.59 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 92 → 91.2 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0, 0 |

### Chiara, 25 anni — palestra + corsa con 4 giorni disponibili

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 60 → 55.8 kg | -0.33 kg/sett. | on_track › on_track › on_track | 0, 0, 0 |
| Metabolismo più lento del 10% | 60 → 56.8 kg | -0.25 kg/sett. | too_slow › too_slow › on_track | -100, -200, -200 |
| Metabolismo più veloce del 10% | 60 → 53.6 kg | -0.50 kg/sett. | on_track › on_track › on_track | 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 60 → 60.1 kg | 0.00 kg/sett. | low_adherence › low_adherence › low_adherence | 0, 0, 0 |

### Paolo, 38 anni — solo corsa, resistenza

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 72 → 72.7 kg | 0.04 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 72 → 75.8 kg | 0.22 kg/sett. | on_track › on_track › too_fast › on_track | 0, 0, -100, -100 |
| Metabolismo più veloce del 10% | 72 → 68.5 kg | -0.20 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 72 → 82.4 kg | 0.61 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Andrea, 40 anni — solo dieta

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 80 → 75.2 kg | -0.37 kg/sett. | on_track › on_track › on_track | 0, 0, 0 |
| Metabolismo più lento del 10% | 80 → 77 kg | -0.23 kg/sett. | on_track › too_slow › on_track | 0, -100, -100 |
| Metabolismo più veloce del 10% | 80 → 73.4 kg | -0.51 kg/sett. | too_fast › on_track › on_track | 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 80 → 79 kg | -0.07 kg/sett. | low_adherence › low_adherence › low_adherence | 0, 0, 0 |

### Anna, 52 anni — dimagrimento, sedentaria, fastidio al ginocchio

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 70 → 64.3 kg | -0.26 kg/sett. | on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 70 → 66.8 kg | -0.15 kg/sett. | too_slow › plateau › on_track › too_slow › too_slow | -46, -46, -46, -46, -46 |
| Metabolismo più veloce del 10% | 70 → 62.3 kg | -0.36 kg/sett. | on_track › on_track › too_fast › on_track › on_track | 0, 0, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 70 → 69.5 kg | -0.02 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0 |

### Roberto, 58 anni — salute generale, lavoro in piedi

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 82 → 82.1 kg | 0.00 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 82 → 85.4 kg | 0.20 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 82 → 78.6 kg | -0.20 kg/sett. | on_track › on_track › too_slow › on_track | 0, 0, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 82 → 90 kg | 0.47 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Franco, 60 anni — pensionato, un solo giorno

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 78 → 78 kg | 0.00 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 78 → 81.1 kg | 0.18 kg/sett. | on_track › on_track › on_track › too_fast | 0, 0, 0, -100 |
| Metabolismo più veloce del 10% | 78 → 75.4 kg | -0.15 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 78 → 84.1 kg | 0.35 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Tommaso, 35 anni — si allena una volta ogni due settimane

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 80 → 80.2 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 80 → 83.4 kg | 0.20 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 80 → 76.7 kg | -0.19 kg/sett. | on_track › on_track › on_track › too_slow | 0, 0, 0, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 80 → 87.1 kg | 0.42 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Nina, 33 anni — dimagrimento senza peso obiettivo

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 70 → 64.3 kg | -0.33 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 70 → 66.1 kg | -0.23 kg/sett. | too_slow › on_track › on_track › on_track | -100, -100, -100, -100 |
| Metabolismo più veloce del 10% | 70 → 62.6 kg | -0.43 kg/sett. | too_fast › on_track › on_track › on_track | 100, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 70 → 69.6 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Omar, 41 anni — ora solo dieta, ma rimaste vecchie risposte di allenamento

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 85 → 77.1 kg | -0.37 kg/sett. | on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 85 → 79.6 kg | -0.25 kg/sett. | on_track › too_slow › on_track › on_track › on_track | 0, -100, -100, -100, -100 |
| Metabolismo più veloce del 10% | 85 → 74.3 kg | -0.50 kg/sett. | too_fast › on_track › on_track › on_track › on_track | 100, 100, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 85 → 83.3 kg | -0.08 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0 |

### Elena, 27 anni — intollerante al lattosio, 5 pasti

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 62 → 58.2 kg | -0.30 kg/sett. | on_track › on_track › on_track | 0, 0, 0 |
| Metabolismo più lento del 10% | 62 → 59.3 kg | -0.21 kg/sett. | too_slow › on_track › on_track | -100, -100, -100 |
| Metabolismo più veloce del 10% | 62 → 56.1 kg | -0.45 kg/sett. | on_track › on_track › too_fast | 0, 0, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 62 kg | 0.00 kg/sett. | low_adherence › low_adherence › low_adherence | 0, 0, 0 |

### Davide, 45 anni — niente uova né pesce

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 84 → 77.7 kg | -0.37 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 84 → 79.8 kg | -0.24 kg/sett. | on_track › too_slow › on_track › on_track | 0, -100, -100, -100 |
| Metabolismo più veloce del 10% | 84 → 75.1 kg | -0.52 kg/sett. | too_fast › on_track › on_track › on_track | 100, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 84 → 84 kg | -0.00 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Paola, 36 anni — mangia sempre bresaola e avocado a merenda

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 66 → 66 kg | 0.00 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 66 → 68.9 kg | 0.17 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 66 → 63.5 kg | -0.15 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 66 → 72.6 kg | 0.38 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Marta, 30 anni — pranza fuori casa quasi ogni giorno

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 58 → 58.1 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 58 → 60.8 kg | 0.16 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 58 → 55.7 kg | -0.14 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 58 → 63.8 kg | 0.34 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Luigi, 55 anni — pescetariano, vuole perdere pancia

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 88 → 81.3 kg | -0.39 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 88 → 82.9 kg | -0.30 kg/sett. | too_slow › too_slow › on_track › on_track | -100, -200, -200, -200 |
| Metabolismo più veloce del 10% | 88 → 78.5 kg | -0.55 kg/sett. | on_track › on_track › too_fast › on_track | 0, 0, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 88 → 87.6 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Sara, 26 anni — sceglie i suoi alimenti preferiti

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 60 → 60.4 kg | 0.02 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 60 → 62.7 kg | 0.15 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 60 → 57.3 kg | -0.16 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 60 → 66.5 kg | 0.38 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

---

## Sofia, 16 anni — studentessa, vuole tonificarsi

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Ragazza di 16 anni, 55 kg per 165 cm, vita da studente (sedentaria), mai fatto palestra. 2 allenamenti a settimana.
- **Cosa ci aspettiamo:** Sotto i 18 anni nessun deficit: calorie di mantenimento, proteine moderate, scheda principiante con 2 sedute full body.

| Dati | Valore |
|---|---|
| Profilo | female · 16 anni · 165 cm · 55 kg → 55 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1340 / 1696 kcal |
| Target calorico | **1696 kcal** (0% sul fabbisogno) |
| Macro | P 88 g (1.6 g/kg) · C 208 g · G 57 g |
| Idratazione | 1925 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1696 kcal → 2·1702 kcal → 3·1703 kcal → 4·1698 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 110g, Muesli 70g a secco, Kiwi 2 kiwi, Mandorle 20g | 520 |
| Pranzo 13:00 | Petto di pollo 105g a crudo, Riso 110g a secco, Zucchine 150g, Olio extravergine di oliva 20g | 700 |
| Cena 20:00 | Salmone 100g a crudo, Patate dolci 400g a crudo, Spinaci 150g, Olio extravergine di oliva 5g | 661 |

Totale Lun: **1880 kcal** · P 88 g · C 236 g · G 58 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 175g, Gallette di riso 3 gallette, Banana 1 banana, Burro di mandorle 100% 10g | 458 |
| Pranzo 13:00 | Petto di pollo 100g a crudo, Pasta integrale 100g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 639 |
| Cena 20:00 | _pasto libero_ | 573 |

Totale Sab: **1095 kcal** · P 61 g · C 126 g · G 35 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 4×8-12 @15kg; Chest press alla macchina 2×8-12 @5kg; Rematore con petto appoggiato 2×10-12 @2kg; Stacco rumeno con manubri 2×10-12 @4kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-12 @2.5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con manubri 2×8-12 @4kg; Lat machine 3×8-12 @5kg; Chest press alla macchina 2×10-12 @5kg; Ponte glutei 2×10-12; Face pull al cavo 3×12-20 @2.5kg; Calf raise alla macchina 2×12-15 @10kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 4×8-12 @15kg; Chest press alla macchina 2×8-12 @5kg; Rematore con petto appoggiato 2×10-12 @2kg; Stacco rumeno con manubri 2×10-12 @4kg; Alzate laterali al cavo 4×12-20 @2.5kg; Crunch al cavo 2×10-12 @2.5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con manubri 2×8-12 @4kg; Lat machine 4×8-12 @5kg; Chest press alla macchina 2×10-12 @5kg; Ponte glutei 2×10-12; Croci inverse alla macchina 3×12-20 @5kg; Calf raise alla macchina 2×12-15 @10kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Matteo, 17 anni — magro, vuole mettere massa

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Ragazzo di 17 anni, 62 kg per 176 cm, vuole arrivare a 67 kg. Principiante, 3 allenamenti a settimana.
- **Cosa ci aspettiamo:** Surplus lieve e sostenuto, proteine ~1,9 g/kg, split full body per principianti, mese di adattamento.

| Dati | Valore |
|---|---|
| Profilo | male · 17 anni · 176 cm · 62 kg → 67 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1640 / 2320 kcal |
| Target calorico | **2598 kcal** (12% sul fabbisogno) |
| Macro | P 118 g (1.9 g/kg) · C 336 g · G 87 g |
| Idratazione | 2170 ml |
| Durata piano | 5 mesi |

**Piano alimentare** — mesi: 1·2598 kcal → 2·2610 kcal → 3·2610 kcal → 4·2612 kcal → 5·2610 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 165g, Muesli 115g a secco, Kiwi 2 kiwi, Mandorle 25g | 771 |
| Pranzo 13:00 | Tonno al naturale 125g, Riso 175g a secco, Pomodori 100g, Olio extravergine di oliva 30g | 1042 |
| Cena 20:00 | Trota 130g a crudo, Riso basmati 160g a secco, Asparagi 150g, Olio extravergine di oliva 20g | 946 |

Totale Lun: **2757 kcal** · P 120 g · C 366 g · G 85 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 215g, Gallette di riso 4 gallette, Banana 2 banane, Burro di mandorle 100% 20g | 708 |
| Pranzo 13:00 | Tonno al naturale 100g, Pasta 160g a secco, Pomodori 100g, Olio extravergine di oliva 30g | 970 |
| Cena 20:00 | _pasto libero_ | 872 |

Totale Sab: **1678 kcal** · P 77 g · C 207 g · G 57 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 4×8-12 @20kg; Chest press alla macchina 3×8-12 @10kg; Rematore con petto appoggiato 2×8-12 @4kg; Stacco rumeno con manubri 3×8-12 @8kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×8-12 @8kg; Lat machine 3×8-12 @15kg; Trazioni alla sbarra 2×8-12; Chest press alla macchina 2×8-12 @10kg; Calf raise alla macchina 2×10-15 @15kg; Face pull al cavo 2×12-20 @2.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 4×8-12 @20kg; Rematore con petto appoggiato 3×8-12 @4kg; Chest press alla macchina 2×8-12 @10kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 4×6-10 @25kg; Chest press alla macchina 3×6-10 @10kg; Rematore con petto appoggiato 2×8-12 @4kg; Stacco rumeno con manubri 3×8-12 @8kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×6-10 @8kg; Lat machine 5×6-10 @15kg; Chest press alla macchina 3×8-12 @10kg; Ponte glutei 2×8-12; Croci inverse alla macchina 3×12-20 @5kg; Calf raise alla macchina 2×10-15 @15kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 4×6-10 @25kg; Rematore con petto appoggiato 3×6-10 @4kg; Chest press alla macchina 3×8-12 @10kg; Ponte glutei 2×8-12; Alzate laterali al cavo 3×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Giulia, 24 anni — vuole dimagrire qualche kg

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 6 avvisi, 1 note)

- **Chi è:** Studentessa universitaria, 62 kg per 166 cm, vuole scendere a 57 kg. Poco attiva, principiante, 3 allenamenti.
- **Cosa ci aspettiamo:** Deficit moderato, proteine alte, durata ~5-6 mesi, scheda full body principiante.

| Dati | Valore |
|---|---|
| Profilo | female · 24 anni · 166 cm · 62 kg → 57 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1377 / 1875 kcal |
| Target calorico | **1500 kcal** (-20% sul fabbisogno) |
| Macro | P 112 g (1.8 g/kg) · C 150 g · G 50 g |
| Idratazione | 2170 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1500 kcal → 2·1504 kcal → 3·1507 kcal → 4·1506 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 205g, Fiocchi d'avena 40g a secco, Frutti di bosco 125g, Latte vaccino 170 ml | 460 |
| Pranzo 13:00 | Fiocchi di latte 265g, Farro 85g a secco, Pomodori 100g, Olio extravergine di oliva 5g | 632 |
| Cena 20:00 | Uova intere 3 uova, Pasta 85g a secco, Zucchine 150g, Olio extravergine di oliva 5g | 578 |

Totale Lun: **1669 kcal** · P 104 g · C 184 g · G 53 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Fiocchi di latte 260g, Pane di segale 40g, Marmellata light 20g | 386 |
| Pranzo 13:00 | Uova intere 3 uova, Pane integrale 110g, Spinaci 150g, Olio extravergine di oliva 5g | 564 |
| Cena 20:00 | _pasto libero_ | 492 |

Totale Sab: **949 kcal** · P 65 g · C 87 g · G 35 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 3×8-12 @20kg; Chest press alla macchina 3×8-12 @5kg; Rematore con petto appoggiato 2×8-12 @2kg; Stacco rumeno con manubri 2×8-12 @6kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×8-12 @6kg; Lat machine 4×8-12 @10kg; Chest press alla macchina 2×8-12 @5kg; Face pull al cavo 2×12-20 @2.5kg; Calf raise alla macchina 3×10-15 @10kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 3×8-12 @20kg; Rematore con petto appoggiato 3×8-12 @2kg; Chest press alla macchina 2×8-12 @5kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 3×6-10 @20kg; Chest press alla macchina 3×6-10 @10kg; Rematore con petto appoggiato 2×8-12 @2kg; Stacco rumeno con manubri 2×8-12 @6kg; Alzate laterali al cavo 3×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×6-10 @6kg; Lat machine 4×6-10 @10kg; Chest press alla macchina 2×8-12 @5kg; Ponte glutei 2×8-12; Croci inverse alla macchina 3×12-20 @5kg; Calf raise alla macchina 2×10-15 @10kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 3×6-10 @20kg; Rematore con petto appoggiato 3×6-10 @4kg; Chest press alla macchina 2×8-12 @5kg; Ponte glutei 2×8-12; Alzate laterali al cavo 3×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `D5` Proteine: i pasti danno in media il 93% del target (giorno peggiore: 14% di scarto)
- ⚠️ `Q6` Mar (mese 1): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Gio (mese 1): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Gio (mese 2): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Ven (mese 3): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Ven (mese 4): stessa fonte proteica a pranzo e cena (cheese)
- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Luca, 22 anni — massa muscolare, esperto

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 4 note)

- **Chi è:** Studente magro (68 kg per 180 cm), vuole arrivare a 75 kg. Esperto, 5 allenamenti a settimana da 60-90 min, 5 pasti.
- **Cosa ci aspettiamo:** Surplus controllato, proteine ~1,9 g/kg, split a 5 giorni senza mese di adattamento, progressione di carichi mese dopo mese.

| Dati | Valore |
|---|---|
| Profilo | male · 22 anni · 180 cm · 68 kg → 75 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1700 / 2528 kcal |
| Target calorico | **2730 kcal** (8% sul fabbisogno) |
| Macro | P 129 g (1.9 g/kg) · C 349 g · G 91 g |
| Idratazione | 2730 ml |
| Durata piano | 9 mesi |

**Piano alimentare** — mesi: 1·2730 kcal → 2·2740 kcal → 3·2743 kcal → 4·2730 kcal → 5·2740 kcal → 6·2743 kcal → 7·2730 kcal → 8·2740 kcal → 9·2721 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 120g, Muesli 95g a secco, Kiwi 2 kiwi, Mandorle 25g | 648 |
| Spuntino mattina 10:30 | Yogurt greco 2% 125g, Mela 2 mele, Noci 10g | 316 |
| Pranzo 13:00 | Manzo magro 135g a crudo, Riso 140g a secco, Peperoni 150g, Olio extravergine di oliva 20g | 874 |
| Spuntino pomeriggio 17:00 | Uova intere 1 uovo, Pane integrale 90g | 293 |
| Cena 20:00 | Salmone 100g a crudo, Gnocchi di patate 325g, Spinaci 150g, Olio extravergine di oliva 10g | 814 |

Totale Lun: **2944 kcal** · P 131 g · C 385 g · G 88 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 100g, Fiocchi d'avena 105g a secco, Frutti di bosco 50g, Latte vaccino 230 ml | 635 |
| Spuntino mattina 10:30 | Mozzarella light 60g, Pane integrale 80g, Pomodori 40g | 311 |
| Pranzo 13:00 | Lonza di maiale magra 135g a crudo, Riso 135g a secco, Peperoni 150g, Olio extravergine di oliva 20g | 857 |
| Spuntino pomeriggio 17:00 | Yogurt greco 2% 120g, Mela 2 mele, Noci 10g | 312 |
| Cena 20:00 | _pasto libero_ | 782 |

Totale Sab: **2113 kcal** · P 103 g · C 271 g · G 62 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 4×6-10 @20kg; Croci con manubri 3×10-15 @7kg; Rematore con manubrio 4×6-10 @20kg; Lat machine 4×8-12 @40kg; Alzate laterali al cavo 4×12-20 @2.5kg; Estensioni sopra la testa al cavo 3×10-15 @15kg; Curl su panca inclinata 2×10-15 @6kg |
| Mar | Lower A | Back squat 4×6-10 @67.5kg; Leg extension 3×10-15 @30kg; Stacco rumeno con bilanciere 3×8-12 @55kg; Leg curl 3×10-15 @25kg; Hip thrust 2×8-12 @72.5kg; Calf raise alla macchina 4×10-15 @45kg; Crunch al cavo 3×10-15 @20kg |
| Mer | Riposo | |
| Gio | Push | Panca piana con manubri 4×6-10 @20kg; Croci con manubri 4×10-15 @7kg; Alzate laterali al cavo 4×12-20 @2.5kg; Alzate laterali con manubri 3×12-20 @4kg; Estensioni sopra la testa al cavo 4×10-15 @15kg |
| Ven | Pull | Lat machine 3×6-10 @45kg; Trazioni alla sbarra 3×8-12; Rematore con manubrio 2×8-12 @20kg; Face pull al cavo 3×12-20 @12.5kg; Alzate posteriori con manubri 4×12-20 @3kg |
| Sab | Legs | Back squat 4×6-10 @67.5kg; Leg extension 3×10-15 @30kg; Stacco rumeno con bilanciere 3×8-12 @55kg; Leg curl 3×10-15 @25kg; Hip thrust 2×8-12 @72.5kg; Calf raise alla macchina 4×10-15 @45kg; Crunch al cavo 3×10-15 @20kg |
| Dom | Riposo | |

**Mese 9 — Mese 9 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 4×6-10 @20kg; Croci con manubri 3×10-15 @7kg; Rematore con manubrio 3×6-10 @20kg; Lat machine 3×8-12 @40kg; Alzate laterali al cavo 3×12-20 @2.5kg; Alzate laterali con manubri 3×12-20 @4kg; Estensioni sopra la testa al cavo 3×10-15 @15kg |
| Mar | Lower A | Back squat 4×6-10 @65kg; Leg extension 3×10-15 @30kg; Stacco rumeno con bilanciere 4×8-12 @55kg; Hip thrust 2×8-12 @70kg; Calf raise alla macchina 4×10-15 @45kg; Crunch al cavo 3×10-15 @20kg |
| Mer | Riposo | |
| Gio | Push | Panca piana con manubri 4×6-10 @20kg; Croci con manubri 4×10-15 @7kg; Alzate laterali al cavo 3×12-20 @2.5kg; Alzate laterali con manubri 3×12-20 @4kg; Estensioni sopra la testa al cavo 3×10-15 @15kg |
| Ven | Pull | Lat machine 3×6-10 @45kg; Trazioni alla sbarra 3×8-12; Rematore con manubrio 2×8-12 @20kg; Alzate posteriori con manubri 3×12-20 @3kg; Croci inverse alla macchina 4×12-20 @10kg; Curl su panca inclinata 2×10-15 @6kg |
| Sab | Legs | Back squat 4×6-10 @65kg; Leg extension 3×10-15 @30kg; Stacco rumeno con bilanciere 4×8-12 @55kg; Hip thrust 2×8-12 @70kg; Calf raise alla macchina 4×10-15 @45kg; Crunch al cavo 3×10-15 @20kg |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `Q6` Sab (mese 3): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Mar (mese 6): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Ven (mese 6): una fonte proteica compare tre volte nel giorno

---

## Alessandro, 29 anni — molto attivo, anni di esperienza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Idraulico (lavoro fisico), 80 kg per 182 cm, 12.000+ passi al giorno. Palestra 4 volte + corsa 2 volte, esperto, vuole restare in forma.
- **Cosa ci aspettiamo:** Fabbisogno alto (lavoro fisico + 6 sedute), calorie di mantenimento, alternanza sensata palestra/corsa su 6 giorni con almeno un riposo.

| Dati | Valore |
|---|---|
| Profilo | male · 29 anni · 182 cm · 80 kg → 80 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1798 / 3379 kcal |
| Target calorico | **3379 kcal** (0% sul fabbisogno) |
| Macro | P 128 g (1.6 g/kg) · C 462 g · G 113 g |
| Idratazione | 3150 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·3379 kcal → 2·3404 kcal → 3·3394 kcal → 4·3361 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Kefir 300g, Fiocchi d'avena 160g a secco, Mela 1 mela, Noci 20g | 955 |
| Pranzo 13:00 | Hamburger di pollo magro 160g, Riso integrale 225g a secco, Lattuga 60g, Olio extravergine di oliva 30g | 1304 |
| Cena 20:00 | Trota 125g a crudo, Riso basmati 210g a secco, Asparagi 150g, Olio extravergine di oliva 30g | 1206 |

Totale Lun: **3464 kcal** · P 130 g · C 467 g · G 112 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 210g, Gallette di riso 9 gallette, Banana 2 banane, Burro di mandorle 100% 30g | 941 |
| Pranzo 13:00 | Tonno al naturale 90g, Pasta 225g a secco, Pomodori 100g, Olio extravergine di oliva 30g | 1190 |
| Cena 20:00 | _pasto libero_ | 1196 |

Totale Sab: **2131 kcal** · P 87 g · C 292 g · G 64 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con bilanciere 3×3-5 @72.5kg; Pectoral machine 4×8-12 @30kg; Rematore con bilanciere 4×5-8 @52.5kg; Lat machine 4×5-8 @55kg; Alzate laterali al cavo 3×12-20 @2.5kg; Estensioni sopra la testa al cavo 2×8-12 @17.5kg |
| Mar | Corsa | Lungo lento 45 min |
| Mer | Lower A | Back squat 3×3-5 @90kg; Leg extension 4×8-12 @40kg; Stacco rumeno con bilanciere 4×5-8 @72.5kg; Hip thrust 2×5-8 @92.5kg; Calf raise alla macchina 2×8-12 @60kg; Crunch al cavo 2×8-12 @27.5kg |
| Gio | Riposo | |
| Ven | Upper B | Panca piana con bilanciere 3×3-5 @72.5kg; Pectoral machine 4×8-12 @30kg; Lat machine 3×5-8 @55kg; Trazioni alla sbarra 3×5-8; Rematore con bilanciere 2×5-8 @52.5kg; Face pull al cavo 3×12-20 @15kg; Alzate laterali al cavo 3×12-20 @2.5kg |
| Sab | Lower B | Stacco rumeno con bilanciere 5×3-5 @80kg; Hip thrust 3×5-8 @92.5kg; Affondi con manubri 3×5-8 @14kg; Leg extension 4×8-12 @40kg; Calf raise alla macchina 2×8-12 @60kg; Crunch al cavo 2×8-12 @27.5kg |
| Dom | Corsa | Corsa facile 30 min |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con bilanciere 3×3-5 @70kg; Croci con manubri 3×8-12 @9kg; Military press 2×5-8 @40kg; Rematore con bilanciere 4×5-8 @52.5kg; Lat machine 3×5-8 @55kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Corsa | Lungo lento 45 min |
| Mer | Lower A | Back squat 3×3-5 @87.5kg; Leg extension 3×8-12 @40kg; Stacco rumeno con bilanciere 4×5-8 @70kg; Hip thrust 2×5-8 @90kg; Calf raise alla macchina 2×8-12 @60kg; Pallof press 2×8-12 @7.5kg |
| Gio | Riposo | |
| Ven | Upper B | Panca piana con bilanciere 3×3-5 @70kg; Croci con manubri 3×8-12 @9kg; Lat machine 4×5-8 @55kg; Rematore con bilanciere 3×5-8 @52.5kg; Croci inverse alla macchina 2×12-20 @15kg; Alzate laterali al cavo 3×12-20 @2.5kg |
| Sab | Lower B | Stacco rumeno con bilanciere 5×3-5 @77.5kg; Hip thrust 2×5-8 @90kg; Affondi con manubri 3×5-8 @14kg; Leg extension 3×8-12 @40kg; Calf raise alla macchina 2×8-12 @60kg; Pallof press 2×8-12 @7.5kg |
| Dom | Corsa | Corsa facile 30 min |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `S2` 2 sedute di corsa a settimana (es. "Lungo lento 45 min")

---

## Marco, 32 anni — dimagrimento, sedentario

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Impiegato sedentario, 92 kg per 178 cm, vuole scendere a 82 kg. Mai fatto palestra, 3 giorni a settimana, 45-60 min.
- **Cosa ci aspettiamo:** Deficit moderato (non estremo), proteine alte ma non esagerate, durata di circa 6-9 mesi, scheda full body principiante.

| Dati | Valore |
|---|---|
| Profilo | male · 32 anni · 178 cm · 92 kg → 82 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1878 / 2380 kcal |
| Target calorico | **1904 kcal** (-20% sul fabbisogno) |
| Macro | P 142 g (1.5 g/kg) · C 190 g · G 64 g |
| Idratazione | 3220 ml |
| Durata piano | 6 mesi |

**Piano alimentare** — mesi: 1·1904 kcal → 2·1910 kcal → 3·1914 kcal → 4·1919 kcal → 5·1919 kcal → 6·1910 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 170g a crudo, Fiocchi d'avena 95g a secco, Latte vaccino 140 ml, Burro di arachidi 100% 10g | 588 |
| Pranzo 13:00 | Petto di pollo 170g a crudo, Pasta 120g a secco, Zucchine 150g, Olio extravergine di oliva 20g | 810 |
| Cena 20:00 | Merluzzo 230g a crudo, Riso basmati 95g a secco, Carote 100g, Olio extravergine di oliva 20g | 732 |

Totale Lun: **2131 kcal** · P 142 g · C 235 g · G 65 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 300g, Fiocchi d'avena 35g a secco, Frutti di bosco 50g, Latte vaccino 180 ml | 481 |
| Pranzo 13:00 | Petto di tacchino 205g a crudo, Riso 70g a secco, Carote 100g, Olio extravergine di oliva 20g | 679 |
| Cena 20:00 | _pasto libero_ | 618 |

Totale Sab: **1159 kcal** · P 92 g · C 107 g · G 38 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 3×8-12 @45kg; Chest press alla macchina 3×8-12 @25kg; Rematore con petto appoggiato 2×8-12 @10kg; Stacco rumeno con manubri 2×8-12 @14kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @12.5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×8-12 @14kg; Lat machine 4×8-12 @25kg; Chest press alla macchina 2×8-12 @25kg; Face pull al cavo 2×12-20 @7.5kg; Calf raise alla macchina 3×10-15 @30kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 3×8-12 @45kg; Rematore con petto appoggiato 3×8-12 @10kg; Chest press alla macchina 2×8-12 @25kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @12.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 6 — Mese 6 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 4×6-10 @45kg; Chest press alla macchina 3×6-10 @25kg; Rematore con petto appoggiato 2×8-12 @10kg; Stacco rumeno con manubri 3×8-12 @14kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×6-10 @14kg; Lat machine 3×6-10 @25kg; Trazioni alla sbarra 2×8-12; Chest press alla macchina 2×8-12 @25kg; Calf raise alla macchina 2×10-15 @30kg; Face pull al cavo 2×12-20 @7.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 4×6-10 @45kg; Rematore con petto appoggiato 3×6-10 @10kg; Chest press alla macchina 2×8-12 @25kg; Alzate laterali al cavo 3×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Chiara, 25 anni — palestra + corsa con 4 giorni disponibili

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 2 note)

- **Chi è:** Donna, 60 kg per 168 cm. Vorrebbe 3 palestra + 3 corsa ma ha solo 4 giorni disponibili. Obiettivo dimagrimento (−4 kg).
- **Cosa ci aspettiamo:** Il piano rispetta i 4 giorni disponibili, bilancia palestra e corsa, e le calorie contano l’allenamento realmente programmato.

| Dati | Valore |
|---|---|
| Profilo | female · 25 anni · 168 cm · 60 kg → 56 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1364 / 1989 kcal |
| Target calorico | **1591 kcal** (-20% sul fabbisogno) |
| Macro | P 119 g (2.0 g/kg) · C 159 g · G 53 g |
| Idratazione | 2450 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·1591 kcal → 2·1600 kcal → 3·1591 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 275g, Muesli 40g a secco, Kiwi 2 kiwi, Mandorle 10g | 478 |
| Pranzo 13:00 | Petto di pollo 145g a crudo, Pasta 95g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 650 |
| Cena 20:00 | Orata 180g a crudo, Riso 80g a secco, Zucchine 150g, Olio extravergine di oliva 10g | 596 |

Totale Lun: **1722 kcal** · P 120 g · C 188 g · G 51 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 205g, Fiocchi d'avena 20g a secco, Banana 1 banana, Semi di chia 20g | 402 |
| Pranzo 13:00 | Manzo magro 195g a crudo, Riso 55g a secco, Peperoni 150g, Olio extravergine di oliva 10g | 558 |
| Cena 20:00 | _pasto libero_ | 507 |

Totale Sab: **959 kcal** · P 76 g · C 96 g · G 27 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 5×6-10 @32.5kg; Panca piana con manubri 3×6-10 @8kg; Rematore con manubrio 2×8-12 @8kg; Stacco rumeno con bilanciere 2×8-12 @27.5kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Mar | Corsa | Corsa facile 30 min |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con bilanciere 3×6-10 @27.5kg; Lat machine 3×6-10 @15kg; Panca inclinata con manubri 2×8-12 @6kg; Hip thrust 2×8-12 @35kg; Alzate posteriori con manubri 2×12-20 @1kg; Calf raise alla macchina 2×10-15 @20kg |
| Ven | Corsa | Corsa facile 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 3 — Mese 3 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 5×6-10 @32.5kg; Panca piana con manubri 3×6-10 @6kg; Rematore con manubrio 2×8-12 @6kg; Stacco rumeno con bilanciere 2×8-12 @27.5kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Mar | Corsa | Corsa facile 30 min |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con bilanciere 3×6-10 @27.5kg; Lat machine 3×6-10 @15kg; Panca inclinata con manubri 2×8-12 @6kg; Hip thrust 2×8-12 @35kg; Alzate posteriori con manubri 2×12-20 @1kg; Calf raise alla macchina 2×10-15 @20kg |
| Ven | Corsa | Corsa facile 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `R14` I mesi "Mese 1 · Accumulo" (1, 2) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `S2` 2 sedute di corsa a settimana (es. "Corsa facile 30 min")

---

## Paolo, 38 anni — solo corsa, resistenza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Runner amatoriale, 72 kg per 176 cm. Corre 4 volte a settimana, nessuna palestra, vuole migliorare la resistenza.
- **Cosa ci aspettiamo:** Nessuna seduta di palestra, 4 uscite di corsa varie (facili, medio, lungo), carboidrati abbondanti, calorie di mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 38 anni · 176 cm · 72 kg → 72 kg · obiettivo `improveEndurance` |
| Metabolismo basale / fabbisogno | 1635 / 2552 kcal |
| Target calorico | **2552 kcal** (0% sul fabbisogno) |
| Macro | P 108 g (1.5 g/kg) · C 339 g · G 85 g |
| Idratazione | 2870 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2552 kcal → 2·2579 kcal → 3·2579 kcal → 4·2552 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 60g a crudo, Fiocchi d'avena 140g a secco, Latte vaccino 150 ml, Burro di arachidi 100% 15g | 741 |
| Pranzo 13:00 | Tonno al naturale 110g, Riso 170g a secco, Pomodori 100g, Olio extravergine di oliva 30g | 1008 |
| Cena 20:00 | Trota 115g a crudo, Riso basmati 155g a secco, Asparagi 150g, Olio extravergine di oliva 20g | 909 |

Totale Lun: **2657 kcal** · P 114 g · C 353 g · G 83 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 175g, Gallette di riso 3 gallette, Banana 2 banane, Burro di mandorle 100% 25g | 666 |
| Pranzo 13:00 | Hamburger di manzo magro 170g, Patate 400g a crudo, Lattuga 60g, Olio extravergine di oliva 20g | 780 |
| Cena 20:00 | _pasto libero_ | 830 |

Totale Sab: **1446 kcal** · P 70 g · C 153 g · G 58 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Corsa | Corsa facile 25 min |
| Mar | Corsa | Corsa facile 25 min |
| Mer | Riposo | |
| Gio | Corsa | Corsa facile 25 min |
| Ven | Corsa | Lungo lento 45 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Corsa | Corsa facile 25 min |
| Mar | Corsa | Corsa facile 25 min |
| Mer | Riposo | |
| Gio | Corsa | Corsa facile 25 min |
| Ven | Corsa | Lungo lento 45 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `S2` 4 sedute di corsa a settimana (es. "Corsa facile 25 min")

---

## Andrea, 40 anni — solo dieta

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 3 note)

- **Chi è:** Uomo, 80 kg per 180 cm, vuole solo un piano alimentare per dimagrire a 75 kg. Non usa la parte allenamento.
- **Cosa ci aspettiamo:** Il piano di allenamento non deve esistere, la dieta deve essere completa e basata su attività quotidiana.

| Dati | Valore |
|---|---|
| Profilo | male · 40 anni · 180 cm · 80 kg → 75 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1730 / 2128 kcal |
| Target calorico | **1702 kcal** (-20% sul fabbisogno) |
| Macro | P 127 g (1.6 g/kg) · C 170 g · G 57 g |
| Idratazione | 2800 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·1702 kcal → 2·1702 kcal → 3·1702 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 250g, Muesli 40g a secco, Kiwi 1 kiwi, Mandorle 25g | 479 |
| Pranzo 13:00 | Petto di pollo 160g a crudo, Pasta integrale 90g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 667 |
| Cena 20:00 | Hamburger di pollo magro 190g, Patate dolci 270g a crudo, Zucchine 150g, Olio extravergine di oliva 10g | 608 |

Totale Lun: **1752 kcal** · P 128 g · C 169 g · G 56 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Gallette di riso 2 gallette, Banana 1 banana | 434 |
| Pranzo 13:00 | Tonno al naturale 160g, Riso 80g a secco, Pomodori 100g, Olio extravergine di oliva 20g | 658 |
| Cena 20:00 | _pasto libero_ | 592 |

Totale Sab: **1091 kcal** · P 76 g · C 114 g · G 36 g

_Nessun piano di allenamento generato._

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1702 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S3` Utente solo dieta: la tab Allenamento deve mostrare che il piano non è stato richiesto

---

## Ilaria, 29 anni — solo allenamento, forza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Donna, 64 kg per 170 cm, vuole solo la scheda per aumentare la forza. 4 giorni, esperta.
- **Cosa ci aspettiamo:** Il piano alimentare non deve esistere, la scheda ha schemi di forza (poche ripetizioni, recuperi lunghi).

| Dati | Valore |
|---|---|
| Profilo | female · 29 anni · 170 cm · 64 kg → 66 kg · obiettivo `gainStrength` |
| Metabolismo basale / fabbisogno | 1397 / 2039 kcal |
| Target calorico | **2141 kcal** (5% sul fabbisogno) |
| Macro | P 122 g (1.9 g/kg) · C 253 g · G 71 g |
| Idratazione | 2590 ml |
| Durata piano | 5 mesi |

_Nessun piano alimentare generato._

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con bilanciere 3×3-5 @30kg; Pectoral machine 4×8-12 @10kg; Rematore con bilanciere 4×5-8 @22.5kg; Lat machine 4×5-8 @25kg; Alzate laterali al cavo 3×12-20 @2.5kg; Estensioni sopra la testa al cavo 2×8-12 @7.5kg |
| Mar | Lower A | Back squat 3×3-5 @50kg; Leg extension 4×8-12 @20kg; Stacco rumeno con bilanciere 4×5-8 @40kg; Hip thrust 2×5-8 @52.5kg; Calf raise alla macchina 2×8-12 @30kg; Crunch al cavo 2×8-12 @10kg |
| Mer | Riposo | |
| Gio | Upper B | Panca piana con bilanciere 3×3-5 @30kg; Pectoral machine 4×8-12 @10kg; Lat machine 3×5-8 @25kg; Trazioni alla sbarra 3×5-8; Rematore con bilanciere 2×5-8 @22.5kg; Face pull al cavo 3×12-20 @5kg; Alzate laterali al cavo 3×12-20 @2.5kg |
| Ven | Lower B | Stacco rumeno con bilanciere 5×3-5 @42.5kg; Hip thrust 3×5-8 @52.5kg; Affondi con manubri 3×5-8 @8kg; Leg extension 4×8-12 @20kg; Calf raise alla macchina 2×8-12 @30kg; Crunch al cavo 2×8-12 @10kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con bilanciere 3×3-5 @30kg; Croci con manubri 3×8-12 @4kg; Military press 2×5-8 @17.5kg; Rematore con bilanciere 4×5-8 @22.5kg; Lat machine 3×5-8 @20kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Lower A | Back squat 3×3-5 @47.5kg; Leg extension 3×8-12 @20kg; Stacco rumeno con bilanciere 4×5-8 @40kg; Hip thrust 2×5-8 @50kg; Calf raise alla macchina 2×8-12 @30kg; Pallof press 2×8-12 @2.5kg |
| Mer | Riposo | |
| Gio | Upper B | Panca piana con bilanciere 3×3-5 @30kg; Croci con manubri 3×8-12 @4kg; Lat machine 4×5-8 @20kg; Rematore con bilanciere 3×5-8 @22.5kg; Croci inverse alla macchina 2×12-20 @5kg; Alzate laterali al cavo 3×12-20 @2.5kg |
| Ven | Lower B | Stacco rumeno con bilanciere 5×3-5 @42.5kg; Hip thrust 2×5-8 @50kg; Affondi con manubri 3×5-8 @8kg; Leg extension 3×8-12 @20kg; Calf raise alla macchina 2×8-12 @30kg; Pallof press 2×8-12 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `S4` Utente solo allenamento: la tab Nutrizione deve mostrare che il piano non è stato richiesto

---

## Anna, 52 anni — dimagrimento, sedentaria, fastidio al ginocchio

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Donna, 70 kg per 162 cm, vuole scendere a 64 kg. Sedentaria, principiante, 2 allenamenti. Fastidio al ginocchio quando sale le scale.
- **Cosa ci aspettiamo:** Deficit prudente, nessun esercizio che carichi il ginocchio, sedute brevi con pochi esercizi.

| Dati | Valore |
|---|---|
| Profilo | female · 52 anni · 162 cm · 70 kg → 64 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1292 / 1558 kcal |
| Target calorico | **1246 kcal** (-20% sul fabbisogno) |
| Macro | P 93 g (1.3 g/kg) · C 108 g · G 49 g |
| Idratazione | 2450 ml |
| Durata piano | 5 mesi |

**Piano alimentare** — mesi: 1·1246 kcal → 2·1246 kcal → 3·1246 kcal → 4·1246 kcal → 5·1246 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 170g, Muesli 35g a secco, Kiwi 1 kiwi, Mandorle 20g | 385 |
| Pranzo 13:00 | Petto di pollo 130g a crudo, Riso 65g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 524 |
| Cena 20:00 | Merluzzo 130g a crudo, Patate 260g a crudo, Spinaci 150g, Olio extravergine di oliva 15g | 490 |

Totale Lun: **1398 kcal** · P 94 g · C 139 g · G 48 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 180g, Banana 1 banana, Semi di chia 20g | 312 |
| Pranzo 13:00 | Manzo magro 150g a crudo, Patate 205g a crudo, Rucola 40g, Olio extravergine di oliva 10g | 451 |
| Cena 20:00 | _pasto libero_ | 417 |

Totale Sab: **763 kcal** · P 61 g · C 70 g · G 23 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Chest press alla macchina 3×8-12 @5kg; Rematore con petto appoggiato 3×8-12 @2kg; Stacco rumeno con manubri 2×8-12 @6kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con manubri 3×8-12 @6kg; Lat machine 3×8-12 @10kg; Chest press alla macchina 2×8-12 @5kg; Face pull al cavo 2×12-20 @2.5kg; Calf raise alla macchina 2×10-15 @10kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Chest press alla macchina 3×6-10 @10kg; Rematore con petto appoggiato 3×6-10 @4kg; Stacco rumeno con manubri 2×8-12 @6kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con manubri 3×6-10 @6kg; Lat machine 3×6-10 @10kg; Chest press alla macchina 2×8-12 @5kg; Croci inverse alla macchina 2×12-20 @5kg; Calf raise alla macchina 2×10-15 @10kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1246 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Roberto, 58 anni — salute generale, lavoro in piedi

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Uomo, 82 kg per 175 cm, lavoro in piedi tutto il giorno. Vuole stare meglio. Principiante, 2 allenamenti.
- **Cosa ci aspettiamo:** Calorie di mantenimento, scheda semplice con carichi prudenti, 2 sedute.

| Dati | Valore |
|---|---|
| Profilo | male · 58 anni · 175 cm · 82 kg → 80 kg · obiettivo `generalHealth` |
| Metabolismo basale / fabbisogno | 1629 / 2388 kcal |
| Target calorico | **2388 kcal** (0% sul fabbisogno) |
| Macro | P 115 g (1.4 g/kg) · C 302 g · G 80 g |
| Idratazione | 2870 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2388 kcal → 2·2390 kcal → 3·2392 kcal → 4·2390 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 165g, Muesli 110g a secco, Kiwi 2 kiwi, Mandorle 20g | 722 |
| Pranzo 13:00 | Petto di pollo 130g a crudo, Riso basmati 165g a secco, Zucchine 150g, Olio extravergine di oliva 25g | 968 |
| Cena 20:00 | Orata 150g a crudo, Riso 145g a secco, Zucchine 150g, Olio extravergine di oliva 20g | 880 |

Totale Lun: **2568 kcal** · P 116 g · C 341 g · G 77 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 220g, Gallette di riso 6 gallette, Banana 1 banana, Burro di mandorle 100% 15g | 638 |
| Pranzo 13:00 | Hamburger di manzo magro 190g, Patate 400g a crudo, Lattuga 60g, Olio extravergine di oliva 15g | 766 |
| Cena 20:00 | _pasto libero_ | 810 |

Totale Sab: **1404 kcal** · P 77 g · C 151 g · G 52 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 3×8-12 @35kg; Chest press alla macchina 2×8-12 @20kg; Rematore con petto appoggiato 2×10-12 @8kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-12 @10kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con manubri 2×8-12 @10kg; Lat machine 3×8-12 @20kg; Chest press alla macchina 2×10-12 @20kg; Face pull al cavo 2×12-20 @5kg; Calf raise alla macchina 2×12-15 @20kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 4×8-12 @35kg; Chest press alla macchina 2×8-12 @20kg; Rematore con petto appoggiato 2×10-12 @8kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-12 @10kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Full Body B | Stacco rumeno con manubri 2×8-12 @10kg; Lat machine 3×8-12 @20kg; Chest press alla macchina 2×10-12 @20kg; Croci inverse alla macchina 2×12-20 @5kg; Calf raise alla macchina 2×12-15 @20kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Franco, 60 anni — pensionato, un solo giorno

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 2 note)

- **Chi è:** Uomo, 78 kg per 170 cm, pensionato. Può allenarsi 1 volta a settimana, 30 minuti, principiante.
- **Cosa ci aspettiamo:** Una sola seduta a settimana (full body, 3 esercizi), piano non invasivo, calorie di mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 60 anni · 170 cm · 78 kg → 76 kg · obiettivo `generalHealth` |
| Metabolismo basale / fabbisogno | 1548 / 1894 kcal |
| Target calorico | **1894 kcal** (0% sul fabbisogno) |
| Macro | P 109 g (1.4 g/kg) · C 223 g · G 63 g |
| Idratazione | 2730 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1894 kcal → 2·1894 kcal → 3·1894 kcal → 4·1894 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 205g, Muesli 70g a secco, Kiwi 2 kiwi, Mandorle 15g | 571 |
| Pranzo 13:00 | Petto di pollo 140g a crudo, Riso 120g a secco, Zucchine 150g, Olio extravergine di oliva 20g | 772 |
| Cena 20:00 | Merluzzo 160g a crudo, Riso basmati 105g a secco, Carote 100g, Olio extravergine di oliva 20g | 714 |

Totale Lun: **2056 kcal** · P 110 g · C 254 g · G 63 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 230g, Gallette di riso 3 gallette, Banana 1 banana, Burro di mandorle 100% 10g | 513 |
| Pranzo 13:00 | Manzo magro 165g a crudo, Riso 95g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 707 |
| Cena 20:00 | _pasto libero_ | 651 |

Totale Sab: **1219 kcal** · P 72 g · C 137 g · G 41 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 2×8-12 @30kg; Chest press alla macchina 2×8-12 @15kg; Rematore con petto appoggiato 2×10-12 @6kg; Stacco rumeno con manubri 2×10-12 @8kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 2×8-12 @30kg; Chest press alla macchina 2×8-12 @15kg; Rematore con petto appoggiato 2×10-12 @6kg; Stacco rumeno con manubri 2×10-12 @8kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `R14` I mesi "Mese 2 · Accumulo" (2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1894 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Tommaso, 35 anni — si allena una volta ogni due settimane

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Uomo, 80 kg per 178 cm, mantenimento. In palestra va "una volta ogni 2 settimane" e ha 3 giorni disponibili.
- **Cosa ci aspettiamo:** Il piano programma 1 seduta a settimana (dose minima efficace) e il fabbisogno conta esattamente quella seduta.

| Dati | Valore |
|---|---|
| Profilo | male · 35 anni · 178 cm · 80 kg → 80 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1743 / 2187 kcal |
| Target calorico | **2187 kcal** (0% sul fabbisogno) |
| Macro | P 128 g (1.6 g/kg) · C 255 g · G 73 g |
| Idratazione | 2800 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2187 kcal → 2·2187 kcal → 3·2190 kcal → 4·2186 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 190g, Muesli 105g a secco, Kiwi 1 kiwi, Mandorle 25g | 687 |
| Pranzo 13:00 | Tonno al naturale 115g, Pasta 160g a secco, Pomodori 100g, Olio extravergine di oliva 25g | 942 |
| Cena 20:00 | Trota 155g a crudo, Riso basmati 140g a secco, Asparagi 150g, Olio extravergine di oliva 15g | 863 |

Totale Lun: **2490 kcal** · P 129 g · C 315 g · G 74 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Gallette di riso 4 gallette, Banana 1 banana, Burro di mandorle 100% 10g | 568 |
| Pranzo 13:00 | Petto di tacchino 170g a crudo, Patate 400g a crudo, Carote 100g, Olio extravergine di oliva 25g | 774 |
| Cena 20:00 | _pasto libero_ | 746 |

Totale Sab: **1341 kcal** · P 81 g · C 141 g · G 47 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 3×6-10 @62.5kg; Panca piana con manubri 3×6-10 @18kg; Rematore con manubrio 2×8-12 @18kg; Stacco rumeno con bilanciere 2×8-12 @52.5kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @20kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 3×6-10 @62.5kg; Panca piana con manubri 3×6-10 @18kg; Rematore con manubrio 2×8-12 @18kg; Stacco rumeno con bilanciere 2×8-12 @52.5kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Nina, 33 anni — dimagrimento senza peso obiettivo

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Donna, 70 kg per 166 cm, vuole dimagrire ma lascia vuoto il peso obiettivo (domanda facoltativa).
- **Cosa ci aspettiamo:** Nessun peso obiettivo inventato: durata standard del piano e nessun traguardo falso nelle schermate.

| Dati | Valore |
|---|---|
| Profilo | female · 33 anni · 166 cm · 70 kg → undefined kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1412 / 1974 kcal |
| Target calorico | **1579 kcal** (-20% sul fabbisogno) |
| Macro | P 118 g (1.7 g/kg) · C 158 g · G 53 g |
| Idratazione | 2450 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1579 kcal → 2·1584 kcal → 3·1587 kcal → 4·1586 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 215g, Muesli 55g a secco, Kiwi 1 kiwi, Mandorle 20g | 485 |
| Pranzo 13:00 | Petto di pollo 140g a crudo, Pasta 100g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 662 |
| Cena 20:00 | Orata 170g a crudo, Patate 355g a crudo, Fagiolini 150g, Olio extravergine di oliva 10g | 617 |

Totale Lun: **1764 kcal** · P 119 g · C 194 g · G 51 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 255g, Banana 1 banana, Semi di chia 20g | 358 |
| Pranzo 13:00 | Manzo magro 190g a crudo, Patate 285g a crudo, Rucola 40g, Olio extravergine di oliva 10g | 566 |
| Cena 20:00 | _pasto libero_ | 516 |

Totale Sab: **924 kcal** · P 79 g · C 87 g · G 25 g

**Mese 1 — Mese 1 · Adattamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 3×8-12 @20kg; Chest press alla macchina 3×8-12 @10kg; Rematore con petto appoggiato 2×8-12 @4kg; Stacco rumeno con manubri 2×8-12 @6kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×8-12 @6kg; Lat machine 4×8-12 @10kg; Chest press alla macchina 2×8-12 @10kg; Face pull al cavo 2×12-20 @2.5kg; Calf raise alla macchina 3×10-15 @15kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 3×8-12 @20kg; Rematore con petto appoggiato 3×8-12 @4kg; Chest press alla macchina 2×8-12 @10kg; Alzate laterali al cavo 3×12-20 @2.5kg; Crunch al cavo 2×10-15 @5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Hack squat 3×6-10 @25kg; Chest press alla macchina 3×6-10 @10kg; Rematore con petto appoggiato 2×8-12 @4kg; Stacco rumeno con manubri 2×8-12 @6kg; Alzate laterali al cavo 3×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Mar | Riposo | |
| Mer | Full Body B | Stacco rumeno con manubri 3×6-10 @8kg; Lat machine 4×6-10 @10kg; Chest press alla macchina 2×8-12 @10kg; Ponte glutei 2×8-12; Croci inverse alla macchina 3×12-20 @5kg; Calf raise alla macchina 2×10-15 @15kg |
| Gio | Riposo | |
| Ven | Full Body C | Hack squat 3×6-10 @25kg; Rematore con petto appoggiato 3×6-10 @4kg; Chest press alla macchina 2×8-12 @10kg; Ponte glutei 2×8-12; Alzate laterali al cavo 3×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Omar, 41 anni — ora solo dieta, ma rimaste vecchie risposte di allenamento

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 3 note)

- **Chi è:** Uomo, 85 kg per 180 cm. Rifà il questionario scegliendo solo dieta; nelle risposte restano i dati di allenamento di prima (4 allenamenti di palestra).
- **Cosa ci aspettiamo:** Con modalità "solo dieta" le vecchie risposte di allenamento non influenzano né il fabbisogno né la dieta.

| Dati | Valore |
|---|---|
| Profilo | male · 41 anni · 178 cm · 85 kg → 78 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1763 / 2168 kcal |
| Target calorico | **1734 kcal** (-20% sul fabbisogno) |
| Macro | P 130 g (1.5 g/kg) · C 171 g · G 59 g |
| Idratazione | 2975 ml |
| Durata piano | 5 mesi |

**Piano alimentare** — mesi: 1·1734 kcal → 2·1734 kcal → 3·1734 kcal → 4·1734 kcal → 5·1734 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 260g, Muesli 40g a secco, Kiwi 1 kiwi, Mandorle 25g | 484 |
| Pranzo 13:00 | Tonno al naturale 150g, Pasta 85g a secco, Pomodori 100g, Olio extravergine di oliva 20g | 669 |
| Cena 20:00 | Orata 205g a crudo, Riso 75g a secco, Zucchine 150g, Olio extravergine di oliva 10g | 606 |

Totale Lun: **1758 kcal** · P 131 g · C 171 g · G 58 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 300g, Fiocchi d'avena 20g a secco, Banana 1 banana, Semi di chia 20g | 485 |
| Pranzo 13:00 | Manzo magro 200g a crudo, Riso 75g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 679 |
| Cena 20:00 | _pasto libero_ | 603 |

Totale Sab: **1163 kcal** · P 83 g · C 115 g · G 38 g

_Nessun piano di allenamento generato._

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1734 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S3` Utente solo dieta: la tab Allenamento deve mostrare che il piano non è stato richiesto

---

## Elena, 27 anni — intollerante al lattosio, 5 pasti

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 2 note)

- **Chi è:** Impiegata, 62 kg per 167 cm, vuole dimagrire un po’. Intollerante al lattosio (niente yogurt, latticini, whey), colazione e due spuntini.
- **Cosa ci aspettiamo:** Senza latticini la dieta deve restare varia: colazioni e spuntini diversi ogni giorno, mai la stessa merenda per tutta la settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 27 anni · 167 cm · 62 kg → 58 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1368 / 1784 kcal |
| Target calorico | **1427 kcal** (-20% sul fabbisogno) |
| Macro | P 107 g (1.7 g/kg) · C 142 g · G 48 g |
| Idratazione | 2170 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·1427 kcal → 2·1427 kcal → 3·1427 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 90g a crudo, Fiocchi d'avena 60g a secco, Bevanda di soia non zuccherata 80 ml, Burro di arachidi 100% 10g | 354 |
| Spuntino mattina 10:30 | Uova intere 1 uovo, Pane integrale 40g | 169 |
| Pranzo 13:00 | Petto di pollo 100g a crudo, Pasta 70g a secco, Funghi 150g, Olio extravergine di oliva 10g | 478 |
| Spuntino pomeriggio 17:00 | Fesa di tacchino affettata 35g, Pane integrale 40g, Avocado 30g | 183 |
| Cena 20:00 | Trota 115g a crudo, Riso basmati 60g a secco, Asparagi 150g, Olio extravergine di oliva 5g | 439 |

Totale Lun: **1622 kcal** · P 110 g · C 176 g · G 48 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 2 uova, Pane integrale 50g, Avocado 30g | 312 |
| Spuntino mattina 10:30 | Tonno al naturale 60g, Crackers integrali 20g, Pomodori 40g | 158 |
| Pranzo 13:00 | Macinato di manzo magro 130g a crudo, Pasta 45g a secco, Lattuga 60g, Olio extravergine di oliva 5g | 401 |
| Spuntino pomeriggio 17:00 | Pane integrale 30g, Marmellata light 20g | 104 |
| Cena 20:00 | _pasto libero_ | 366 |

Totale Sab: **973 kcal** · P 70 g · C 91 g · G 34 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @8kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 4×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @32.5kg; Stacco rumeno con bilanciere 4×8-12 @27.5kg; Leg curl 3×10-15 @10kg; Calf raise alla macchina 3×10-15 @25kg; Crunch al cavo 2×10-15 @7.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @32.5kg; Rematore con manubrio 4×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @35kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 3 — Mese 3 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @8kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 4×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @32.5kg; Stacco rumeno con bilanciere 4×8-12 @27.5kg; Leg curl 3×10-15 @10kg; Calf raise alla macchina 3×10-15 @25kg; Crunch al cavo 2×10-15 @7.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @32.5kg; Rematore con manubrio 4×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @35kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `R14` I mesi "Mese 1 · Accumulo" (1, 2) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1427 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Davide, 45 anni — niente uova né pesce

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Commerciale, 84 kg per 178 cm, vuole dimagrire. Allergico alle uova e non mangia pesce; 4 pasti.
- **Cosa ci aspettiamo:** Con uova e pesce esclusi pranzi, cene e colazioni restano vari (non sempre pollo e pasta), senza ripetere lo stesso pasto più di 3 volte a settimana.

| Dati | Valore |
|---|---|
| Profilo | male · 45 anni · 178 cm · 84 kg → 78 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1733 / 2268 kcal |
| Target calorico | **1814 kcal** (-20% sul fabbisogno) |
| Macro | P 136 g (1.6 g/kg) · C 182 g · G 60 g |
| Idratazione | 2940 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1814 kcal → 2·1814 kcal → 3·1815 kcal → 4·1814 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 275g, Muesli 45g a secco, Kiwi 2 kiwi, Mandorle 10g | 497 |
| Pranzo 13:00 | Petto di pollo 130g a crudo, Pasta 105g a secco, Funghi 150g, Olio extravergine di oliva 15g | 680 |
| Spuntino pomeriggio 17:00 | Yogurt greco 2% 170g, Mela 1 mela | 199 |
| Cena 20:00 | Hamburger di pollo magro 170g, Patate dolci 325g a crudo, Zucchine 150g, Olio extravergine di oliva 10g | 635 |

Totale Lun: **2008 kcal** · P 136 g · C 226 g · G 56 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Pane integrale 50g, Marmellata light 20g | 407 |
| Pranzo 13:00 | Hamburger di pollo magro 190g, Cous cous 60g a secco, Pomodori 100g, Olio extravergine di oliva 10g | 568 |
| Spuntino pomeriggio 17:00 | Yogurt magro 280g, Frutti di bosco 50g, Semi di lino 15g | 209 |
| Cena 20:00 | _pasto libero_ | 516 |

Totale Sab: **1183 kcal** · P 92 g · C 105 g · G 41 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @20kg; Rematore con manubrio 4×6-10 @20kg; Lat machine 4×8-12 @40kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @67.5kg; Stacco rumeno con bilanciere 4×8-12 @55kg; Leg curl 3×10-15 @25kg; Calf raise alla macchina 3×10-15 @45kg; Crunch al cavo 2×10-15 @20kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @67.5kg; Rematore con manubrio 4×6-10 @20kg; Panca inclinata con manubri 3×8-12 @16kg; Hip thrust 2×8-12 @70kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @20kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @20kg; Rematore con manubrio 4×6-10 @20kg; Lat machine 4×8-12 @40kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @65kg; Stacco rumeno con bilanciere 4×8-12 @55kg; Leg curl 3×10-15 @25kg; Calf raise in piedi 3×10-15; Pallof press 2×10-15 @5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @65kg; Rematore con manubrio 4×6-10 @20kg; Panca inclinata con manubri 3×8-12 @16kg; Hip thrust 2×8-12 @70kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Paola, 36 anni — mangia sempre bresaola e avocado a merenda

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Insegnante, 66 kg per 170 cm. Nel questionario scrive che di solito mangia bresaola e avocado a merenda e vuole alimenti ricorrenti.
- **Cosa ci aspettiamo:** Le abitudini dichiarate orientano la scelta ma non la rendono fissa: la stessa merenda non può tornare più di 3 volte a settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 36 anni · 170 cm · 66 kg → 66 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1382 / 1807 kcal |
| Target calorico | **1807 kcal** (0% sul fabbisogno) |
| Macro | P 106 g (1.6 g/kg) · C 211 g · G 60 g |
| Idratazione | 2310 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1807 kcal → 2·1807 kcal → 3·1807 kcal → 4·1807 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 180g, Muesli 60g a secco, Kiwi 2 kiwi, Mandorle 10g | 486 |
| Pranzo 13:00 | Tonno al naturale 70g, Pasta integrale 120g a secco, Fagiolini 150g, Olio extravergine di oliva 15g | 683 |
| Spuntino pomeriggio 17:00 | Yogurt greco 0% 100g, Fiocchi d'avena 45g a secco | 225 |
| Cena 20:00 | Sgombro 110g a crudo, Pasta 100g a secco, Pomodori 100g, Olio extravergine di oliva 5g | 606 |

Totale Lun: **2000 kcal** · P 111 g · C 251 g · G 54 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 210g, Gallette di riso 2 gallette, Banana 1 banana | 393 |
| Pranzo 13:00 | Petto di pollo 110g a crudo, Pasta 85g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 578 |
| Spuntino pomeriggio 17:00 | Yogurt magro 195g, Frutti di bosco 150g, Semi di lino 15g | 221 |
| Cena 20:00 | _pasto libero_ | 523 |

Totale Sab: **1190 kcal** · P 74 g · C 131 g · G 37 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @8kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 3×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @35kg; Stacco rumeno con bilanciere 4×8-12 @30kg; Leg curl 3×10-15 @10kg; Calf raise alla macchina 2×10-15 @25kg; Crunch al cavo 2×10-15 @7.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @35kg; Rematore con manubrio 3×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @37.5kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @8kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 3×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @35kg; Stacco rumeno con bilanciere 4×8-12 @30kg; Leg curl 3×10-15 @10kg; Calf raise in piedi 2×10-15; Pallof press 2×10-15 @2.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @35kg; Rematore con manubrio 3×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @37.5kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1807 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Marta, 30 anni — pranza fuori casa quasi ogni giorno

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Impiegata, 58 kg per 163 cm, vuole tonificarsi. Mangia fuori 5 volte a settimana (schiscetta o bar), 4 pasti con una merenda.
- **Cosa ci aspettiamo:** Pranzi trasportabili (insalate, bowl, panini) e piatti vari nella settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 30 anni · 163 cm · 58 kg → 56 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1288 / 1678 kcal |
| Target calorico | **1678 kcal** (0% sul fabbisogno) |
| Macro | P 93 g (1.6 g/kg) · C 200 g · G 56 g |
| Idratazione | 2030 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1678 kcal → 2·1678 kcal → 3·1678 kcal → 4·1678 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 150g, Muesli 55g a secco, Kiwi 2 kiwi, Mandorle 10g | 446 |
| Pranzo 13:00 | Hamburger di pollo magro 120g, Riso integrale 100g a secco, Lattuga 60g, Olio extravergine di oliva 10g | 617 |
| Spuntino pomeriggio 17:00 | Yogurt greco 2% 100g, Fiocchi d'avena 40g a secco | 219 |
| Cena 20:00 | Sgombro 110g a crudo, Patate 400g a crudo, Lattuga 60g, Olio extravergine di oliva 5g | 573 |

Totale Lun: **1855 kcal** · P 99 g · C 233 g · G 53 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Bevanda di soia non zuccherata 300 ml, Cereali integrali 25g a secco, Banana 1 banana, Mandorle 15g | 392 |
| Pranzo 13:00 | Manzo magro 115g a crudo, Riso 70g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 560 |
| Spuntino pomeriggio 17:00 | Tonno al naturale 60g, Crackers integrali 30g, Pomodori 40g | 199 |
| Cena 20:00 | _pasto libero_ | 487 |

Totale Sab: **1149 kcal** · P 66 g · C 127 g · G 38 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @6kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 3×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @32.5kg; Stacco rumeno con bilanciere 4×8-12 @25kg; Leg curl 3×10-15 @10kg; Calf raise alla macchina 2×10-15 @20kg; Crunch al cavo 2×10-15 @7.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @32.5kg; Rematore con manubrio 3×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @32.5kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @6kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 3×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @30kg; Stacco rumeno con bilanciere 4×8-12 @25kg; Leg curl 3×10-15 @10kg; Calf raise in piedi 2×10-15; Pallof press 2×10-15 @2.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @30kg; Rematore con manubrio 3×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @32.5kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1678 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Luigi, 55 anni — pescetariano, vuole perdere pancia

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Geometra, 88 kg per 175 cm. Non mangia carne ma mangia pesce, uova e latticini. 3 pasti, cammina molto.
- **Cosa ci aspettiamo:** Dieta senza carne ma con pesce, uova, legumi e latticini, varia nella settimana.

| Dati | Valore |
|---|---|
| Profilo | male · 55 anni · 175 cm · 88 kg → 82 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1704 / 2290 kcal |
| Target calorico | **1832 kcal** (-20% sul fabbisogno) |
| Macro | P 137 g (1.6 g/kg) · C 182 g · G 62 g |
| Idratazione | 3080 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1832 kcal → 2·1832 kcal → 3·1834 kcal → 4·1830 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 165g a crudo, Fiocchi d'avena 90g a secco, Latte vaccino 140 ml, Burro di arachidi 100% 10g | 567 |
| Pranzo 13:00 | Tonno al naturale 150g, Pasta 115g a secco, Pomodori 100g, Olio extravergine di oliva 20g | 775 |
| Cena 20:00 | Trota 185g a crudo, Riso basmati 100g a secco, Asparagi 150g, Olio extravergine di oliva 10g | 716 |

Totale Lun: **2057 kcal** · P 138 g · C 229 g · G 61 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Gallette di riso 2 gallette, Banana 1 banana | 434 |
| Pranzo 13:00 | Tonno al naturale 160g, Cous cous 75g a secco, Zucchine 150g, Olio extravergine di oliva 20g | 653 |
| Cena 20:00 | _pasto libero_ | 587 |

Totale Sab: **1086 kcal** · P 81 g · C 104 g · G 36 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @18kg; Rematore con manubrio 4×6-10 @18kg; Lat machine 4×8-12 @40kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @60kg; Stacco rumeno con bilanciere 4×8-12 @50kg; Leg curl 3×10-15 @20kg; Calf raise alla macchina 3×10-15 @45kg; Crunch al cavo 2×10-15 @20kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @60kg; Rematore con manubrio 4×6-10 @18kg; Panca inclinata con manubri 3×8-12 @14kg; Hip thrust 2×8-12 @65kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @20kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 4×6-10 @18kg; Rematore con manubrio 3×6-10 @18kg; Lat machine 3×8-12 @35kg; Trazioni alla sbarra 3×8-12; Alzate laterali al cavo 3×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 4×6-10 @60kg; Stacco rumeno con bilanciere 3×8-12 @50kg; Leg curl 3×10-15 @20kg; Calf raise in piedi 3×10-15; Pallof press 2×10-15 @5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 4×6-10 @60kg; Rematore con manubrio 3×6-10 @18kg; Panca inclinata con manubri 3×8-12 @14kg; Hip thrust 2×8-12 @65kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---

## Sara, 26 anni — sceglie i suoi alimenti preferiti

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Grafica, 60 kg per 168 cm, forma fisica. Nel questionario sceglie i suoi alimenti preferiti per proteine, carboidrati, grassi, frutta e verdura (selettori per componente).
- **Cosa ci aspettiamo:** Gli alimenti scelti compaiono nelle diete, mese dopo mese; il piano resta vario.

| Dati | Valore |
|---|---|
| Profilo | female · 26 anni · 168 cm · 60 kg → 60 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1359 / 1769 kcal |
| Target calorico | **1769 kcal** (0% sul fabbisogno) |
| Macro | P 96 g (1.6 g/kg) · C 213 g · G 59 g |
| Idratazione | 2100 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1769 kcal → 2·1769 kcal → 3·1770 kcal → 4·1769 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 100g, Fiocchi d'avena 75g a secco, Frutti di bosco 50g, Latte vaccino 170 ml | 471 |
| Pranzo 13:00 | Ricotta magra 125g, Pasta integrale 115g a secco, Spinaci 150g, Olio extravergine di oliva 10g | 665 |
| Spuntino pomeriggio 17:00 | Fesa di tacchino affettata 30g, Pane integrale 60g, Avocado 30g | 227 |
| Cena 20:00 | Petto di tacchino 100g a crudo, Patate dolci 340g a crudo, Cavolini di Bruxelles 150g, Olio extravergine di oliva 15g | 620 |

Totale Lun: **1982 kcal** · P 105 g · C 244 g · G 55 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 195g, Pane integrale 70g, Marmellata light 20g | 400 |
| Pranzo 13:00 | Tonno al naturale 70g, Farro 90g a secco, Pomodori 100g, Olio extravergine di oliva 15g | 564 |
| Spuntino pomeriggio 17:00 | Uova intere 1 uovo, Pane integrale 50g | 194 |
| Cena 20:00 | _pasto libero_ | 514 |

Totale Sab: **1157 kcal** · P 70 g · C 131 g · G 36 g

**Mese 1 — Mese 1 · Accumulo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @8kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 3×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @32.5kg; Stacco rumeno con bilanciere 4×8-12 @27.5kg; Leg curl 3×10-15 @10kg; Calf raise alla macchina 2×10-15 @20kg; Crunch al cavo 2×10-15 @7.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @32.5kg; Rematore con manubrio 3×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @35kg; Alzate laterali al cavo 2×12-20 @2.5kg; Crunch al cavo 2×10-15 @7.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper A | Panca piana con manubri 5×6-10 @6kg; Rematore con manubrio 4×6-10 @8kg; Lat machine 3×8-12 @15kg; Alzate laterali al cavo 2×12-20 @2.5kg |
| Mar | Riposo | |
| Mer | Lower A | Back squat 5×6-10 @32.5kg; Stacco rumeno con bilanciere 4×8-12 @27.5kg; Leg curl 3×10-15 @10kg; Calf raise in piedi 2×10-15; Pallof press 2×10-15 @2.5kg |
| Gio | Riposo | |
| Ven | Full Body C | Back squat 3×6-10 @32.5kg; Rematore con manubrio 3×6-10 @8kg; Panca inclinata con manubri 3×8-12 @6kg; Hip thrust 2×8-12 @35kg; Alzate laterali al cavo 2×12-20 @2.5kg; Pallof press 2×10-15 @2.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods

---
