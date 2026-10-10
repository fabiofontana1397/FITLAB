# Test dei piani generati dai questionari

Generato il 2026-10-10 14:42 — 21 questionari finti, piani creati con i generatori reali dell’app.

**Totale:** 0 errori · 5 avvisi · 35 note

| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |
|---|---|---|---|---|---|---|
| Sofia, 16 anni | 1703 | 88/209/57 | 4 | 2/0 | 0 | 0 |
| Matteo, 17 anni | 2601 | 118/337/87 | 5 | 3/0 | 0 | 0 |
| Giulia, 24 anni | 1506 | 112/152/50 | 4 | 3/0 | 0 | 5 |
| Luca, 22 anni | 2759 | 129/353/92 | 9 | 5/0 | 0 | 0 |
| Alessandro, 29 anni | 3370 | 128/463/112 | 4 | 4/2 | 0 | 0 |
| Marco, 32 anni | 1913 | 143/192/64 | 6 | 3/0 | 0 | 0 |
| Chiara, 25 anni | 1591 | 119/160/53 | 3 | 2/2 | 0 | 0 |
| Paolo, 38 anni | 2579 | 108/344/86 | 4 | 0/4 | 0 | 0 |
| Andrea, 40 anni | 1702 | 127/170/57 | 3 | –/– | 0 | 0 |
| Ilaria, 29 anni | 2143 | 122/254/71 | 5 | 4/0 | 0 | 0 |
| Anna, 52 anni | 1238 | 92/107/49 | 5 | 2/0 | 0 | 0 |
| Roberto, 58 anni | 2387 | 115/302/80 | 4 | 2/0 | 0 | 0 |
| Franco, 60 anni | 1892 | 109/223/63 | 4 | 1/0 | 0 | 0 |
| Tommaso, 35 anni | 2184 | 128/254/73 | 4 | 1/0 | 0 | 0 |
| Nina, 33 anni | 1586 | 118/159/53 | 4 | 3/0 | 0 | 0 |
| Omar, 41 anni | 1734 | 130/171/59 | 5 | –/– | 0 | 0 |
| Elena, 27 anni | 1420 | 106/144/47 | 3 | 3/0 | 0 | 0 |
| Davide, 45 anni | 1805 | 135/181/60 | 4 | 3/0 | 0 | 0 |
| Paola, 36 anni | 1798 | 106/209/60 | 4 | 3/0 | 0 | 0 |
| Marta, 30 anni | 1670 | 93/199/56 | 4 | 3/0 | 0 | 0 |
| Luigi, 55 anni | 1822 | 136/180/62 | 4 | 3/0 | 0 | 0 |

## Simulazione: ricalibrazione mensile su 6 mesi

Un corpo virtuale segue il piano; a fine mese l’agente di ricalibrazione vede le pesate (con rumore) e l’aderenza e rielabora dieta e allenamento. Si verifica che il peso vada verso l’obiettivo anche se il metabolismo reale si discosta dal modello del ±10%, e che con bassa aderenza non si corregga sui numeri.

### Sofia, 16 anni — studentessa, vuole tonificarsi

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 55 → 55.2 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 55 → 57.7 kg | 0.16 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 55 → 52.5 kg | -0.15 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
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
| Modello accurato, piano seguito | 62 → 56.5 kg | -0.32 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 62 → 58.2 kg | -0.22 kg/sett. | too_slow › on_track › on_track › on_track | -100, -100, -100, -100 |
| Metabolismo più veloce del 10% | 62 → 54.6 kg | -0.43 kg/sett. | on_track › too_fast › on_track › on_track | 0, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 61.6 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Luca, 22 anni — massa muscolare, esperto

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 68 → 73.1 kg | 0.20 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 68 → 74.7 kg | 0.26 kg/sett. | too_fast › too_fast › too_fast › on_track › on_track › too_slow | -100, -200, -300, -300, -300, -200 |
| Metabolismo più veloce del 10% | 68 → 71.4 kg | 0.13 kg/sett. | wrong_direction › on_track › on_track › plateau › on_track › on_track | 150, 150, 150, 300, 300, 300 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 68 → 89.2 kg | 0.82 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0, 0 |

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
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 92 → 91.3 kg | -0.02 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0, 0 |

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
| Modello accurato, piano seguito | 72 → 72.8 kg | 0.05 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
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
| Metabolismo più lento del 10% | 70 → 66.8 kg | -0.15 kg/sett. | too_slow › plateau › on_track › too_slow › too_slow | -38, -38, -38, -38, -38 |
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
| Modello accurato, piano seguito | 80 → 80.1 kg | 0.01 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 80 → 83 kg | 0.17 kg/sett. | on_track › on_track › too_fast › on_track | 0, 0, -100, -100 |
| Metabolismo più veloce del 10% | 80 → 76.7 kg | -0.20 kg/sett. | on_track › on_track › on_track › too_slow | 0, 0, 0, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 80 → 87.1 kg | 0.41 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Nina, 33 anni — dimagrimento senza peso obiettivo

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 70 → 64.3 kg | -0.33 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 70 → 66 kg | -0.23 kg/sett. | too_slow › on_track › on_track › on_track | -100, -100, -100, -100 |
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
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 62 → 61.9 kg | -0.00 kg/sett. | low_adherence › low_adherence › low_adherence | 0, 0, 0 |

### Davide, 45 anni — niente uova né pesce

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 84 → 77.7 kg | -0.37 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 84 → 79.8 kg | -0.24 kg/sett. | on_track › too_slow › on_track › on_track | 0, -100, -100, -100 |
| Metabolismo più veloce del 10% | 84 → 75.1 kg | -0.52 kg/sett. | too_fast › on_track › on_track › on_track | 100, 100, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 84 → 84 kg | 0.00 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

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
| Metabolismo più lento del 10% | 58 → 60.7 kg | 0.16 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più veloce del 10% | 58 → 55.7 kg | -0.14 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 58 → 63.8 kg | 0.34 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

### Luigi, 55 anni — pescetariano, vuole perdere pancia

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 88 → 81.3 kg | -0.39 kg/sett. | on_track › on_track › on_track › on_track | 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 88 → 82.9 kg | -0.30 kg/sett. | too_slow › too_slow › on_track › on_track | -100, -200, -200, -200 |
| Metabolismo più veloce del 10% | 88 → 78.5 kg | -0.55 kg/sett. | on_track › on_track › too_fast › on_track | 0, 0, 100, 100 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 88 → 87.6 kg | -0.03 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0 |

---

## Sofia, 16 anni — studentessa, vuole tonificarsi

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Ragazza di 16 anni, 55 kg per 165 cm, vita da studente (sedentaria), mai fatto palestra. 2 allenamenti a settimana.
- **Cosa ci aspettiamo:** Sotto i 18 anni nessun deficit: calorie di mantenimento, proteine moderate, scheda principiante con 2 sedute full body.

| Dati | Valore |
|---|---|
| Profilo | female · 16 anni · 165 cm · 55 kg → 55 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1340 / 1703 kcal |
| Target calorico | **1703 kcal** (0% sul fabbisogno) |
| Macro | P 88 g (1.6 g/kg) · C 209 g · G 57 g |
| Idratazione | 1925 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1703 kcal → 2·1703 kcal → 3·1703 kcal → 4·1703 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 80g a crudo, Fiocchi d'avena 75g a secco, Mirtilli 125g, Mandorle 20g | 511 |
| Pranzo 13:00 | Tonno al naturale 60g, Pasta integrale 130g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 689 |
| Cena 20:00 | Petto di pollo 100g a crudo, Riso integrale 95g a secco, Carote 80g, Finocchi 120g, Olio extravergine di oliva 15g | 636 |

Totale Lun: **1836 kcal** · P 89 g · C 229 g · G 55 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 140g, Fiocchi d'avena 30g a secco, Pera 2 pere, Mandorle 20g | 449 |
| Pranzo 13:00 | Tofu 205g, Quinoa 110g a secco, Zucchine 150g, Olio extravergine di oliva 5g | 656 |
| Cena 20:00 | _pasto libero_ | 581 |

Totale Sab: **1104 kcal** · P 57 g · C 130 g · G 34 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×10 @13kg; Trazioni alla sbarra 3×10; Military press 3×10 @9kg; Curl bicipiti 3×10 @4kg; Chest press macchina 3×10 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×10 @19kg; Romanian deadlift 3×10 @15kg; Leg press 3×10 @25kg; Affondi 3×10 @4kg; Hip thrust 3×10 @13kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×10 @16kg; Trazioni alla sbarra 3×10; Military press 3×10 @11kg; Curl bicipiti 3×10 @4.5kg; Chest press macchina 3×10 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×10 @22.5kg; Romanian deadlift 3×10 @19kg; Leg press 3×10 @30kg; Affondi 3×10 @4.5kg; Hip thrust 3×10 @16kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1703 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Matteo, 17 anni — magro, vuole mettere massa

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Yogurt greco 0% 145g, Fiocchi d'avena 95g a secco, Mela 2 mele, Noci 20g | 733 |
| Pranzo 13:00 | Tonno al naturale 95g, Riso 80g a secco, Pane integrale 160g, Pomodori 80g, Cetrioli 80g, Olio extravergine di oliva 25g | 1033 |
| Cena 20:00 | Petto di pollo 130g a crudo, Riso integrale 130g a secco, Carote 80g, Finocchi 120g, Olio extravergine di oliva 25g | 886 |

Totale Lun: **2653 kcal** · P 118 g · C 340 g · G 82 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Pane di segale 160g, Arancia 1 arancia | 698 |
| Pranzo 13:00 | Ricotta magra 170g, Tofu 110g, Pasta 130g a secco, Spinaci 120g, Carciofi 120g, Olio extravergine di oliva 15g | 932 |
| Cena 20:00 | _pasto libero_ | 886 |

Totale Sab: **1629 kcal** · P 82 g · C 197 g · G 51 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×12 @30kg; Panca piana 3×12 @20kg; Rematore con bilanciere 3×12 @16kg; Plank 3×12; Leg press 3×12 @40kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×12 @30kg; Panca piana 3×12 @20kg; Rematore con bilanciere 3×12 @16kg; Plank 3×12; Leg press 3×12 @40kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×12 @30kg; Panca piana 3×12 @20kg; Rematore con bilanciere 3×12 @16kg; Plank 3×12; Leg press 3×12 @40kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 5×8-12 @37.5kg; Panca piana 5×8-12 @25kg; Plank 5×8-12; Leg press 5×8-12 @52.5kg; Chest press macchina 5×8-12 |
| Mar | Riposo | |
| Mer | Full Body | Back squat 5×8-12 @37.5kg; Panca piana 5×8-12 @25kg; Plank 5×8-12; Leg press 5×8-12 @52.5kg; Chest press macchina 5×8-12 |
| Gio | Riposo | |
| Ven | Full Body | Back squat 5×8-12 @37.5kg; Panca piana 5×8-12 @25kg; Plank 5×8-12; Leg press 5×8-12 @52.5kg; Chest press macchina 5×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (2601 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Giulia, 24 anni — vuole dimagrire qualche kg

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 5 avvisi, 1 note)

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
| Colazione 07:30 | Yogurt greco 2% 280g, Avena istantanea 30g a secco, Mela 1 mela, Mandorle 10g | 445 |
| Pranzo 13:00 | Uova intere 2 uova, Albume d'uovo 140g a crudo, Pane integrale 140g, Bietole 150g, Olio extravergine di oliva 5g | 631 |
| Cena 20:00 | Fagioli borlotti 195g, Parmigiano Reggiano 35g, Farro 40g a secco, Zucchine 150g, Olio extravergine di oliva 5g | 590 |

Totale Lun: **1665 kcal** · P 112 g · C 174 g · G 49 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt magro 125g, Yogurt proteico 190g, Fiocchi d'avena 20g a secco, Mela 1 mela, Noci 15g | 413 |
| Pranzo 13:00 | Seitan 140g, Riso integrale 50g a secco, Broccoli 120g, Peperoni 120g, Olio extravergine di oliva 15g | 573 |
| Cena 20:00 | _pasto libero_ | 505 |

Totale Sab: **985 kcal** · P 73 g · C 95 g · G 31 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×15 @22.5kg; Panca piana 3×15 @14kg; Rematore con bilanciere 3×15 @12kg; Plank 3×15; Leg press 3×15 @30kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×15 @22.5kg; Panca piana 3×15 @14kg; Rematore con bilanciere 3×15 @12kg; Plank 3×15; Leg press 3×15 @30kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×15 @22.5kg; Panca piana 3×15 @14kg; Rematore con bilanciere 3×15 @12kg; Plank 3×15; Leg press 3×15 @30kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×12-15 @25kg; Panca piana 3×12-15 @18kg; Rematore con bilanciere 3×12-15 @15kg; Plank 3×12-15; Leg press 3×12-15 @37.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×12-15 @25kg; Panca piana 3×12-15 @18kg; Rematore con bilanciere 3×12-15 @15kg; Plank 3×12-15; Leg press 3×12-15 @37.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×12-15 @25kg; Panca piana 3×12-15 @18kg; Rematore con bilanciere 3×12-15 @15kg; Plank 3×12-15; Leg press 3×12-15 @37.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `D5` Proteine: i pasti danno in media il 94% del target (giorno peggiore: 17% di scarto)
- ⚠️ `Q6` Mar (mese 1): stessa fonte proteica a pranzo e cena (legumes)
- ⚠️ `Q6` Ven (mese 1): stessa fonte proteica a pranzo e cena (cheese)
- ⚠️ `Q6` Gio (mese 2): stessa fonte proteica a pranzo e cena (legumes)
- ⚠️ `Q6` Mer (mese 3): stessa fonte proteica a pranzo e cena (legumes)
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1506 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Luca, 22 anni — massa muscolare, esperto

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 10 note)

- **Chi è:** Studente magro (68 kg per 180 cm), vuole arrivare a 75 kg. Esperto, 5 allenamenti a settimana da 60-90 min, 5 pasti.
- **Cosa ci aspettiamo:** Surplus controllato, proteine ~1,9 g/kg, split a 5 giorni senza mese di adattamento, progressione di carichi mese dopo mese.

| Dati | Valore |
|---|---|
| Profilo | male · 22 anni · 180 cm · 68 kg → 75 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1700 / 2555 kcal |
| Target calorico | **2759 kcal** (8% sul fabbisogno) |
| Macro | P 129 g (1.9 g/kg) · C 353 g · G 92 g |
| Idratazione | 2730 ml |
| Durata piano | 9 mesi |

**Piano alimentare** — mesi: 1·2759 kcal → 2·2759 kcal → 3·2759 kcal → 4·2759 kcal → 5·2759 kcal → 6·2759 kcal → 7·2759 kcal → 8·2759 kcal → 9·2759 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 135g, Avena istantanea 95g a secco, Mirtilli 150g, Noci 15g | 636 |
| Spuntino mattina 10:30 | Yogurt greco 0% 100g, Mela 2 mele, Semi di chia 5g, Semi di lino 15g | 315 |
| Pranzo 13:00 | Ceci 300g, Quinoa 70g a secco, Peperoni 120g, Zucchine 120g, Olio extravergine di oliva 15g | 910 |
| Spuntino pomeriggio 17:00 | Yogurt greco 2% 105g, Uva 200g, Pistacchi 15g | 301 |
| Cena 20:00 | Manzo magro 100g a crudo, Pasta 130g a secco, Rucola 30g, Pomodori 80g, Passata di pomodoro 60g, Olio extravergine di oliva 15g | 758 |

Totale Lun: **2919 kcal** · P 133 g · C 368 g · G 86 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Pane di segale 130g, Kiwi 2 kiwi | 632 |
| Spuntino mattina 10:30 | Parmigiano Reggiano 35g, Mela 2 mele | 293 |
| Pranzo 13:00 | Tofu 115g, Seitan 80g, Riso integrale 125g a secco, Broccoli 120g, Peperoni 120g, Olio extravergine di oliva 15g | 862 |
| Spuntino pomeriggio 17:00 | Ceci 120g, Crackers integrali 20g, Finocchi 60g, Olio extravergine di oliva 5g | 321 |
| Cena 20:00 | _pasto libero_ | 777 |

Totale Sab: **2109 kcal** · P 100 g · C 258 g · G 66 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @40kg; Military press 4×8-12 @27.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12; Push-up 4×8-12 |
| Mar | Pull | Stacco da terra 4×8-12 @70kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @12kg; Lat machine 4×8-12; Rematore con manubrio 4×8-12 @9kg |
| Mer | Riposo | |
| Gio | Legs | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @77.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg; Leg curl machine 4×8-12 |
| Ven | Upper | Panca piana 4×8-12 @40kg; Trazioni alla sbarra 4×8-12; Military press 4×8-12 @27.5kg; Curl bicipiti 4×8-12 @12kg; Chest press macchina 4×8-12; Lat machine 4×8-12 |
| Sab | Lower | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @77.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg; Leg curl machine 4×8-12 |
| Dom | Riposo | |

**Mese 9 — Mese 9 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×8-12 @47.5kg; Military press 5×8-12 @32.5kg; Push-up 5×8-12; Dip alle parallele 5×8-12; Alzate laterali 5×8-12 @5kg; Chest press macchina 5×8-12 |
| Mar | Pull | Stacco da terra 5×8-12 @85kg; Trazioni zavorrate 5×8-12; Rematore con manubrio 5×8-12 @11kg; Rematore con bilanciere 5×8-12 @40kg; Curl bicipiti 5×8-12 @14kg; Lat machine 5×8-12 |
| Mer | Riposo | |
| Gio | Legs | Back squat 5×8-12 @70kg; Romanian deadlift 5×8-12 @57.5kg; Leg curl machine 5×8-12; Abductor machine 5×8-12; Polpacci alla macchina 5×8-12; Leg press 5×8-12 @92.5kg |
| Ven | Upper | Panca piana 5×8-12 @47.5kg; Trazioni alla sbarra 5×8-12; Lat machine 5×8-12; Military press 5×8-12 @32.5kg; Curl bicipiti 5×8-12 @14kg; Chest press macchina 5×8-12 |
| Sab | Lower | Back squat 5×8-12 @70kg; Romanian deadlift 5×8-12 @57.5kg; Leg curl machine 5×8-12; Abductor machine 5×8-12; Polpacci alla macchina 5×8-12; Leg press 5×8-12 @92.5kg |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (2759 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q6` Lun (mese 1): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Lun (mese 2): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Lun (mese 3): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Lun (mese 4): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Lun (mese 5): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Mar (mese 6): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Mar (mese 7): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Lun (mese 8): una fonte proteica compare tre volte nel giorno
- ℹ️ `Q6` Mar (mese 9): una fonte proteica compare tre volte nel giorno

---

## Alessandro, 29 anni — molto attivo, anni di esperienza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

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
| Colazione 07:30 | Yogurt magro 300g, Fiocchi d'avena 100g a secco, Mela 2 mele, Nocciole 40g | 917 |
| Pranzo 13:00 | Uova intere 2 uova, Tonno al naturale 60g, Riso basmati 130g a secco, Pane integrale 160g, Pomodori 80g, Cetrioli 80g, Olio extravergine di oliva 25g | 1311 |
| Cena 20:00 | Salmone 100g a crudo, Riso basmati 130g a secco, Pane integrale 140g, Asparagi 150g, Olio extravergine di oliva 20g | 1222 |

Totale Lun: **3449 kcal** · P 133 g · C 454 g · G 111 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Latte senza lattosio 300g, Skyr 105g, Crema di riso 70g a secco, Pera 2 pere, Burro di mandorle 100% 30g, Burro di arachidi 100% 20g | 912 |
| Pranzo 13:00 | Tonno al naturale 95g, Riso integrale 130g a secco, Pane integrale 160g, Carote 80g, Lattuga 50g, Olio extravergine di oliva 25g | 1241 |
| Cena 20:00 | _pasto libero_ | 1187 |

Totale Sab: **2153 kcal** · P 88 g · C 287 g · G 65 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×3-5 @45kg; Military press 5×3-5 @32.5kg; Dip alle parallele 5×3-5; Alzate laterali 5×3-5 @4.5kg; Chest press macchina 5×3-5; Push-up 5×3-5 |
| Mar | Pull | Stacco da terra 5×3-5 @82.5kg; Trazioni zavorrate 5×3-5; Rematore con bilanciere 5×3-5 @37.5kg; Curl bicipiti 5×3-5 @14kg; Lat machine 5×3-5; Rematore con manubrio 5×3-5 @11kg |
| Mer | Legs | Back squat 5×3-5 @70kg; Romanian deadlift 5×3-5 @55kg; Leg press 5×3-5 @92.5kg; Affondi 5×3-5 @14kg; Hip thrust 5×3-5 @45kg; Leg curl machine 5×3-5 |
| Gio | Riposo | |
| Ven | Upper | Panca piana 5×3-5 @45kg; Trazioni alla sbarra 5×3-5; Military press 5×3-5 @32.5kg; Curl bicipiti 5×3-5 @14kg; Chest press macchina 5×3-5; Lat machine 5×3-5 |
| Sab | Corsa | Corsa facile 35-40 min |
| Dom | Corsa | Corsa a ritmo medio 30 min |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×3-5 @47.5kg; Military press 5×3-5 @35kg; Alzate laterali 5×3-5 @5kg; Chest press macchina 5×3-5; Push-up 5×3-5; Dip alle parallele 5×3-5 |
| Mar | Pull | Stacco da terra 5×3-5 @90kg; Trazioni zavorrate 5×3-5; Curl bicipiti 5×3-5 @15kg; Lat machine 5×3-5; Rematore con manubrio 5×3-5 @12kg; Rematore con bilanciere 5×3-5 @40kg |
| Mer | Legs | Back squat 5×3-5 @75kg; Romanian deadlift 5×3-5 @60kg; Affondi 5×3-5 @15kg; Hip thrust 5×3-5 @47.5kg; Leg curl machine 5×3-5; Abductor machine 5×3-5 |
| Gio | Riposo | |
| Ven | Upper | Panca piana 5×3-5 @47.5kg; Trazioni alla sbarra 5×3-5; Curl bicipiti 5×3-5 @15kg; Chest press macchina 5×3-5; Lat machine 5×3-5; Military press 5×3-5 @35kg |
| Sab | Corsa | Corsa facile 35-40 min |
| Dom | Corsa | Corsa a ritmo medio 30 min |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (3370 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 2 sedute di corsa a settimana (es. "Corsa facile 35-40 min")

---

## Marco, 32 anni — dimagrimento, sedentario

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Impiegato sedentario, 92 kg per 178 cm, vuole scendere a 82 kg. Mai fatto palestra, 3 giorni a settimana, 45-60 min.
- **Cosa ci aspettiamo:** Deficit moderato (non estremo), proteine alte ma non esagerate, durata di circa 6-9 mesi, scheda full body principiante.

| Dati | Valore |
|---|---|
| Profilo | male · 32 anni · 178 cm · 92 kg → 82 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1878 / 2391 kcal |
| Target calorico | **1913 kcal** (-20% sul fabbisogno) |
| Macro | P 143 g (1.6 g/kg) · C 192 g · G 64 g |
| Idratazione | 3220 ml |
| Durata piano | 6 mesi |

**Piano alimentare** — mesi: 1·1913 kcal → 2·1913 kcal → 3·1913 kcal → 4·1913 kcal → 5·1913 kcal → 6·1913 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 255g, Fiocchi d'avena 55g a secco, Mirtilli 125g, Mandorle 25g | 573 |
| Pranzo 13:00 | Petto di pollo 160g a crudo, Pasta integrale 120g a secco, Pomodori 100g, Pesto 40g | 789 |
| Cena 20:00 | Lonza di maiale magra 175g a crudo, Patate 400g a crudo, Cavolini di Bruxelles 150g, Olio extravergine di oliva 15g | 737 |

Totale Lun: **2098 kcal** · P 143 g · C 220 g · G 63 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Mozzarella 100g, Pane di segale 90g, Kiwi 1 kiwi | 515 |
| Pranzo 13:00 | Tonno al naturale 160g, Pasta integrale 95g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 675 |
| Cena 20:00 | _pasto libero_ | 637 |

Totale Sab: **1190 kcal** · P 81 g · C 116 g · G 41 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×15 @32.5kg; Panca piana 3×15 @22.5kg; Rematore con bilanciere 3×15 @17kg; Plank 3×15; Leg press 3×15 @42.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×15 @32.5kg; Panca piana 3×15 @22.5kg; Rematore con bilanciere 3×15 @17kg; Plank 3×15; Leg press 3×15 @42.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×15 @32.5kg; Panca piana 3×15 @22.5kg; Rematore con bilanciere 3×15 @17kg; Plank 3×15; Leg press 3×15 @42.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 6 — Mese 6 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 4×12-15 @42.5kg; Panca piana 4×12-15 @27.5kg; Plank 4×12-15; Leg press 4×12-15 @55kg; Chest press macchina 4×12-15 |
| Mar | Riposo | |
| Mer | Full Body | Back squat 4×12-15 @42.5kg; Panca piana 4×12-15 @27.5kg; Plank 4×12-15; Leg press 4×12-15 @55kg; Chest press macchina 4×12-15 |
| Gio | Riposo | |
| Ven | Full Body | Back squat 4×12-15 @42.5kg; Panca piana 4×12-15 @27.5kg; Plank 4×12-15; Leg press 4×12-15 @55kg; Chest press macchina 4×12-15 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1913 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Chiara, 25 anni — palestra + corsa con 4 giorni disponibili

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Donna, 60 kg per 168 cm. Vorrebbe 3 palestra + 3 corsa ma ha solo 4 giorni disponibili. Obiettivo dimagrimento (−4 kg).
- **Cosa ci aspettiamo:** Il piano rispetta i 4 giorni disponibili, bilancia palestra e corsa, e le calorie contano l’allenamento realmente programmato.

| Dati | Valore |
|---|---|
| Profilo | female · 25 anni · 168 cm · 60 kg → 56 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1364 / 1989 kcal |
| Target calorico | **1591 kcal** (-20% sul fabbisogno) |
| Macro | P 119 g (2.0 g/kg) · C 160 g · G 53 g |
| Idratazione | 2450 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·1591 kcal → 2·1591 kcal → 3·1591 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 195g a crudo, Avena istantanea 45g a secco, Mirtilli 150g, Mandorle 20g | 467 |
| Pranzo 13:00 | Tonno al naturale 125g, Pasta integrale 95g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 636 |
| Cena 20:00 | Petto di pollo 145g a crudo, Riso rosso 70g a secco, Carote 80g, Finocchi 120g, Olio extravergine di oliva 15g | 587 |

Totale Lun: **1689 kcal** · P 119 g · C 171 g · G 53 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 1 uovo, Albume d'uovo 175g a crudo, Pane di segale 70g, Avocado 45g | 415 |
| Pranzo 13:00 | Petto di pollo 175g a crudo, Riso integrale 65g a secco, Melanzane 150g, Olio extravergine di oliva 15g | 590 |
| Cena 20:00 | _pasto libero_ | 526 |

Totale Sab: **1004 kcal** · P 78 g · C 89 g · G 34 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×12-15 @30kg; Trazioni alla sbarra 3×12-15; Military press 3×12-15 @20kg; Curl bicipiti 3×12-15 @9kg; Chest press macchina 3×12-15 |
| Mar | Lower | Back squat 3×12-15 @45kg; Romanian deadlift 3×12-15 @35kg; Leg press 3×12-15 @60kg; Affondi 3×12-15 @9kg; Hip thrust 3×12-15 @30kg |
| Mer | Riposo | |
| Gio | Corsa | Corsa facile 35 min |
| Ven | Corsa | Corsa a ritmo medio 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 3 — Mese 3 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×12-15 @30kg; Trazioni alla sbarra 3×12-15; Military press 3×12-15 @20kg; Curl bicipiti 3×12-15 @9kg; Chest press macchina 3×12-15 |
| Mar | Lower | Back squat 3×12-15 @47.5kg; Romanian deadlift 3×12-15 @37.5kg; Leg press 3×12-15 @62.5kg; Affondi 3×12-15 @9kg; Hip thrust 3×12-15 @30kg |
| Mer | Riposo | |
| Gio | Corsa | Corsa facile 35 min |
| Ven | Corsa | Corsa a ritmo medio 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1591 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 2 sedute di corsa a settimana (es. "Corsa facile 35 min")

---

## Paolo, 38 anni — solo corsa, resistenza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Runner amatoriale, 72 kg per 176 cm. Corre 4 volte a settimana, nessuna palestra, vuole migliorare la resistenza.
- **Cosa ci aspettiamo:** Nessuna seduta di palestra, 4 uscite di corsa varie (facili, medio, lungo), carboidrati abbondanti, calorie di mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 38 anni · 176 cm · 72 kg → 72 kg · obiettivo `improveEndurance` |
| Metabolismo basale / fabbisogno | 1635 / 2579 kcal |
| Target calorico | **2579 kcal** (0% sul fabbisogno) |
| Macro | P 108 g (1.5 g/kg) · C 344 g · G 86 g |
| Idratazione | 2870 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2579 kcal → 2·2622 kcal → 3·2622 kcal → 4·2622 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 100g, Fiocchi d'avena 95g a secco, Mela 2 mele, Nocciole 10g, Mandorle 20g | 756 |
| Pranzo 13:00 | Tonno al naturale 80g, Riso 80g a secco, Pane integrale 160g, Pomodori 80g, Cetrioli 80g, Olio extravergine di oliva 25g | 1017 |
| Cena 20:00 | Petto di pollo 115g a crudo, Riso integrale 130g a secco, Carote 80g, Finocchi 120g, Olio extravergine di oliva 25g | 870 |

Totale Lun: **2643 kcal** · P 109 g · C 340 g · G 85 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 180g, Cereali integrali 80g a secco, Frutti di bosco 250g, Noci 25g | 705 |
| Pranzo 13:00 | Ricotta magra 155g, Pasta 95g a secco, Pane integrale 90g, Spinaci 120g, Carciofi 120g, Olio extravergine di oliva 20g | 970 |
| Cena 20:00 | _pasto libero_ | 857 |

Totale Sab: **1674 kcal** · P 72 g · C 202 g · G 55 g

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

- ℹ️ `D14` Dal mese 2 in poi il target è identico (2622 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 4 sedute di corsa a settimana (es. "Corsa facile 30 min")

---

## Andrea, 40 anni — solo dieta

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

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
| Colazione 07:30 | Yogurt greco 0% 240g, Fiocchi d'avena 35g a secco, Pera 1 pera, Mandorle 25g | 486 |
| Pranzo 13:00 | Tonno al naturale 135g, Pasta integrale 95g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 647 |
| Cena 20:00 | Trota 175g a crudo, Riso basmati 70g a secco, Asparagi 150g, Olio extravergine di oliva 10g | 597 |

Totale Lun: **1728 kcal** · P 127 g · C 169 g · G 55 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 2 uova, Albume d'uovo 135g a crudo, Pane di segale 90g | 444 |
| Pranzo 13:00 | Tofu 140g, Ricotta magra 170g, Pasta integrale 80g a secco, Spinaci 120g, Carciofi 120g, Olio extravergine di oliva 5g | 690 |
| Cena 20:00 | _pasto libero_ | 592 |

Totale Sab: **1133 kcal** · P 81 g · C 111 g · G 36 g

_Nessun piano di allenamento generato._

**Controlli**

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
| Lun | Push | Panca piana 5×3-5 @37.5kg; Military press 5×3-5 @25kg; Dip alle parallele 5×3-5; Alzate laterali 5×3-5 @3.5kg; Chest press macchina 5×3-5; Push-up 5×3-5 |
| Mar | Pull | Stacco da terra 5×3-5 @65kg; Trazioni zavorrate 5×3-5; Rematore con bilanciere 5×3-5 @30kg; Curl bicipiti 5×3-5 @11kg; Lat machine 5×3-5; Rematore con manubrio 5×3-5 @9kg |
| Mer | Riposo | |
| Gio | Legs | Back squat 5×3-5 @55kg; Romanian deadlift 5×3-5 @45kg; Leg press 5×3-5 @72.5kg; Affondi 5×3-5 @11kg; Hip thrust 5×3-5 @37.5kg; Leg curl machine 5×3-5 |
| Ven | Upper | Panca piana 5×3-5 @37.5kg; Trazioni alla sbarra 5×3-5; Military press 5×3-5 @25kg; Curl bicipiti 5×3-5 @11kg; Chest press macchina 5×3-5; Lat machine 5×3-5 |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×3-5 @42.5kg; Military press 5×3-5 @27.5kg; Alzate laterali 5×3-5 @4kg; Chest press macchina 5×3-5; Push-up 5×3-5; Dip alle parallele 5×3-5 |
| Mar | Pull | Stacco da terra 5×3-5 @72.5kg; Trazioni zavorrate 5×3-5; Curl bicipiti 5×3-5 @12kg; Lat machine 5×3-5; Rematore con manubrio 5×3-5 @10kg; Rematore con bilanciere 5×3-5 @32.5kg |
| Mer | Riposo | |
| Gio | Legs | Back squat 5×3-5 @62.5kg; Romanian deadlift 5×3-5 @50kg; Affondi 5×3-5 @12kg; Hip thrust 5×3-5 @42.5kg; Leg curl machine 5×3-5; Abductor machine 5×3-5 |
| Ven | Upper | Panca piana 5×3-5 @42.5kg; Trazioni alla sbarra 5×3-5; Curl bicipiti 5×3-5 @12kg; Chest press macchina 5×3-5; Lat machine 5×3-5; Military press 5×3-5 @27.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `S4` Utente solo allenamento: la tab Nutrizione deve mostrare che il piano non è stato richiesto

---

## Anna, 52 anni — dimagrimento, sedentaria, fastidio al ginocchio

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Donna, 70 kg per 162 cm, vuole scendere a 64 kg. Sedentaria, principiante, 2 allenamenti. Fastidio al ginocchio quando sale le scale.
- **Cosa ci aspettiamo:** Deficit prudente, nessun esercizio che carichi il ginocchio, sedute brevi con pochi esercizi.

| Dati | Valore |
|---|---|
| Profilo | female · 52 anni · 162 cm · 70 kg → 64 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1292 / 1548 kcal |
| Target calorico | **1238 kcal** (-20% sul fabbisogno) |
| Macro | P 92 g (1.3 g/kg) · C 107 g · G 49 g |
| Idratazione | 2450 ml |
| Durata piano | 5 mesi |

**Piano alimentare** — mesi: 1·1238 kcal → 2·1238 kcal → 3·1238 kcal → 4·1238 kcal → 5·1238 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 210g, Avena istantanea 20g a secco, Mirtilli 100g, Mandorle 15g | 368 |
| Pranzo 13:00 | Tonno al naturale 95g, Pasta integrale 70g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 513 |
| Cena 20:00 | Gamberi 140g a crudo, Riso lungo B 45g a secco, Zucca 200g, Olio extravergine di oliva 15g | 455 |

Totale Lun: **1337 kcal** · P 92 g · C 126 g · G 48 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Pane integrale 30g, Arancia 1 arancia | 344 |
| Pranzo 13:00 | Petto di tacchino 130g a crudo, Riso integrale 45g a secco, Melanzane 150g, Olio extravergine di oliva 15g | 468 |
| Cena 20:00 | _pasto libero_ | 420 |

Totale Sab: **810 kcal** · P 58 g · C 64 g · G 33 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×15 @16kg; Trazioni alla sbarra 3×15; Military press 3×15 @11kg; Curl bicipiti 3×15 @5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Romanian deadlift 3×15 @20kg; Hip thrust 3×15 @16kg; Abductor machine 3×15; Polpacci alla macchina 3×15 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 4×12-15 @20kg; Trazioni alla sbarra 4×12-15; Curl bicipiti 4×12-15 @6kg; Chest press macchina 4×12-15 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Romanian deadlift 4×12-15 @25kg; Hip thrust 4×12-15 @20kg; Abductor machine 4×12-15; Polpacci alla macchina 4×12-15 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1238 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Roberto, 58 anni — salute generale, lavoro in piedi

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Albume d'uovo 110g a crudo, Fiocchi d'avena 85g a secco, Mela 2 mele, Burro di arachidi 100% 10g, Mandorle 20g | 709 |
| Pranzo 13:00 | Tonno al naturale 100g, Riso 80g a secco, Pane integrale 130g, Pomodori 80g, Cetrioli 80g, Olio extravergine di oliva 25g | 965 |
| Cena 20:00 | Salmone 125g a crudo, Riso basmati 130g a secco, Asparagi 150g, Olio extravergine di oliva 10g | 834 |

Totale Lun: **2506 kcal** · P 114 g · C 316 g · G 80 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 215g, Crema di riso 40g a secco, Mela 2 mele, Burro di mandorle 100% 15g, Noci 20g | 657 |
| Pranzo 13:00 | Mozzarella light 125g, Pasta 130g a secco, Pomodori 80g, Rucola 30g, Olio extravergine di oliva 15g | 839 |
| Cena 20:00 | _pasto libero_ | 818 |

Totale Sab: **1496 kcal** · P 72 g · C 177 g · G 52 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×10 @19kg; Trazioni alla sbarra 3×10; Military press 3×10 @13kg; Curl bicipiti 3×10 @6kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×10 @30kg; Romanian deadlift 3×10 @22.5kg; Leg press 3×10 @37.5kg; Affondi 3×10 @6kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×10 @22.5kg; Trazioni alla sbarra 3×10; Military press 3×10 @17kg; Curl bicipiti 3×10 @7kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Back squat 3×10 @37.5kg; Romanian deadlift 3×10 @27.5kg; Leg press 3×10 @47.5kg; Affondi 3×10 @7kg |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (2387 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Franco, 60 anni — pensionato, un solo giorno

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Yogurt greco 0% 145g, Avena istantanea 65g a secco, Mirtilli 150g, Mandorle 25g | 560 |
| Pranzo 13:00 | Uova intere 2 uova, Tonno al naturale 75g, Riso basmati 110g a secco, Pomodori 80g, Cetrioli 80g, Olio extravergine di oliva 15g | 768 |
| Cena 20:00 | Sgombro 140g a crudo, Riso integrale 105g a secco, Zucchine 150g, Olio extravergine di oliva 5g | 688 |

Totale Lun: **2014 kcal** · P 107 g · C 235 g · G 67 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 200g, Fiocchi d'avena 55g a secco, Mela 1 mela, Nocciole 20g | 533 |
| Pranzo 13:00 | Ricotta magra 115g, Tofu 130g, Pasta 100g a secco, Spinaci 120g, Carciofi 120g, Olio extravergine di oliva 10g | 741 |
| Cena 20:00 | _pasto libero_ | 654 |

Totale Sab: **1273 kcal** · P 71 g · C 143 g · G 41 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×10 @27.5kg; Panca piana 3×10 @18kg; Rematore con bilanciere 3×10 @15kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×10 @35kg; Panca piana 3×10 @22.5kg; Rematore con bilanciere 3×10 @18kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1892 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Tommaso, 35 anni — si allena una volta ogni due settimane

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Skyr 150g, Avena istantanea 95g a secco, Mirtilli 125g, Mandorle 25g | 665 |
| Pranzo 13:00 | Uova intere 3 uova, Tonno al naturale 75g, Riso 130g a secco, Pomodori 80g, Cetrioli 80g, Olio extravergine di oliva 10g | 860 |
| Cena 20:00 | Trota 160g a crudo, Riso basmati 125g a secco, Asparagi 150g, Olio extravergine di oliva 15g | 816 |

Totale Lun: **2340 kcal** · P 129 g · C 286 g · G 71 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Pane integrale 150g | 581 |
| Pranzo 13:00 | Tofu 220g, Ricotta magra 75g, Pasta integrale 125g a secco, Spinaci 120g, Carciofi 120g, Olio extravergine di oliva 10g | 866 |
| Cena 20:00 | _pasto libero_ | 751 |

Totale Sab: **1446 kcal** · P 81 g · C 161 g · G 46 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 4×8-12 @60kg; Panca piana 4×8-12 @40kg; Rematore con bilanciere 4×8-12 @32.5kg; Plank 4×8-12; Leg press 4×8-12 @80kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 5×8-12 @65kg; Panca piana 5×8-12 @42.5kg; Plank 5×8-12; Leg press 5×8-12 @87.5kg; Chest press macchina 5×8-12 |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (2184 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Nina, 33 anni — dimagrimento senza peso obiettivo

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Yogurt greco 2% 285g, Fiocchi d'avena 30g a secco, Mirtilli 150g, Noci 10g | 470 |
| Pranzo 13:00 | Tonno al naturale 120g, Pasta integrale 100g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 648 |
| Cena 20:00 | Trota 155g a crudo, Riso basmati 75g a secco, Asparagi 150g, Olio extravergine di oliva 10g | 589 |

Totale Lun: **1705 kcal** · P 118 g · C 178 g · G 53 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 225g, Crema di riso 20g a secco, Frutti di bosco 125g, Burro di mandorle 100% 25g | 429 |
| Pranzo 13:00 | Tofu 135g, Ricotta magra 170g, Pasta 60g a secco, Spinaci 120g, Carciofi 120g, Olio extravergine di oliva 5g | 614 |
| Cena 20:00 | _pasto libero_ | 530 |

Totale Sab: **1042 kcal** · P 75 g · C 95 g · G 36 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×15 @32.5kg; Panca piana 3×15 @22.5kg; Rematore con bilanciere 3×15 @18kg; Plank 3×15; Leg press 3×15 @45kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×15 @32.5kg; Panca piana 3×15 @22.5kg; Rematore con bilanciere 3×15 @18kg; Plank 3×15; Leg press 3×15 @45kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×15 @32.5kg; Panca piana 3×15 @22.5kg; Rematore con bilanciere 3×15 @18kg; Plank 3×15; Leg press 3×15 @45kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×12-15 @42.5kg; Panca piana 3×12-15 @27.5kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @55kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×12-15 @42.5kg; Panca piana 3×12-15 @27.5kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @55kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×12-15 @42.5kg; Panca piana 3×12-15 @27.5kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @55kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1586 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Omar, 41 anni — ora solo dieta, ma rimaste vecchie risposte di allenamento

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

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
| Colazione 07:30 | Skyr 220g, Avena istantanea 40g a secco, Mirtilli 100g, Mandorle 25g | 491 |
| Pranzo 13:00 | Tonno al naturale 140g, Pasta integrale 95g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 652 |
| Cena 20:00 | Petto di pollo 170g a crudo, Riso integrale 70g a secco, Carote 80g, Finocchi 120g, Olio extravergine di oliva 15g | 619 |

Totale Lun: **1763 kcal** · P 131 g · C 172 g · G 55 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 275g, Crema di riso 30g a secco, Frutti di bosco 125g, Noci 10g, Burro di mandorle 100% 15g | 485 |
| Pranzo 13:00 | Uova intere 3 uova, Albume d'uovo 145g a crudo, Pane integrale 140g, Spinaci 150g, Olio extravergine di oliva 5g | 709 |
| Cena 20:00 | _pasto libero_ | 603 |

Totale Sab: **1193 kcal** · P 87 g · C 113 g · G 39 g

_Nessun piano di allenamento generato._

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1734 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S3` Utente solo dieta: la tab Allenamento deve mostrare che il piano non è stato richiesto

---

## Elena, 27 anni — intollerante al lattosio, 5 pasti

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Impiegata, 62 kg per 167 cm, vuole dimagrire un po’. Intollerante al lattosio (niente yogurt, latticini, whey), colazione e due spuntini.
- **Cosa ci aspettiamo:** Senza latticini la dieta deve restare varia: colazioni e spuntini diversi ogni giorno, mai la stessa merenda per tutta la settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 27 anni · 167 cm · 62 kg → 58 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1368 / 1775 kcal |
| Target calorico | **1420 kcal** (-20% sul fabbisogno) |
| Macro | P 106 g (1.7 g/kg) · C 144 g · G 47 g |
| Idratazione | 2170 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·1420 kcal → 2·1420 kcal → 3·1420 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 140g a crudo, Fiocchi d'avena 25g a secco, Mirtilli 150g, Mandorle 15g | 338 |
| Spuntino mattina 10:30 | Uva 100g, Pistacchi 15g | 157 |
| Pranzo 13:00 | Tonno al naturale 85g, Pasta integrale 70g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 10g | 457 |
| Spuntino pomeriggio 17:00 | Prosciutto crudo 30g, Pane di segale 30g, Rucola 30g | 156 |
| Cena 20:00 | Gamberi 100g a crudo, Pasta integrale 65g a secco, Zucchine 150g, Olio extravergine di oliva 10g | 428 |

Totale Lun: **1537 kcal** · P 99 g · C 163 g · G 48 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Bevanda di soia non zuccherata 300g, Crema di riso 20g a secco, Mela 1 mela, Burro di mandorle 100% 10g | 315 |
| Spuntino mattina 10:30 | Parmigiano Reggiano 20g, Pera 1 pera | 146 |
| Pranzo 13:00 | Petto di pollo 115g a crudo, Cous cous 40g a secco, Carote 80g, Peperoni 120g, Olio extravergine di oliva 10g | 419 |
| Spuntino pomeriggio 17:00 | Pesca 2 pesche, Nocciole 10g | 163 |
| Cena 20:00 | _pasto libero_ | 377 |

Totale Sab: **1043 kcal** · P 58 g · C 110 g · G 36 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @30kg; Military press 4×8-12 @22.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @3kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @55kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @25kg; Curl bicipiti 4×8-12 @9kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @47.5kg; Romanian deadlift 4×8-12 @37.5kg; Leg press 4×8-12 @62.5kg; Affondi 4×8-12 @9kg; Hip thrust 4×8-12 @30kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 3 — Mese 3 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @30kg; Military press 4×8-12 @22.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @3kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @57.5kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @25kg; Curl bicipiti 4×8-12 @9kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @50kg; Romanian deadlift 4×8-12 @40kg; Leg press 4×8-12 @65kg; Affondi 4×8-12 @9kg; Hip thrust 4×8-12 @30kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1420 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Davide, 45 anni — niente uova né pesce

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Yogurt greco 2% 295g, Avena istantanea 35g a secco, Mela 1 mela, Mandorle 10g | 474 |
| Pranzo 13:00 | Petto di pollo 145g a crudo, Pasta 90g a secco, Zucchine 150g, Passata di pomodoro 60g, Olio extravergine di oliva 15g | 649 |
| Spuntino pomeriggio 17:00 | Yogurt magro 270g, Mirtilli 75g, Semi di chia 20g | 237 |
| Cena 20:00 | Hamburger di pollo magro 170g, Patate 330g a crudo, Lattuga 50g, Pomodori 80g, Olio extravergine di oliva 10g | 603 |

Totale Lun: **1964 kcal** · P 137 g · C 208 g · G 58 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Mozzarella light 125g, Pane integrale 70g, Kiwi 1 kiwi | 430 |
| Pranzo 13:00 | Seitan 145g, Riso integrale 55g a secco, Broccoli 120g, Peperoni 120g, Olio extravergine di oliva 15g | 597 |
| Spuntino pomeriggio 17:00 | Skyr 105g, Pera 1 pera, Semi di chia 20g | 222 |
| Cena 20:00 | _pasto libero_ | 532 |

Totale Sab: **1251 kcal** · P 92 g · C 115 g · G 41 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @42.5kg; Military press 4×8-12 @30kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @75kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @13kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @62.5kg; Romanian deadlift 4×8-12 @50kg; Leg press 4×8-12 @85kg; Affondi 4×8-12 @13kg; Hip thrust 4×8-12 @42.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×8-12 @45kg; Military press 5×8-12 @32.5kg; Alzate laterali 5×8-12 @4.5kg; Chest press macchina 5×8-12; Push-up 5×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 5×8-12 @80kg; Trazioni zavorrate 5×8-12; Curl bicipiti 5×8-12 @14kg; Lat machine 5×8-12; Rematore con manubrio 5×8-12 @11kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 5×8-12 @67.5kg; Romanian deadlift 5×8-12 @55kg; Affondi 5×8-12 @14kg; Hip thrust 5×8-12 @45kg; Leg curl machine 5×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1805 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Paola, 36 anni — mangia sempre bresaola e avocado a merenda

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Insegnante, 66 kg per 170 cm. Nel questionario scrive che di solito mangia bresaola e avocado a merenda e vuole alimenti ricorrenti.
- **Cosa ci aspettiamo:** Le abitudini dichiarate orientano la scelta ma non la rendono fissa: la stessa merenda non può tornare più di 3 volte a settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 36 anni · 170 cm · 66 kg → 66 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1382 / 1798 kcal |
| Target calorico | **1798 kcal** (0% sul fabbisogno) |
| Macro | P 106 g (1.6 g/kg) · C 209 g · G 60 g |
| Idratazione | 2310 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1798 kcal → 2·1798 kcal → 3·1798 kcal → 4·1798 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 2% 175g, Fiocchi d'avena 55g a secco, Mirtilli 125g, Noci 10g | 471 |
| Pranzo 13:00 | Tonno al naturale 80g, Pasta integrale 110g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 640 |
| Spuntino pomeriggio 17:00 | Kefir 285g, Frutti di bosco 175g, Semi di chia 5g | 235 |
| Cena 20:00 | Merluzzo 115g a crudo, Cous cous 90g a secco, Peperoni 150g, Olio extravergine di oliva 15g | 593 |

Totale Lun: **1937 kcal** · P 107 g · C 228 g · G 58 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt proteico 165g, Crema di riso 30g a secco, Frutti di bosco 175g, Burro di mandorle 100% 25g | 439 |
| Pranzo 13:00 | Petto di tacchino 120g a crudo, Riso integrale 80g a secco, Melanzane 150g, Olio extravergine di oliva 15g | 585 |
| Spuntino pomeriggio 17:00 | Skyr 100g, Arancia 1 arancia, Pistacchi 15g | 211 |
| Cena 20:00 | _pasto libero_ | 535 |

Totale Sab: **1234 kcal** · P 76 g · C 131 g · G 40 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @32.5kg; Military press 4×8-12 @22.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @3.5kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @60kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @27.5kg; Curl bicipiti 4×8-12 @10kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @50kg; Romanian deadlift 4×8-12 @40kg; Leg press 4×8-12 @65kg; Affondi 4×8-12 @10kg; Hip thrust 4×8-12 @32.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×8-12 @35kg; Military press 5×8-12 @25kg; Alzate laterali 5×8-12 @4kg; Chest press macchina 5×8-12; Push-up 5×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 5×8-12 @65kg; Trazioni zavorrate 5×8-12; Curl bicipiti 5×8-12 @11kg; Lat machine 5×8-12; Rematore con manubrio 5×8-12 @9kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 5×8-12 @55kg; Romanian deadlift 5×8-12 @42.5kg; Affondi 5×8-12 @11kg; Hip thrust 5×8-12 @35kg; Leg curl machine 5×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1798 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Marta, 30 anni — pranza fuori casa quasi ogni giorno

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

- **Chi è:** Impiegata, 58 kg per 163 cm, vuole tonificarsi. Mangia fuori 5 volte a settimana (schiscetta o bar), 4 pasti con una merenda.
- **Cosa ci aspettiamo:** Pranzi trasportabili (insalate, bowl, panini) e piatti vari nella settimana.

| Dati | Valore |
|---|---|
| Profilo | female · 30 anni · 163 cm · 58 kg → 56 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1288 / 1670 kcal |
| Target calorico | **1670 kcal** (0% sul fabbisogno) |
| Macro | P 93 g (1.6 g/kg) · C 199 g · G 56 g |
| Idratazione | 2030 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1670 kcal → 2·1670 kcal → 3·1670 kcal → 4·1670 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 0% 150g, Fiocchi d'avena 45g a secco, Mela 1 mela, Noci 15g | 437 |
| Pranzo 13:00 | Tonno al naturale 65g, Pasta integrale 105g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 605 |
| Spuntino pomeriggio 17:00 | Kefir 275g, Mirtilli 100g, Semi di chia 5g | 210 |
| Cena 20:00 | Merluzzo 100g a crudo, Cous cous 85g a secco, Zucchine 150g, Olio extravergine di oliva 15g | 545 |

Totale Lun: **1796 kcal** · P 97 g · C 211 g · G 56 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Albume d'uovo 95g a crudo, Avena istantanea 45g a secco, Mirtilli 125g, Burro di arachidi 100% 20g | 408 |
| Pranzo 13:00 | Seitan 90g, Riso integrale 65g a secco, Broccoli 120g, Peperoni 120g, Olio extravergine di oliva 15g | 561 |
| Spuntino pomeriggio 17:00 | Yogurt proteico 100g, Fragole 250g, Mandorle 10g | 193 |
| Cena 20:00 | _pasto libero_ | 498 |

Totale Sab: **1162 kcal** · P 68 g · C 124 g · G 39 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @30kg; Military press 4×8-12 @20kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @3kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @52.5kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @22.5kg; Curl bicipiti 4×8-12 @9kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @42.5kg; Romanian deadlift 4×8-12 @35kg; Leg press 4×8-12 @57.5kg; Affondi 4×8-12 @9kg; Hip thrust 4×8-12 @30kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×8-12 @32.5kg; Military press 5×8-12 @22.5kg; Alzate laterali 5×8-12 @3kg; Chest press macchina 5×8-12; Push-up 5×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 5×8-12 @57.5kg; Trazioni zavorrate 5×8-12; Curl bicipiti 5×8-12 @10kg; Lat machine 5×8-12; Rematore con manubrio 5×8-12 @8kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 5×8-12 @45kg; Romanian deadlift 5×8-12 @37.5kg; Affondi 5×8-12 @10kg; Hip thrust 5×8-12 @32.5kg; Leg curl machine 5×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1670 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Luigi, 55 anni — pescetariano, vuole perdere pancia

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Yogurt greco 0% 275g, Fiocchi d'avena 50g a secco, Pera 1 pera, Nocciole 20g | 547 |
| Pranzo 13:00 | Tonno al naturale 140g, Pasta integrale 115g a secco, Pomodori 80g, Lattuga 50g, Olio extravergine di oliva 15g | 724 |
| Cena 20:00 | Trota 185g a crudo, Riso basmati 90g a secco, Asparagi 150g, Olio extravergine di oliva 10g | 681 |

Totale Lun: **1950 kcal** · P 137 g · C 208 g · G 57 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Yogurt greco 0% 110g, Fiocchi d'avena 45g a secco, Frutti di bosco 150g | 506 |
| Pranzo 13:00 | Ricotta magra 170g, Tofu 210g, Pasta 65g a secco, Spinaci 120g, Carciofi 120g, Olio extravergine di oliva 5g | 693 |
| Cena 20:00 | _pasto libero_ | 607 |

Totale Sab: **1198 kcal** · P 86 g · C 105 g · G 43 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @45kg; Military press 4×8-12 @30kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4.5kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @80kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @35kg; Curl bicipiti 4×8-12 @13kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @65kg; Romanian deadlift 4×8-12 @52.5kg; Leg press 4×8-12 @87.5kg; Affondi 4×8-12 @13kg; Hip thrust 4×8-12 @45kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×8-12 @47.5kg; Military press 5×8-12 @32.5kg; Alzate laterali 5×8-12 @5kg; Chest press macchina 5×8-12; Push-up 5×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 5×8-12 @87.5kg; Trazioni zavorrate 5×8-12; Curl bicipiti 5×8-12 @14kg; Lat machine 5×8-12; Rematore con manubrio 5×8-12 @12kg |
| Gio | Riposo | |
| Ven | Legs | Back squat 5×8-12 @70kg; Romanian deadlift 5×8-12 @57.5kg; Affondi 5×8-12 @14kg; Hip thrust 5×8-12 @47.5kg; Leg curl machine 5×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1822 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---
