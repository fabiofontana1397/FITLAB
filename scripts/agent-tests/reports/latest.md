# Test dei piani generati dai questionari

Generato il 2026-11-17 10:08 — 22 questionari finti, piani creati con i generatori reali dell’app.

**Totale:** 0 errori · 8 avvisi · 50 note

| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |
|---|---|---|---|---|---|---|
| Sofia, 16 anni | 1703 | 88/210/57 | 4 | 2/0 | 0 | 0 |
| Matteo, 17 anni | 2601 | 118/337/87 | 5 | 3/0 | 0 | 0 |
| Giulia, 24 anni | 1506 | 112/152/50 | 4 | 3/0 | 0 | 7 |
| Luca, 22 anni | 2759 | 129/354/92 | 9 | 5/0 | 0 | 0 |
| Alessandro, 29 anni | 3370 | 128/463/112 | 4 | 4/2 | 0 | 0 |
| Marco, 32 anni | 1913 | 143/191/64 | 6 | 3/0 | 0 | 0 |
| Chiara, 25 anni | 1591 | 119/159/53 | 3 | 2/2 | 0 | 0 |
| Paolo, 38 anni | 2579 | 108/343/86 | 4 | 0/4 | 0 | 0 |
| Andrea, 40 anni | 1702 | 127/170/57 | 3 | –/– | 0 | 0 |
| Ilaria, 29 anni | 2143 | 122/254/71 | 5 | 4/0 | 0 | 0 |
| Anna, 52 anni | 1238 | 92/108/49 | 5 | 2/0 | 0 | 0 |
| Roberto, 58 anni | 2387 | 115/302/80 | 4 | 2/0 | 0 | 0 |
| Franco, 60 anni | 1892 | 109/223/63 | 4 | 1/0 | 0 | 0 |
| Tommaso, 35 anni | 2184 | 128/254/73 | 4 | 1/0 | 0 | 0 |
| Nina, 33 anni | 1586 | 118/159/53 | 4 | 3/0 | 0 | 0 |
| Omar, 41 anni | 1734 | 130/171/59 | 5 | –/– | 0 | 0 |
| Elena, 27 anni | 1420 | 106/143/47 | 3 | 3/0 | 0 | 1 |
| Davide, 45 anni | 1805 | 135/181/60 | 4 | 3/0 | 0 | 0 |
| Paola, 36 anni | 1798 | 106/208/60 | 4 | 3/0 | 0 | 0 |
| Marta, 30 anni | 1670 | 93/198/56 | 4 | 3/0 | 0 | 0 |
| Luigi, 55 anni | 1822 | 136/180/62 | 4 | 3/0 | 0 | 0 |
| Sara, 26 anni | 1761 | 96/211/59 | 4 | 3/0 | 0 | 0 |

## Simulazione: ricalibrazione mensile su 6 mesi

Un corpo virtuale segue il piano; a fine mese l’agente di ricalibrazione vede le pesate (con rumore) e l’aderenza e rielabora dieta e allenamento. Si verifica che il peso vada verso l’obiettivo anche se il metabolismo reale si discosta dal modello del ±10%, e che con bassa aderenza non si corregga sui numeri.

### Sofia, 16 anni — studentessa, vuole tonificarsi

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 55 → 55.2 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 55 → 57.7 kg | 0.16 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 55 → 52.5 kg | -0.14 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 55 → 60.7 kg | 0.33 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Matteo, 17 anni — magro, vuole mettere massa

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 62 → 67.5 kg | 0.26 kg/sett. | on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 62 → 70.7 kg | 0.41 kg/sett. | too_fast › on_track › on_track › on_track › too_fast | -100, -100, -100, -100, -200 |
| Metabolismo più veloce del 10% | 62 → 66.7 kg | 0.22 kg/sett. | plateau › too_slow › on_track › on_track › on_track | 150, 250, 250, 250, 250 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 78.8 kg | 0.78 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0 |

### Giulia, 24 anni — vuole dimagrire qualche kg

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 62 → 56.6 kg | -0.32 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 62 → 58.2 kg | -0.22 kg/sett. | too_slow › on_track › on_track › on_track | -100, -100, -100, -100 |
| Metabolismo più veloce del 10% | 62 → 54.6 kg | -0.43 kg/sett. | on_track › too_fast › on_track › on_track | 0, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 61.6 kg | -0.02 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Luca, 22 anni — massa muscolare, esperto

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 68 → 73.1 kg | 0.20 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 68 → 74.7 kg | 0.26 kg/sett. | too_fast › too_fast › too_fast › on_track › on_track › too_slow | -100, -200, -300, -300, -300, -200 |
| Metabolismo più veloce del 10% | 68 → 71.4 kg | 0.13 kg/sett. | wrong_direction › on_track › on_track › plateau › on_track › on_track | 150, 150, 150, 300, 300, 300 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 68 → 89.3 kg | 0.83 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0, 0 |

### Alessandro, 29 anni — molto attivo, anni di esperienza

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 80 → 80.2 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 80 → 84.1 kg | 0.24 kg/sett. | too_fast › on_track › too_fast › on_track | -100, -100, -200, -200 |
| Metabolismo più veloce del 10% | 80 → 76.7 kg | -0.19 kg/sett. | too_slow › on_track › on_track › on_track | 100, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 80 → 93.7 kg | 0.80 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Marco, 32 anni — dimagrimento, sedentario

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 92 → 82 kg | -0.39 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 92 → 84 kg | -0.31 kg/sett. | too_slow › on_track › too_slow › on_track › on_track › on_track | -100, -100, -200, -200, -200, -200 |
| Metabolismo più veloce del 10% | 92 → 76.7 kg | -0.59 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 92 → 91.4 kg | -0.02 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0, 0 |

### Chiara, 25 anni — palestra + corsa con 4 giorni disponibili

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 60 → 55.8 kg | -0.33 kg/sett. | on_track › on_track › on_track | 0, 0, 0 |
| Metabolismo più lento del 10% | 60 → 56.8 kg | -0.25 kg/sett. | too_slow › too_slow › on_track | -100, -200, -200 |
| Metabolismo più veloce del 10% | 60 → 53.6 kg | -0.50 kg/sett. | on_track › on_track › on_track | 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 60 → 60.1 kg | 0.01 kg/sett. | low_adherence › low_adherence › low_adherence | 0, 0, 0 |

### Paolo, 38 anni — solo corsa, resistenza

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 72 → 72.9 kg | 0.05 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 72 → 75.7 kg | 0.22 kg/sett. | on_track › too_fast › on_track › on_track | 0, -100, -100, -100 |
| Metabolismo più veloce del 10% | 72 → 68.6 kg | -0.20 kg/sett. | on_track › on_track › on_track › too_slow | 0, 0, 0, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 72 → 83 kg | 0.64 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

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
| Modello accurato, piano seguito | 70 → 64.4 kg | -0.26 kg/sett. | on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 70 → 66.9 kg | -0.14 kg/sett. | too_slow › plateau › on_track › plateau › too_slow | -38, -38, -38, -38, -38 |
| Metabolismo più veloce del 10% | 70 → 62.3 kg | -0.36 kg/sett. | on_track › on_track › too_fast › on_track › on_track | 0, 0, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 70 → 69.4 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0 |

### Roberto, 58 anni — salute generale, lavoro in piedi

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 82 → 82.1 kg | 0.00 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 82 → 85.4 kg | 0.20 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 82 → 78.6 kg | -0.20 kg/sett. | on_track › on_track › too_slow › on_track | 0, 0, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 82 → 90 kg | 0.46 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Franco, 60 anni — pensionato, un solo giorno

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 78 → 78 kg | 0.00 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 78 → 81.1 kg | 0.18 kg/sett. | on_track › on_track › on_track › too_fast | 0, 0, 0, -100 |
| Metabolismo più veloce del 10% | 78 → 75.3 kg | -0.15 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 78 → 84.1 kg | 0.35 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Tommaso, 35 anni — si allena una volta ogni due settimane

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 80 → 80.2 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 80 → 83.4 kg | 0.20 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 80 → 76.7 kg | -0.19 kg/sett. | on_track › on_track › on_track › too_slow | 0, 0, 0, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 80 → 87.1 kg | 0.41 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Nina, 33 anni — dimagrimento senza peso obiettivo

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 70 → 64.3 kg | -0.33 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 70 → 65.7 kg | -0.26 kg/sett. | too_slow › on_track › too_slow › on_track | -100, -100, -200, -200 |
| Metabolismo più veloce del 10% | 70 → 62.6 kg | -0.43 kg/sett. | too_fast › on_track › on_track › on_track | 100, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 70 → 69.7 kg | -0.02 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

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
| Metabolismo più veloce del 10% | 62 → 56.1 kg | -0.45 kg/sett. | on_track › on_track › on_track | 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 62 kg | -0.00 kg/sett. | low_adherence › low_adherence › low_adherence | 0, 0, 0 |

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
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 66 → 72.5 kg | 0.38 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

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
| Modello accurato, piano seguito | 88 → 81.4 kg | -0.39 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 88 → 82.9 kg | -0.30 kg/sett. | too_slow › too_slow › on_track › on_track | -100, -200, -200, -200 |
| Metabolismo più veloce del 10% | 88 → 78.5 kg | -0.55 kg/sett. | on_track › on_track › too_fast › on_track | 0, 0, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 88 → 87.6 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Sara, 26 anni — sceglie i suoi alimenti preferiti

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 60 → 60.4 kg | 0.02 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 60 → 62.6 kg | 0.15 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 60 → 57.3 kg | -0.16 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 60 → 66.5 kg | 0.38 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

---

## Sofia, 16 anni — studentessa, vuole tonificarsi

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Ragazza di 16 anni, 55 kg per 165 cm, vita da studente (sedentaria), mai fatto palestra. 2 allenamenti a settimana.
- **Cosa ci aspettiamo:** Sotto i 18 anni nessun deficit: calorie di mantenimento, proteine moderate, scheda principiante con 2 sedute full body.

| Dati | Valore |
|---|---|
| Profilo | female · 16 anni · 165 cm · 55 kg → 55 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1340 / 1703 kcal |
| Target calorico | **1703 kcal** (0% sul fabbisogno) |
| Macro | P 88 g (1.6 g/kg) · C 210 g · G 57 g |
| Idratazione | 1925 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1703 kcal → 2·1703 kcal → 3·1703 kcal → 4·1703 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 135g, Muesli 70g a secco, Kiwi 2 kiwi, Mandorle 15g | 522 |
| Pranzo 13:00 | Tonno al naturale 95g, Riso 115g a secco, Pomodori 100g, Olio extravergine di oliva 20g | 708 |
| Cena 20:00 | Orata 110g a crudo, Riso 105g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 650 |

Totale Lun: **1879 kcal** · P 87 g · C 244 g · G 58 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 175g, Gallette di riso 3 gallette, Banana 1 banana, Burro di mandorle 100% 10g | 458 |
| Pranzo 13:00 | Manzo magro 125g a crudo, Riso 85g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 624 |
| Cena 20:00 | _pasto libero_ | 573 |

Totale Sab: **1081 kcal** · P 58 g · C 127 g · G 36 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×8 @14kg; Trazioni alla sbarra 3×8; Military press 3×10 @9kg; Curl bicipiti 2×12 @4kg; Chest press macchina 3×10 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×8 @20kg; Romanian deadlift 3×8 @16kg; Leg press 3×10 @25kg; Affondi 3×10 @4kg; Hip thrust 3×10 @13kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×6 @17kg; Trazioni alla sbarra 3×6; Military press 3×8-10 @11kg; Curl bicipiti 2×12 @4.5kg; Chest press macchina 3×8-10 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×6 @25kg; Romanian deadlift 3×6 @20kg; Leg press 3×8-10 @30kg; Affondi 3×8-10 @4.5kg; Hip thrust 3×8-10 @16kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1703 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Matteo, 17 anni — magro, vuole mettere massa

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Ragazzo di 17 anni, 62 kg per 176 cm, vuole arrivare a 67 kg. Principiante, 3 allenamenti a settimana.
- **Cosa ci aspettiamo:** Surplus lieve e sostenuto, proteine ~1,9 g/kg, split full body per principianti, mese di adattamento.

| Dati | Valore |
|---|---|
| Profilo | male · 17 anni · 176 cm · 62 kg → 67 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1640 / 2322 kcal |
| Target calorico | **2601 kcal** (12% sul fabbisogno) |
| Macro | P 118 g (1.9 g/kg) · C 337 g · G 87 g |
| Idratazione | 2170 ml |
| Durata piano | 5 mesi |

**Piano alimentare** — mesi: 1·2601 kcal → 2·2601 kcal → 3·2601 kcal → 4·2601 kcal → 5·2601 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 160g, Muesli 115g a secco, Kiwi 2 kiwi, Mandorle 25g | 767 |
| Pranzo 13:00 | Tonno al naturale 125g, Riso 175g a secco, Pomodori 100g, Olio extravergine di oliva 30g | 1042 |
| Cena 20:00 | Trota 130g a crudo, Riso basmati 160g a secco, Asparagi 150g, Olio extravergine di oliva 20g | 946 |

Totale Lun: **2753 kcal** · P 120 g · C 365 g · G 85 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 215g, Gallette di riso 4 gallette, Banana 2 banane, Burro di mandorle 100% 20g | 708 |
| Pranzo 13:00 | Tonno al naturale 80g, Pasta integrale 165g a secco, Fagiolini 150g, Olio extravergine di oliva 30g | 990 |
| Cena 20:00 | _pasto libero_ | 873 |

Totale Sab: **1698 kcal** · P 77 g · C 203 g · G 58 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×10-12 @27.5kg; Panca piana 3×10-12 @19kg; Rematore con bilanciere 3×12 @15kg; Plank 3×20-30 s; Leg press 3×12 @37.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×10-12 @27.5kg; Panca piana 3×10-12 @19kg; Rematore con bilanciere 3×12 @15kg; Plank 3×20-30 s; Leg press 3×12 @37.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×10-12 @27.5kg; Panca piana 3×10-12 @19kg; Rematore con bilanciere 3×12 @15kg; Plank 3×20-30 s; Leg press 3×12 @37.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 3×6-8 @40kg; Panca piana 3×6-8 @25kg; Plank 3×30-45 s; Leg press 3×8-10 @52.5kg; Chest press macchina 3×8-10 |
| Mar | Riposo | |
| Mer | Full Body B | Back squat 3×8-10 @37.5kg; Panca piana 3×8-10 @25kg; Plank 3×30-45 s; Leg press 3×8-10 @52.5kg; Chest press macchina 3×8-10 |
| Gio | Riposo | |
| Ven | Full Body A | Back squat 3×6-8 @40kg; Panca piana 3×6-8 @25kg; Plank 3×30-45 s; Leg press 3×8-10 @52.5kg; Chest press macchina 3×8-10 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2601 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Giulia, 24 anni — vuole dimagrire qualche kg

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 7 avvisi, 2 note)

- **Chi è:** Studentessa universitaria, 62 kg per 166 cm, vuole scendere a 57 kg. Poco attiva, principiante, 3 allenamenti.
- **Cosa ci aspettiamo:** Deficit moderato, proteine alte, durata ~5-6 mesi, scheda full body principiante.

| Dati | Valore |
|---|---|
| Profilo | female · 24 anni · 166 cm · 62 kg → 57 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1377 / 1882 kcal |
| Target calorico | **1506 kcal** (-20% sul fabbisogno) |
| Macro | P 112 g (1.8 g/kg) · C 152 g · G 50 g |
| Idratazione | 2170 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1506 kcal → 2·1506 kcal → 3·1506 kcal → 4·1506 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 205g, Muesli 40g a secco, Kiwi 2 kiwi, Mandorle 20g | 462 |
| Pranzo 13:00 | Fiocchi di latte 265g, Farro 85g a secco, Pomodori 100g, Olio extravergine di oliva 5g | 632 |
| Cena 20:00 | Uova intere 3 uova, Pasta 85g a secco, Zucchine 150g, Olio extravergine di oliva 5g | 578 |

Totale Lun: **1671 kcal** · P 104 g · C 183 g · G 53 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Pane integrale 40g, Marmellata light 20g | 382 |
| Pranzo 13:00 | Uova intere 3 uova, Pane integrale 110g, Spinaci 150g, Olio extravergine di oliva 5g | 564 |
| Cena 20:00 | _pasto libero_ | 492 |

Totale Sab: **944 kcal** · P 63 g · C 85 g · G 36 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×10-12 @22.5kg; Panca piana 3×10-12 @13kg; Rematore con bilanciere 3×12 @11kg; Plank 3×20-30 s; Leg press 3×12 @27.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×10-12 @22.5kg; Panca piana 3×10-12 @13kg; Rematore con bilanciere 3×12 @11kg; Plank 3×20-30 s; Leg press 3×12 @27.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×10-12 @22.5kg; Panca piana 3×10-12 @13kg; Rematore con bilanciere 3×12 @11kg; Plank 3×20-30 s; Leg press 3×12 @27.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 3×6-8 @27.5kg; Panca piana 3×6-8 @19kg; Rematore con bilanciere 3×10-12 @14kg; Plank 3×30-45 s; Leg press 3×10-12 @35kg |
| Mar | Riposo | |
| Mer | Full Body B | Back squat 3×10-12 @25kg; Panca piana 3×10-12 @17kg; Rematore con bilanciere 3×10-12 @14kg; Plank 3×30-45 s; Leg press 3×10-12 @35kg |
| Gio | Riposo | |
| Ven | Full Body A | Back squat 3×6-8 @27.5kg; Panca piana 3×6-8 @19kg; Rematore con bilanciere 3×10-12 @14kg; Plank 3×30-45 s; Leg press 3×10-12 @35kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `D3` Gio: 1542 kcal, 9% rispetto al target del giorno (1414)
- ⚠️ `D5` Proteine: i pasti danno in media il 91% del target (giorno peggiore: 17% di scarto)
- ⚠️ `Q6` Mar (mese 1): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Mar (mese 2): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Dom (mese 2): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Mar (mese 3): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Gio (mese 4): stessa fonte proteica a pranzo e cena (cheese)
- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1506 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Luca, 22 anni — massa muscolare, esperto

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 4 note)

- **Chi è:** Studente magro (68 kg per 180 cm), vuole arrivare a 75 kg. Esperto, 5 allenamenti a settimana da 60-90 min, 5 pasti.
- **Cosa ci aspettiamo:** Surplus controllato, proteine ~1,9 g/kg, split a 5 giorni senza mese di adattamento, progressione di carichi mese dopo mese.

| Dati | Valore |
|---|---|
| Profilo | male · 22 anni · 180 cm · 68 kg → 75 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1700 / 2555 kcal |
| Target calorico | **2759 kcal** (8% sul fabbisogno) |
| Macro | P 129 g (1.9 g/kg) · C 354 g · G 92 g |
| Idratazione | 2730 ml |
| Durata piano | 9 mesi |

**Piano alimentare** — mesi: 1·2759 kcal → 2·2759 kcal → 3·2759 kcal → 4·2759 kcal → 5·2759 kcal → 6·2759 kcal → 7·2759 kcal → 8·2759 kcal → 9·2759 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 115g, Muesli 95g a secco, Kiwi 2 kiwi, Mandorle 25g | 646 |
| Spuntino mattina 10:30 | Fesa di tacchino affettata 35g, Pane integrale 80g, Avocado 45g | 307 |
| Pranzo 13:00 | Petto di pollo 120g a crudo, Riso 140g a secco, Zucchine 150g, Olio extravergine di oliva 25g | 866 |
| Spuntino pomeriggio 17:00 | Yogurt greco 2% 120g, Mela 2 mele, Noci 10g | 312 |
| Cena 20:00 | Uova intere 3 uova, Pasta 135g a secco, Zucchine 150g, Olio extravergine di oliva 10g | 801 |

Totale Lun: **2930 kcal** · P 131 g · C 372 g · G 93 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 100g, Fiocchi d'avena 105g a secco, Frutti di bosco 50g, Latte vaccino 230 ml | 635 |
| Spuntino mattina 10:30 | Uova intere 1 uovo, Pane integrale 90g | 293 |
| Pranzo 13:00 | Ricotta magra 160g, Pasta integrale 150g a secco, Spinaci 150g, Olio extravergine di oliva 15g | 871 |
| Spuntino pomeriggio 17:00 | Yogurt magro 280g, Frutti di bosco 250g, Semi di lino 20g | 325 |
| Cena 20:00 | _pasto libero_ | 788 |

Totale Sab: **2121 kcal** · P 104 g · C 261 g · G 62 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×6-8 @42.5kg; Military press 4×6-8 @30kg; Dip alle parallele 3×8-12; Alzate laterali 3×12-15 @3.5kg; Chest press macchina 3×8-12; Push-up 3×8-12 |
| Mar | Pull | Stacco da terra 4×6-8 @72.5kg; Trazioni zavorrate 4×6-8; Rematore con bilanciere 3×8-12 @30kg; Curl bicipiti 3×12-15 @11kg; Lat machine 3×8-12; Rematore con manubrio 3×8-12 @9kg |
| Mer | Riposo | |
| Gio | Legs | Back squat 4×6-8 @60kg; Romanian deadlift 4×6-8 @50kg; Leg press 3×8-12 @75kg; Affondi 3×8-12 @11kg; Hip thrust 3×8-12 @37.5kg; Leg curl machine 3×12-15 |
| Ven | Upper | Panca piana 4×6-8 @42.5kg; Trazioni alla sbarra 4×6-8; Military press 3×8-12 @25kg; Curl bicipiti 3×12-15 @11kg; Chest press macchina 3×8-12; Lat machine 3×8-12 |
| Sab | Lower | Back squat 4×6-8 @60kg; Romanian deadlift 4×6-8 @50kg; Leg press 3×8-12 @75kg; Affondi 3×8-12 @11kg; Hip thrust 3×8-12 @37.5kg; Leg curl machine 3×12-15 |
| Dom | Riposo | |

**Mese 9 — Mese 9 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 3×6-8 @50kg; Military press 3×6-8 @35kg; Push-up 3×8-10; Dip alle parallele 3×8-10; Alzate laterali 3×10-12 @4.5kg; Chest press macchina 3×8-10 |
| Mar | Pull | Stacco da terra 3×6-8 @87.5kg; Trazioni zavorrate 3×6-8; Rematore con manubrio 3×8-10 @11kg; Rematore con bilanciere 3×8-10 @40kg; Curl bicipiti 3×10-12 @14kg; Lat machine 3×8-10 |
| Mer | Riposo | |
| Gio | Legs | Back squat 3×6-8 @72.5kg; Romanian deadlift 3×6-8 @60kg; Leg curl machine 3×10-12; Abductor machine 3×10-12; Polpacci alla macchina 3×10-12; Leg press 3×8-10 @92.5kg |
| Ven | Upper | Panca piana 3×6-8 @50kg; Trazioni alla sbarra 3×6-8; Lat machine 3×8-10; Military press 3×8-10 @32.5kg; Curl bicipiti 3×10-12 @14kg; Chest press macchina 3×8-10 |
| Sab | Lower | Back squat 3×6-8 @72.5kg; Romanian deadlift 3×6-8 @60kg; Leg curl machine 3×10-12; Abductor machine 3×10-12; Polpacci alla macchina 3×10-12; Leg press 3×8-10 @92.5kg |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2759 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q6` Mar (mese 4): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Ven (mese 6): una fonte proteica compare tre volte nel giorno

---

## Alessandro, 29 anni — molto attivo, anni di esperienza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 3 note)

- **Chi è:** Idraulico (lavoro fisico), 80 kg per 182 cm, 12.000+ passi al giorno. Palestra 4 volte + corsa 2 volte, esperto, vuole restare in forma.
- **Cosa ci aspettiamo:** Fabbisogno alto (lavoro fisico + 6 sedute), calorie di mantenimento, alternanza sensata palestra/corsa su 6 giorni con almeno un riposo.

| Dati | Valore |
|---|---|
| Profilo | male · 29 anni · 182 cm · 80 kg → 80 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1798 / 3370 kcal |
| Target calorico | **3370 kcal** (0% sul fabbisogno) |
| Macro | P 128 g (1.6 g/kg) · C 463 g · G 112 g |
| Idratazione | 3150 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·3370 kcal → 2·3370 kcal → 3·3370 kcal → 4·3370 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Kefir 300g, Fiocchi d'avena 160g a secco, Mela 1 mela, Noci 20g | 955 |
| Pranzo 13:00 | Hamburger di pollo magro 150g, Riso integrale 225g a secco, Lattuga 60g, Olio extravergine di oliva 30g | 1292 |
| Cena 20:00 | Orata 155g a crudo, Riso 205g a secco, Zucchine 150g, Olio extravergine di oliva 30g | 1187 |

Totale Lun: **3432 kcal** · P 129 g · C 464 g · G 111 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 100g, Fiocchi d'avena 160g a secco, Banana 1 banana, Latte vaccino 230 ml | 916 |
| Pranzo 13:00 | Tonno al naturale 90g, Pasta 225g a secco, Pomodori 100g, Olio extravergine di oliva 30g | 1190 |
| Cena 20:00 | _pasto libero_ | 1198 |

Totale Sab: **2105 kcal** · P 90 g · C 300 g · G 55 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×3-5 @52.5kg; Military press 5×3-5 @37.5kg; Dip alle parallele 4×6-8; Alzate laterali 3×10-12 @4.5kg; Chest press macchina 4×6-8; Push-up 4×6-8 |
| Mar | Pull | Stacco da terra 5×3-5 @95kg; Trazioni zavorrate 5×3-5; Rematore con bilanciere 4×6-8 @40kg; Curl bicipiti 3×10-12 @13kg; Lat machine 4×6-8; Rematore con manubrio 4×6-8 @12kg |
| Mer | Legs | Back squat 5×3-5 @80kg; Romanian deadlift 5×3-5 @62.5kg; Leg press 4×6-8 @97.5kg; Affondi 4×6-8 @15kg; Hip thrust 4×6-8 @47.5kg; Leg curl machine 3×10-12 |
| Gio | Riposo | |
| Ven | Upper | Panca piana 5×3-5 @52.5kg; Trazioni alla sbarra 5×3-5; Military press 4×6-8 @35kg; Curl bicipiti 3×10-12 @13kg; Chest press macchina 4×6-8; Lat machine 4×6-8 |
| Sab | Corsa | Corsa facile 35-40 min |
| Dom | Corsa | Corsa a ritmo medio 30 min |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×2-4 @57.5kg; Military press 4×2-4 @42.5kg; Alzate laterali 2×10-12 @4.5kg; Chest press macchina 3×5-6; Push-up 3×5-6; Dip alle parallele 3×5-6 |
| Mar | Pull | Stacco da terra 4×2-4 @105kg; Trazioni zavorrate 4×2-4; Curl bicipiti 2×10-12 @14kg; Lat machine 3×5-6; Rematore con manubrio 3×5-6 @13kg; Rematore con bilanciere 3×5-6 @45kg |
| Mer | Legs | Back squat 4×2-4 @90kg; Romanian deadlift 4×2-4 @70kg; Affondi 3×5-6 @17kg; Hip thrust 3×5-6 @55kg; Leg curl machine 2×10-12; Abductor machine 2×10-12 |
| Gio | Riposo | |
| Ven | Upper | Panca piana 4×2-4 @57.5kg; Trazioni alla sbarra 4×2-4; Curl bicipiti 2×10-12 @14kg; Chest press macchina 3×5-6; Lat machine 3×5-6; Military press 3×5-6 @40kg |
| Sab | Corsa | Corsa facile 35-40 min |
| Dom | Corsa | Corsa a ritmo medio 30 min |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (3370 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 2 sedute di corsa a settimana (es. "Corsa facile 35-40 min")

---

## Marco, 32 anni — dimagrimento, sedentario

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Impiegato sedentario, 92 kg per 178 cm, vuole scendere a 82 kg. Mai fatto palestra, 3 giorni a settimana, 45-60 min.
- **Cosa ci aspettiamo:** Deficit moderato (non estremo), proteine alte ma non esagerate, durata di circa 6-9 mesi, scheda full body principiante.

| Dati | Valore |
|---|---|
| Profilo | male · 32 anni · 178 cm · 92 kg → 82 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1878 / 2391 kcal |
| Target calorico | **1913 kcal** (-20% sul fabbisogno) |
| Macro | P 143 g (1.6 g/kg) · C 191 g · G 64 g |
| Idratazione | 3220 ml |
| Durata piano | 6 mesi |

**Piano alimentare** — mesi: 1·1913 kcal → 2·1913 kcal → 3·1913 kcal → 4·1913 kcal → 5·1913 kcal → 6·1913 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 175g a crudo, Fiocchi d'avena 95g a secco, Latte vaccino 140 ml, Burro di arachidi 100% 10g | 590 |
| Pranzo 13:00 | Petto di pollo 200g a crudo, Riso 110g a secco, Zucchine 150g, Olio extravergine di oliva 20g | 801 |
| Cena 20:00 | Petto di tacchino 145g a crudo, Pasta 105g a secco, Cavolfiore 150g, Olio extravergine di oliva 20g | 745 |

Totale Lun: **2136 kcal** · P 143 g · C 235 g · G 65 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 300g, Fiocchi d'avena 35g a secco, Frutti di bosco 50g, Latte vaccino 180 ml | 481 |
| Pranzo 13:00 | Petto di tacchino 210g a crudo, Riso 65g a secco, Carote 100g, Olio extravergine di oliva 20g | 667 |
| Cena 20:00 | _pasto libero_ | 618 |

Totale Sab: **1147 kcal** · P 93 g · C 103 g · G 38 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×10-12 @30kg; Panca piana 3×10-12 @22.5kg; Rematore con bilanciere 3×12 @16kg; Plank 3×20-30 s; Leg press 3×12 @40kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×10-12 @30kg; Panca piana 3×10-12 @22.5kg; Rematore con bilanciere 3×12 @16kg; Plank 3×20-30 s; Leg press 3×12 @40kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×10-12 @30kg; Panca piana 3×10-12 @22.5kg; Rematore con bilanciere 3×12 @16kg; Plank 3×20-30 s; Leg press 3×12 @40kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 6 — Mese 6 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 3×6-8 @45kg; Panca piana 3×6-8 @30kg; Plank 3×30-45 s; Leg press 3×10-12 @52.5kg; Chest press macchina 3×10-12 |
| Mar | Riposo | |
| Mer | Full Body B | Back squat 3×10-12 @40kg; Panca piana 3×10-12 @27.5kg; Plank 3×30-45 s; Leg press 3×10-12 @52.5kg; Chest press macchina 3×10-12 |
| Gio | Riposo | |
| Ven | Full Body A | Back squat 3×6-8 @45kg; Panca piana 3×6-8 @30kg; Plank 3×30-45 s; Leg press 3×10-12 @52.5kg; Chest press macchina 3×10-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1913 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Chiara, 25 anni — palestra + corsa con 4 giorni disponibili

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 3 note)

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

**Piano alimentare** — mesi: 1·1591 kcal → 2·1591 kcal → 3·1591 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 155g a crudo, Fiocchi d'avena 70g a secco, Latte vaccino 110 ml, Burro di arachidi 100% 10g | 468 |
| Pranzo 13:00 | Petto di pollo 170g a crudo, Riso 85g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 636 |
| Cena 20:00 | Orata 175g a crudo, Patate 325g a crudo, Fagiolini 150g, Olio extravergine di oliva 10g | 598 |

Totale Lun: **1702 kcal** · P 121 g · C 180 g · G 51 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 250g, Banana 1 banana, Semi di chia 20g | 355 |
| Pranzo 13:00 | Manzo magro 195g a crudo, Riso 55g a secco, Peperoni 150g, Olio extravergine di oliva 10g | 558 |
| Cena 20:00 | _pasto libero_ | 507 |

Totale Sab: **913 kcal** · P 78 g · C 86 g · G 26 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 4×6-8 @32.5kg; Trazioni alla sbarra 4×6-8; Military press 3×10-12 @19kg; Curl bicipiti 3×12-15 @8kg; Chest press macchina 3×10-12 |
| Mar | Lower | Back squat 4×6-8 @47.5kg; Romanian deadlift 4×6-8 @37.5kg; Leg press 3×10-12 @57.5kg; Affondi 3×10-12 @9kg; Hip thrust 3×10-12 @27.5kg |
| Mer | Riposo | |
| Gio | Corsa | Corsa facile 35 min |
| Ven | Corsa | Corsa a ritmo medio 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 3 — Mese 3 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×6-8 @32.5kg; Trazioni alla sbarra 3×6-8; Military press 3×10-12 @20kg; Curl bicipiti 2×15 @8kg; Chest press macchina 3×10-12 |
| Mar | Lower | Back squat 3×6-8 @50kg; Romanian deadlift 3×6-8 @37.5kg; Leg press 3×10-12 @60kg; Affondi 3×10-12 @9kg; Hip thrust 3×10-12 @30kg |
| Mer | Riposo | |
| Gio | Corsa | Corsa facile 35 min |
| Ven | Corsa | Corsa a ritmo medio 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1591 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 2 sedute di corsa a settimana (es. "Corsa facile 35 min")

---

## Paolo, 38 anni — solo corsa, resistenza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 3 note)

- **Chi è:** Runner amatoriale, 72 kg per 176 cm. Corre 4 volte a settimana, nessuna palestra, vuole migliorare la resistenza.
- **Cosa ci aspettiamo:** Nessuna seduta di palestra, 4 uscite di corsa varie (facili, medio, lungo), carboidrati abbondanti, calorie di mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 38 anni · 176 cm · 72 kg → 72 kg · obiettivo `improveEndurance` |
| Metabolismo basale / fabbisogno | 1635 / 2579 kcal |
| Target calorico | **2579 kcal** (0% sul fabbisogno) |
| Macro | P 108 g (1.5 g/kg) · C 343 g · G 86 g |
| Idratazione | 2870 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2579 kcal → 2·2622 kcal → 3·2622 kcal → 4·2622 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 135g, Muesli 115g a secco, Kiwi 2 kiwi, Mandorle 25g | 750 |
| Pranzo 13:00 | Tonno al naturale 110g, Riso 175g a secco, Pomodori 100g, Olio extravergine di oliva 30g | 1025 |
| Cena 20:00 | Uova intere 3 uova, Pasta 160g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 935 |

Totale Lun: **2708 kcal** · P 111 g · C 356 g · G 88 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 175g, Gallette di riso 3 gallette, Banana 2 banane, Burro di mandorle 100% 25g | 666 |
| Pranzo 13:00 | Tonno al naturale 75g, Pasta integrale 155g a secco, Fagiolini 150g, Olio extravergine di oliva 30g | 948 |
| Cena 20:00 | _pasto libero_ | 830 |

Totale Sab: **1614 kcal** · P 70 g · C 188 g · G 58 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Corsa | Corsa facile 30 min |
| Mar | Corsa | Corsa facile 35 min |
| Mer | Riposo | |
| Gio | Corsa | Lungo lento 45 min |
| Ven | Corsa | Corsa facile 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Corsa | Corsa facile 35-40 min |
| Mar | Corsa | Corsa a ritmo medio 30 min |
| Mer | Riposo | |
| Gio | Corsa | Lungo lento 60-70 min |
| Ven | Corsa | Corsa facile 35-40 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2622 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 4 sedute di corsa a settimana (es. "Corsa facile 30 min")

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
| Metabolismo basale / fabbisogno | 1397 / 2041 kcal |
| Target calorico | **2143 kcal** (5% sul fabbisogno) |
| Macro | P 122 g (1.9 g/kg) · C 254 g · G 71 g |
| Idratazione | 2590 ml |
| Durata piano | 5 mesi |

_Nessun piano alimentare generato._

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×3-5 @42.5kg; Military press 5×3-5 @27.5kg; Dip alle parallele 4×6-8; Alzate laterali 3×10-12 @3.5kg; Chest press macchina 4×6-8; Push-up 4×6-8 |
| Mar | Pull | Stacco da terra 5×3-5 @75kg; Trazioni zavorrate 5×3-5; Rematore con bilanciere 4×6-8 @32.5kg; Curl bicipiti 3×10-12 @10kg; Lat machine 4×6-8; Rematore con manubrio 4×6-8 @9kg |
| Mer | Riposo | |
| Gio | Legs | Back squat 5×3-5 @62.5kg; Romanian deadlift 5×3-5 @52.5kg; Leg press 4×6-8 @77.5kg; Affondi 4×6-8 @12kg; Hip thrust 4×6-8 @40kg; Leg curl machine 3×10-12 |
| Ven | Upper | Panca piana 5×3-5 @42.5kg; Trazioni alla sbarra 5×3-5; Military press 4×6-8 @27.5kg; Curl bicipiti 3×10-12 @10kg; Chest press macchina 4×6-8; Lat machine 4×6-8 |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×2-4 @50kg; Military press 4×2-4 @32.5kg; Alzate laterali 2×10-12 @3.5kg; Chest press macchina 3×5-6; Push-up 3×5-6; Dip alle parallele 3×5-6 |
| Mar | Pull | Stacco da terra 4×2-4 @85kg; Trazioni zavorrate 4×2-4; Curl bicipiti 2×10-12 @12kg; Lat machine 3×5-6; Rematore con manubrio 3×5-6 @11kg; Rematore con bilanciere 3×5-6 @37.5kg |
| Mer | Riposo | |
| Gio | Legs | Back squat 4×2-4 @72.5kg; Romanian deadlift 4×2-4 @60kg; Affondi 3×5-6 @14kg; Hip thrust 3×5-6 @47.5kg; Leg curl machine 2×10-12; Abductor machine 2×10-12 |
| Ven | Upper | Panca piana 4×2-4 @50kg; Trazioni alla sbarra 4×2-4; Curl bicipiti 2×10-12 @12kg; Chest press macchina 3×5-6; Lat machine 3×5-6; Military press 3×5-6 @30kg |
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
| Metabolismo basale / fabbisogno | 1292 / 1548 kcal |
| Target calorico | **1238 kcal** (-20% sul fabbisogno) |
| Macro | P 92 g (1.3 g/kg) · C 108 g · G 49 g |
| Idratazione | 2450 ml |
| Durata piano | 5 mesi |

**Piano alimentare** — mesi: 1·1238 kcal → 2·1238 kcal → 3·1238 kcal → 4·1238 kcal → 5·1238 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 200g, Muesli 20g a secco, Kiwi 2 kiwi, Mandorle 15g | 381 |
| Pranzo 13:00 | Tonno al naturale 90g, Pasta integrale 70g a secco, Fagiolini 150g, Olio extravergine di oliva 15g | 527 |
| Cena 20:00 | Merluzzo 155g a crudo, Riso basmati 50g a secco, Carote 100g, Olio extravergine di oliva 15g | 471 |

Totale Lun: **1377 kcal** · P 92 g · C 133 g · G 48 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 125g, Fiocchi d'avena 20g a secco, Banana 1 banana, Latte vaccino 120 ml | 336 |
| Pranzo 13:00 | Manzo magro 150g a crudo, Riso 40g a secco, Peperoni 150g, Olio extravergine di oliva 10g | 451 |
| Cena 20:00 | _pasto libero_ | 417 |

Totale Sab: **786 kcal** · P 56 g · C 85 g · G 23 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×10-12 @15kg; Trazioni alla sbarra 3×12; Military press 3×12 @10kg; Curl bicipiti 2×15 @4.5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Romanian deadlift 3×10-12 @19kg; Hip thrust 3×12 @15kg; Abductor machine 2×15; Polpacci alla macchina 2×15 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×6-8 @22.5kg; Trazioni alla sbarra 3×10-12; Curl bicipiti 2×15 @6kg; Chest press macchina 3×10-12 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Romanian deadlift 3×6-8 @25kg; Hip thrust 3×10-12 @20kg; Abductor machine 2×15; Polpacci alla macchina 2×15 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1238 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Roberto, 58 anni — salute generale, lavoro in piedi

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Uomo, 82 kg per 175 cm, lavoro in piedi tutto il giorno. Vuole stare meglio. Principiante, 2 allenamenti.
- **Cosa ci aspettiamo:** Calorie di mantenimento, scheda semplice con carichi prudenti, 2 sedute.

| Dati | Valore |
|---|---|
| Profilo | male · 58 anni · 175 cm · 82 kg → 80 kg · obiettivo `generalHealth` |
| Metabolismo basale / fabbisogno | 1629 / 2387 kcal |
| Target calorico | **2387 kcal** (0% sul fabbisogno) |
| Macro | P 115 g (1.4 g/kg) · C 302 g · G 80 g |
| Idratazione | 2870 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2387 kcal → 2·2387 kcal → 3·2387 kcal → 4·2387 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 165g, Muesli 110g a secco, Kiwi 2 kiwi, Mandorle 20g | 722 |
| Pranzo 13:00 | Petto di pollo 140g a crudo, Riso 160g a secco, Zucchine 150g, Olio extravergine di oliva 25g | 958 |
| Cena 20:00 | Trota 125g a crudo, Riso basmati 145g a secco, Asparagi 150g, Olio extravergine di oliva 20g | 887 |

Totale Lun: **2564 kcal** · P 116 g · C 338 g · G 78 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 220g, Gallette di riso 6 gallette, Banana 1 banana, Burro di mandorle 100% 15g | 638 |
| Pranzo 13:00 | Hamburger di manzo magro 190g, Patate 400g a crudo, Lattuga 60g, Olio extravergine di oliva 15g | 766 |
| Cena 20:00 | _pasto libero_ | 810 |

Totale Sab: **1404 kcal** · P 77 g · C 151 g · G 52 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×8 @20kg; Trazioni alla sbarra 3×10; Military press 3×10 @13kg; Curl bicipiti 2×12 @6kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×8 @32.5kg; Romanian deadlift 3×10 @22.5kg; Leg press 3×10 @37.5kg; Affondi 3×10 @6kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×6 @25kg; Trazioni alla sbarra 3×8-10; Military press 3×8-10 @17kg; Curl bicipiti 2×12 @7kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×6 @40kg; Romanian deadlift 3×8-10 @27.5kg; Leg press 3×8-10 @47.5kg; Affondi 3×8-10 @7kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2387 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Franco, 60 anni — pensionato, un solo giorno

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Uomo, 78 kg per 170 cm, pensionato. Può allenarsi 1 volta a settimana, 30 minuti, principiante.
- **Cosa ci aspettiamo:** Una sola seduta a settimana (full body, 3 esercizi), piano non invasivo, calorie di mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 60 anni · 170 cm · 78 kg → 76 kg · obiettivo `generalHealth` |
| Metabolismo basale / fabbisogno | 1548 / 1892 kcal |
| Target calorico | **1892 kcal** (0% sul fabbisogno) |
| Macro | P 109 g (1.4 g/kg) · C 223 g · G 63 g |
| Idratazione | 2730 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1892 kcal → 2·1892 kcal → 3·1892 kcal → 4·1892 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 200g, Muesli 70g a secco, Kiwi 2 kiwi, Mandorle 15g | 567 |
| Pranzo 13:00 | Petto di pollo 135g a crudo, Riso basmati 120g a secco, Zucchine 150g, Olio extravergine di oliva 20g | 770 |
| Cena 20:00 | Hamburger di pollo magro 150g, Patate dolci 400g a crudo, Zucchine 150g, Olio extravergine di oliva 15g | 725 |

Totale Lun: **2060 kcal** · P 110 g · C 249 g · G 63 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 230g, Gallette di riso 3 gallette, Banana 1 banana, Burro di mandorle 100% 10g | 513 |
| Pranzo 13:00 | Manzo magro 165g a crudo, Riso 95g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 707 |
| Cena 20:00 | _pasto libero_ | 651 |

Totale Sab: **1219 kcal** · P 72 g · C 137 g · G 41 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×8 @30kg; Panca piana 3×10 @18kg; Rematore con bilanciere 3×10 @15kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×6 @37.5kg; Panca piana 3×8-10 @22.5kg; Rematore con bilanciere 3×8-10 @18kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1892 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Tommaso, 35 anni — si allena una volta ogni due settimane

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Uomo, 80 kg per 178 cm, mantenimento. In palestra va "una volta ogni 2 settimane" e ha 3 giorni disponibili.
- **Cosa ci aspettiamo:** Il piano programma 1 seduta a settimana (dose minima efficace) e il fabbisogno conta esattamente quella seduta.

| Dati | Valore |
|---|---|
| Profilo | male · 35 anni · 178 cm · 80 kg → 80 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1743 / 2184 kcal |
| Target calorico | **2184 kcal** (0% sul fabbisogno) |
| Macro | P 128 g (1.6 g/kg) · C 254 g · G 73 g |
| Idratazione | 2800 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2184 kcal → 2·2184 kcal → 3·2184 kcal → 4·2184 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 235g, Muesli 95g a secco, Kiwi 2 kiwi, Mandorle 15g | 685 |
| Pranzo 13:00 | Tonno al naturale 115g, Pasta 160g a secco, Pomodori 100g, Olio extravergine di oliva 25g | 942 |
| Cena 20:00 | Trota 155g a crudo, Riso basmati 135g a secco, Asparagi 150g, Olio extravergine di oliva 15g | 846 |

Totale Lun: **2470 kcal** · P 129 g · C 313 g · G 73 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Gallette di riso 4 gallette, Banana 1 banana, Burro di mandorle 100% 10g | 568 |
| Pranzo 13:00 | Petto di tacchino 170g a crudo, Patate 400g a crudo, Carote 100g, Olio extravergine di oliva 25g | 774 |
| Cena 20:00 | _pasto libero_ | 746 |

Totale Sab: **1341 kcal** · P 81 g · C 141 g · G 47 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 4×6-8 @62.5kg; Panca piana 4×6-8 @42.5kg; Rematore con bilanciere 3×8-12 @30kg; Plank 3×30-45 s; Leg press 3×8-12 @75kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×6-8 @67.5kg; Panca piana 3×6-8 @45kg; Plank 3×30-45 s; Leg press 3×8-10 @87.5kg; Chest press macchina 3×8-10 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2184 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Nina, 33 anni — dimagrimento senza peso obiettivo

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Donna, 70 kg per 166 cm, vuole dimagrire ma lascia vuoto il peso obiettivo (domanda facoltativa).
- **Cosa ci aspettiamo:** Nessun peso obiettivo inventato: durata standard del piano e nessun traguardo falso nelle schermate.

| Dati | Valore |
|---|---|
| Profilo | female · 33 anni · 166 cm · 70 kg → undefined kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1412 / 1982 kcal |
| Target calorico | **1586 kcal** (-20% sul fabbisogno) |
| Macro | P 118 g (1.7 g/kg) · C 159 g · G 53 g |
| Idratazione | 2450 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1586 kcal → 2·1586 kcal → 3·1586 kcal → 4·1586 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 220g, Muesli 55g a secco, Kiwi 1 kiwi, Mandorle 20g | 487 |
| Pranzo 13:00 | Petto di pollo 140g a crudo, Pasta 100g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 662 |
| Cena 20:00 | Hamburger di pollo magro 170g, Patate dolci 315g a crudo, Zucchine 150g, Olio extravergine di oliva 10g | 625 |

Totale Lun: **1774 kcal** · P 118 g · C 195 g · G 52 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Gallette di riso 2 gallette, Banana 1 banana | 434 |
| Pranzo 13:00 | Petto di pollo 155g a crudo, Pasta integrale 65g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 572 |
| Cena 20:00 | _pasto libero_ | 515 |

Totale Sab: **1005 kcal** · P 74 g · C 97 g · G 33 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×10-12 @30kg; Panca piana 3×10-12 @22.5kg; Rematore con bilanciere 3×12 @17kg; Plank 3×20-30 s; Leg press 3×12 @42.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×10-12 @30kg; Panca piana 3×10-12 @22.5kg; Rematore con bilanciere 3×12 @17kg; Plank 3×20-30 s; Leg press 3×12 @42.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×10-12 @30kg; Panca piana 3×10-12 @22.5kg; Rematore con bilanciere 3×12 @17kg; Plank 3×20-30 s; Leg press 3×12 @42.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body A | Back squat 3×6-8 @45kg; Panca piana 3×6-8 @30kg; Rematore con bilanciere 3×10-12 @20kg; Plank 3×30-45 s; Leg press 3×10-12 @52.5kg |
| Mar | Riposo | |
| Mer | Full Body B | Back squat 3×10-12 @40kg; Panca piana 3×10-12 @27.5kg; Rematore con bilanciere 3×10-12 @20kg; Plank 3×30-45 s; Leg press 3×10-12 @52.5kg |
| Gio | Riposo | |
| Ven | Full Body A | Back squat 3×6-8 @45kg; Panca piana 3×6-8 @30kg; Rematore con bilanciere 3×10-12 @20kg; Plank 3×30-45 s; Leg press 3×10-12 @52.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1586 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

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
| Cena 20:00 | Trota 180g a crudo, Patate 310g a crudo, Fagiolini 150g, Olio extravergine di oliva 10g | 623 |

Totale Lun: **1776 kcal** · P 130 g · C 169 g · G 60 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Gallette di riso 2 gallette, Banana 1 banana | 434 |
| Pranzo 13:00 | Manzo magro 200g a crudo, Riso 75g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 679 |
| Cena 20:00 | _pasto libero_ | 603 |

Totale Sab: **1112 kcal** · P 78 g · C 113 g · G 37 g

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
| Metabolismo basale / fabbisogno | 1368 / 1775 kcal |
| Target calorico | **1420 kcal** (-20% sul fabbisogno) |
| Macro | P 106 g (1.7 g/kg) · C 143 g · G 47 g |
| Idratazione | 2170 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·1420 kcal → 2·1420 kcal → 3·1420 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 90g a crudo, Fiocchi d'avena 60g a secco, Bevanda di soia non zuccherata 80 ml, Burro di arachidi 100% 10g | 354 |
| Spuntino mattina 10:30 | Uova intere 1 uovo, Pane integrale 40g | 169 |
| Pranzo 13:00 | Hamburger di pollo magro 140g, Riso integrale 65g a secco, Lattuga 60g, Olio extravergine di oliva 5g | 470 |
| Spuntino pomeriggio 17:00 | Fesa di tacchino affettata 30g, Pane integrale 40g, Avocado 30g | 178 |
| Cena 20:00 | Petto di pollo 105g a crudo, Patate 240g a crudo, Peperoni 150g, Olio extravergine di oliva 10g | 441 |

Totale Lun: **1612 kcal** · P 107 g · C 175 g · G 48 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 2 uova, Pane integrale 30g, Arancia 1 arancia | 275 |
| Spuntino mattina 10:30 | Tonno al naturale 60g, Crackers integrali 20g, Pomodori 40g | 158 |
| Pranzo 13:00 | Petto di tacchino 100g a crudo, Pasta 45g a secco, Broccoli 150g, Olio extravergine di oliva 10g | 403 |
| Spuntino pomeriggio 17:00 | Pane integrale 30g, Marmellata light 20g | 104 |
| Cena 20:00 | _pasto libero_ | 366 |

Totale Sab: **938 kcal** · P 70 g · C 97 g · G 27 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×6-8 @32.5kg; Military press 4×6-8 @22.5kg; Dip alle parallele 3×8-12; Alzate laterali 3×12-15 @2.5kg; Chest press macchina 3×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×6-8 @57.5kg; Trazioni zavorrate 4×6-8; Rematore con bilanciere 3×8-12 @25kg; Curl bicipiti 3×12-15 @8kg; Lat machine 3×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×6-8 @50kg; Romanian deadlift 4×6-8 @40kg; Leg press 3×8-12 @60kg; Affondi 3×8-12 @9kg; Hip thrust 3×8-12 @27.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 3 — Mese 3 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 3×6-8 @32.5kg; Military press 3×6-8 @25kg; Dip alle parallele 3×8-10; Alzate laterali 3×10-12 @3kg; Chest press macchina 3×8-10 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 3×6-8 @60kg; Trazioni zavorrate 3×6-8; Rematore con bilanciere 3×8-10 @25kg; Curl bicipiti 3×10-12 @9kg; Lat machine 3×8-10 |
| Gio | Riposo | |
| Ven | Legs | Back squat 3×6-8 @52.5kg; Romanian deadlift 3×6-8 @40kg; Leg press 3×8-10 @65kg; Affondi 3×8-10 @9kg; Hip thrust 3×8-10 @30kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `D5` Carboidrati: i pasti danno in media il 107% del target (giorno peggiore: 25% di scarto)
- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1420 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Davide, 45 anni — niente uova né pesce

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Commerciale, 84 kg per 178 cm, vuole dimagrire. Allergico alle uova e non mangia pesce; 4 pasti.
- **Cosa ci aspettiamo:** Con uova e pesce esclusi pranzi, cene e colazioni restano vari (non sempre pollo e pasta), senza ripetere lo stesso pasto più di 3 volte a settimana.

| Dati | Valore |
|---|---|
| Profilo | male · 45 anni · 178 cm · 84 kg → 78 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1733 / 2256 kcal |
| Target calorico | **1805 kcal** (-20% sul fabbisogno) |
| Macro | P 135 g (1.6 g/kg) · C 181 g · G 60 g |
| Idratazione | 2940 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1805 kcal → 2·1805 kcal → 3·1805 kcal → 4·1805 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 270g, Muesli 45g a secco, Kiwi 2 kiwi, Mandorle 10g | 493 |
| Pranzo 13:00 | Petto di pollo 145g a crudo, Pasta 100g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 668 |
| Spuntino pomeriggio 17:00 | Yogurt greco 0% 145g, Mela 1 mela, Noci 10g | 232 |
| Cena 20:00 | Hamburger di pollo magro 170g, Patate dolci 320g a crudo, Zucchine 150g, Olio extravergine di oliva 10g | 630 |

Totale Lun: **2020 kcal** · P 136 g · C 221 g · G 59 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Pane integrale 50g, Marmellata light 20g | 407 |
| Pranzo 13:00 | Macinato di manzo magro 190g a crudo, Pasta 70g a secco, Lattuga 60g, Olio extravergine di oliva 5g | 576 |
| Spuntino pomeriggio 17:00 | Yogurt magro 280g, Frutti di bosco 50g, Semi di lino 15g | 209 |
| Cena 20:00 | _pasto libero_ | 517 |

Totale Sab: **1190 kcal** · P 93 g · C 107 g · G 40 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×6-8 @45kg; Military press 4×6-8 @32.5kg; Dip alle parallele 3×8-12; Alzate laterali 3×12-15 @3.5kg; Chest press macchina 3×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×6-8 @80kg; Trazioni zavorrate 4×6-8; Rematore con bilanciere 3×8-12 @30kg; Curl bicipiti 3×12-15 @12kg; Lat machine 3×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×6-8 @65kg; Romanian deadlift 4×6-8 @52.5kg; Leg press 3×8-12 @80kg; Affondi 3×8-12 @12kg; Hip thrust 3×8-12 @40kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 3×6-8 @47.5kg; Military press 3×6-8 @35kg; Alzate laterali 3×10-12 @4kg; Chest press macchina 3×8-10; Push-up 3×8-10 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 3×6-8 @85kg; Trazioni zavorrate 3×6-8; Curl bicipiti 3×10-12 @13kg; Lat machine 3×8-10; Rematore con manubrio 3×8-10 @11kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 3×6-8 @70kg; Romanian deadlift 3×6-8 @57.5kg; Affondi 3×8-10 @14kg; Hip thrust 3×8-10 @45kg; Leg curl machine 3×10-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1805 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Paola, 36 anni — mangia sempre bresaola e avocado a merenda

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Insegnante, 66 kg per 170 cm. Nel questionario scrive che di solito mangia bresaola e avocado a merenda e vuole alimenti ricorrenti.
- **Cosa ci aspettiamo:** Le abitudini dichiarate orientano la scelta ma non la rendono fissa: la stessa merenda non può tornare più di 3 volte a settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 36 anni · 170 cm · 66 kg → 66 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1382 / 1798 kcal |
| Target calorico | **1798 kcal** (0% sul fabbisogno) |
| Macro | P 106 g (1.6 g/kg) · C 208 g · G 60 g |
| Idratazione | 2310 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1798 kcal → 2·1798 kcal → 3·1798 kcal → 4·1798 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 165g, Muesli 55g a secco, Kiwi 2 kiwi, Mandorle 15g | 487 |
| Pranzo 13:00 | Petto di pollo 100g a crudo, Pasta integrale 110g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 675 |
| Spuntino pomeriggio 17:00 | Kefir 300g, Frutti di bosco 200g | 231 |
| Cena 20:00 | Sgombro 110g a crudo, Pasta 100g a secco, Pomodori 100g, Olio extravergine di oliva 5g | 606 |

Totale Lun: **1997 kcal** · P 108 g · C 239 g · G 60 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 210g, Gallette di riso 2 gallette, Banana 1 banana | 393 |
| Pranzo 13:00 | Manzo magro 130g a crudo, Patate 350g a crudo, Rucola 40g, Olio extravergine di oliva 15g | 593 |
| Spuntino pomeriggio 17:00 | Tonno al naturale 60g, Crackers integrali 30g, Pomodori 40g | 199 |
| Cena 20:00 | _pasto libero_ | 523 |

Totale Sab: **1184 kcal** · P 79 g · C 129 g · G 36 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×6-8 @35kg; Military press 4×6-8 @22.5kg; Dip alle parallele 3×8-12; Alzate laterali 3×12-15 @3kg; Chest press macchina 3×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×6-8 @62.5kg; Trazioni zavorrate 4×6-8; Rematore con bilanciere 3×8-12 @25kg; Curl bicipiti 3×12-15 @9kg; Lat machine 3×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×6-8 @52.5kg; Romanian deadlift 4×6-8 @42.5kg; Leg press 3×8-12 @62.5kg; Affondi 3×8-12 @10kg; Hip thrust 3×8-12 @30kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 3×6-8 @37.5kg; Military press 3×6-8 @25kg; Alzate laterali 3×10-12 @3.5kg; Chest press macchina 3×8-10; Push-up 3×8-10 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 3×6-8 @67.5kg; Trazioni zavorrate 3×6-8; Curl bicipiti 3×10-12 @10kg; Lat machine 3×8-10; Rematore con manubrio 3×8-10 @9kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 3×6-8 @57.5kg; Romanian deadlift 3×6-8 @45kg; Affondi 3×8-10 @11kg; Hip thrust 3×8-10 @35kg; Leg curl machine 3×10-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1798 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Marta, 30 anni — pranza fuori casa quasi ogni giorno

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Impiegata, 58 kg per 163 cm, vuole tonificarsi. Mangia fuori 5 volte a settimana (schiscetta o bar), 4 pasti con una merenda.
- **Cosa ci aspettiamo:** Pranzi trasportabili (insalate, bowl, panini) e piatti vari nella settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 30 anni · 163 cm · 58 kg → 56 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1288 / 1670 kcal |
| Target calorico | **1670 kcal** (0% sul fabbisogno) |
| Macro | P 93 g (1.6 g/kg) · C 198 g · G 56 g |
| Idratazione | 2030 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1670 kcal → 2·1670 kcal → 3·1670 kcal → 4·1670 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 150g, Muesli 55g a secco, Kiwi 2 kiwi, Mandorle 10g | 446 |
| Pranzo 13:00 | Petto di pollo 100g a crudo, Riso basmati 95g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 599 |
| Spuntino pomeriggio 17:00 | Yogurt greco 0% 100g, Fiocchi d'avena 40g a secco | 206 |
| Cena 20:00 | Sgombro 110g a crudo, Patate 395g a crudo, Lattuga 60g, Olio extravergine di oliva 5g | 569 |

Totale Lun: **1819 kcal** · P 99 g · C 230 g · G 50 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Bevanda di soia non zuccherata 300 ml, Cereali integrali 25g a secco, Banana 1 banana, Mandorle 15g | 392 |
| Pranzo 13:00 | Manzo magro 115g a crudo, Riso 70g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 560 |
| Spuntino pomeriggio 17:00 | Tonno al naturale 60g, Crackers integrali 30g, Pomodori 40g | 199 |
| Cena 20:00 | _pasto libero_ | 487 |

Totale Sab: **1149 kcal** · P 66 g · C 127 g · G 38 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×6-8 @32.5kg; Military press 4×6-8 @20kg; Dip alle parallele 3×8-12; Alzate laterali 3×12-15 @2.5kg; Chest press macchina 3×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×6-8 @55kg; Trazioni zavorrate 4×6-8; Rematore con bilanciere 3×8-12 @22.5kg; Curl bicipiti 3×12-15 @8kg; Lat machine 3×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×6-8 @45kg; Romanian deadlift 4×6-8 @37.5kg; Leg press 3×8-12 @55kg; Affondi 3×8-12 @9kg; Hip thrust 3×8-12 @27.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 3×6-8 @35kg; Military press 3×6-8 @22.5kg; Alzate laterali 3×10-12 @3kg; Chest press macchina 3×8-10; Push-up 3×8-10 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 3×6-8 @60kg; Trazioni zavorrate 3×6-8; Curl bicipiti 3×10-12 @9kg; Lat machine 3×8-10; Rematore con manubrio 3×8-10 @8kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 3×6-8 @47.5kg; Romanian deadlift 3×6-8 @40kg; Affondi 3×8-10 @10kg; Hip thrust 3×8-10 @32.5kg; Leg curl machine 3×10-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1670 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Luigi, 55 anni — pescetariano, vuole perdere pancia

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Geometra, 88 kg per 175 cm. Non mangia carne ma mangia pesce, uova e latticini. 3 pasti, cammina molto.
- **Cosa ci aspettiamo:** Dieta senza carne ma con pesce, uova, legumi e latticini, varia nella settimana.

| Dati | Valore |
|---|---|
| Profilo | male · 55 anni · 175 cm · 88 kg → 82 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1704 / 2278 kcal |
| Target calorico | **1822 kcal** (-20% sul fabbisogno) |
| Macro | P 136 g (1.5 g/kg) · C 180 g · G 62 g |
| Idratazione | 3080 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1822 kcal → 2·1822 kcal → 3·1822 kcal → 4·1822 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 300g, Muesli 50g a secco, Kiwi 2 kiwi, Mandorle 15g | 563 |
| Pranzo 13:00 | Tonno al naturale 145g, Pasta 115g a secco, Pomodori 100g, Olio extravergine di oliva 20g | 769 |
| Cena 20:00 | Merluzzo 220g a crudo, Riso basmati 90g a secco, Carote 100g, Olio extravergine di oliva 20g | 708 |

Totale Lun: **2039 kcal** · P 135 g · C 223 g · G 63 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 250g, Gallette di riso 2 gallette, Banana 1 banana | 434 |
| Pranzo 13:00 | Uova intere 3 uova, Lenticchie 350g, Carote 100g, Olio extravergine di oliva 10g | 703 |
| Cena 20:00 | _pasto libero_ | 588 |

Totale Sab: **1136 kcal** · P 80 g · C 99 g · G 39 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×6-8 @47.5kg; Military press 4×6-8 @32.5kg; Dip alle parallele 3×8-12; Alzate laterali 3×12-15 @4kg; Chest press macchina 3×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×6-8 @85kg; Trazioni zavorrate 4×6-8; Rematore con bilanciere 3×8-12 @32.5kg; Curl bicipiti 3×12-15 @12kg; Lat machine 3×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×6-8 @67.5kg; Romanian deadlift 4×6-8 @55kg; Leg press 3×8-12 @82.5kg; Affondi 3×8-12 @12kg; Hip thrust 3×8-12 @42.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 3×6-8 @50kg; Military press 3×6-8 @35kg; Alzate laterali 3×10-12 @4.5kg; Chest press macchina 3×8-10; Push-up 3×8-10 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 3×6-8 @90kg; Trazioni zavorrate 3×6-8; Curl bicipiti 3×10-12 @13kg; Lat machine 3×8-10; Rematore con manubrio 3×8-10 @12kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 3×6-8 @75kg; Romanian deadlift 3×6-8 @60kg; Affondi 3×8-10 @14kg; Hip thrust 3×8-10 @47.5kg; Leg curl machine 3×10-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1822 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Sara, 26 anni — sceglie i suoi alimenti preferiti

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Grafica, 60 kg per 168 cm, forma fisica. Nel questionario sceglie i suoi alimenti preferiti per proteine, carboidrati, grassi, frutta e verdura (selettori per componente).
- **Cosa ci aspettiamo:** Gli alimenti scelti compaiono nelle diete, mese dopo mese; il piano resta vario.

| Dati | Valore |
|---|---|
| Profilo | female · 26 anni · 168 cm · 60 kg → 60 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1359 / 1761 kcal |
| Target calorico | **1761 kcal** (0% sul fabbisogno) |
| Macro | P 96 g (1.6 g/kg) · C 211 g · G 59 g |
| Idratazione | 2100 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1761 kcal → 2·1761 kcal → 3·1761 kcal → 4·1761 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 145g, Muesli 55g a secco, Kiwi 2 kiwi, Mandorle 15g | 473 |
| Pranzo 13:00 | Ricotta magra 125g, Pasta integrale 115g a secco, Spinaci 150g, Olio extravergine di oliva 10g | 665 |
| Spuntino pomeriggio 17:00 | Fesa di tacchino affettata 30g, Pane integrale 60g, Avocado 30g | 227 |
| Cena 20:00 | Petto di tacchino 100g a crudo, Patate dolci 335g a crudo, Cavolini di Bruxelles 150g, Olio extravergine di oliva 15g | 615 |

Totale Lun: **1979 kcal** · P 102 g · C 239 g · G 58 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 195g, Pane integrale 70g, Marmellata light 20g | 400 |
| Pranzo 13:00 | Tonno al naturale 70g, Farro 90g a secco, Pomodori 100g, Olio extravergine di oliva 15g | 564 |
| Spuntino pomeriggio 17:00 | Yogurt greco 2% 100g, Frutti di bosco 225g | 171 |
| Cena 20:00 | _pasto libero_ | 514 |

Totale Sab: **1135 kcal** · P 70 g · C 130 g · G 33 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×6-8 @32.5kg; Military press 4×6-8 @20kg; Dip alle parallele 3×8-12; Alzate laterali 3×12-15 @2.5kg; Chest press macchina 3×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×6-8 @57.5kg; Trazioni zavorrate 4×6-8; Rematore con bilanciere 3×8-12 @25kg; Curl bicipiti 3×12-15 @8kg; Lat machine 3×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×6-8 @47.5kg; Romanian deadlift 4×6-8 @37.5kg; Leg press 3×8-12 @57.5kg; Affondi 3×8-12 @9kg; Hip thrust 3×8-12 @27.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 3×6-8 @35kg; Military press 3×6-8 @22.5kg; Alzate laterali 3×10-12 @3kg; Chest press macchina 3×8-10; Push-up 3×8-10 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 3×6-8 @62.5kg; Trazioni zavorrate 3×6-8; Curl bicipiti 3×10-12 @9kg; Lat machine 3×8-10; Rematore con manubrio 3×8-10 @8kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 3×6-8 @50kg; Romanian deadlift 3×6-8 @40kg; Affondi 3×8-10 @10kg; Hip thrust 3×8-10 @32.5kg; Leg curl machine 3×10-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `Q2` Risposte non presenti nello schema: excludedFoods, includedFoods
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1761 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---
