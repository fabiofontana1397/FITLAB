# Test dei piani generati dai questionari

Generato il 2026-10-07 17:55 — 16 questionari finti, piani creati con i generatori reali dell’app.

**Totale:** 0 errori · 8 avvisi · 21 note

| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |
|---|---|---|---|---|---|---|
| Sofia, 16 anni | 1703 | 88/209/57 | 4 | 2/0 | 0 | 0 |
| Matteo, 17 anni | 2601 | 118/337/87 | 5 | 3/0 | 0 | 0 |
| Giulia, 24 anni | 1506 | 112/152/50 | 4 | 3/0 | 0 | 1 |
| Luca, 22 anni | 2759 | 129/353/92 | 9 | 5/0 | 0 | 0 |
| Alessandro, 29 anni | 3370 | 128/463/112 | 4 | 4/2 | 0 | 1 |
| Marco, 32 anni | 1913 | 143/192/64 | 6 | 3/0 | 0 | 0 |
| Chiara, 25 anni | 1591 | 119/160/53 | 3 | 2/2 | 0 | 1 |
| Paolo, 38 anni | 2579 | 108/344/86 | 4 | 0/4 | 0 | 1 |
| Andrea, 40 anni | 1702 | 127/170/57 | 3 | –/– | 0 | 2 |
| Ilaria, 29 anni | 2143 | 122/254/71 | 5 | 4/0 | 0 | 0 |
| Anna, 52 anni | 1238 | 92/107/49 | 5 | 2/0 | 0 | 0 |
| Roberto, 58 anni | 2387 | 115/302/80 | 4 | 2/0 | 0 | 0 |
| Franco, 60 anni | 1892 | 109/223/63 | 4 | 1/0 | 0 | 0 |
| Tommaso, 35 anni | 2184 | 128/254/73 | 4 | 1/0 | 0 | 0 |
| Nina, 33 anni | 1586 | 118/159/53 | 4 | 3/0 | 0 | 0 |
| Omar, 41 anni | 1734 | 130/171/59 | 5 | –/– | 0 | 2 |

## Controlli generali dell’app

- ❌ `G1` Gli id dei pasti "Segui il piano" non contengono l’utente ma meal_entries.id è chiave primaria globale: due utenti nello stesso giorno si scontrano
- ℹ️ `G2` Giorno della settimana calcolato da date ISO con getDay() locale: slitta di un giorno a ovest di Greenwich
- ❌ `G3` Il peso obiettivo vuoto diventa 75 kg nel profilo
- ❌ `G4` generatePlans senza try/catch: un errore lascia isGenerating a true per sempre
- ❌ `G5` Risposte parziali sul server bastano per considerare l’onboarding completato
- ❌ `G6` Il hook dell’energia settimanale non usa il modello energetico unico (src/domain/energy.ts)
- ❌ `G6` Home usa ancora il vecchio modello energetico
- ⚠️ `G8` La tab Nutrizione mostra sempre i 6 pasti fissi invece di quelli scelti dall’utente

---

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
| Colazione 07:30 | Banana 1 banana, Uova intere 2 uova, Fiocchi d’avena 55g | 476 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 5g, Salmone 105g, Patate (bollite) 350g, Riso basmati (cotto) 60g | 675 |
| Cena 20:00 | Zucchine 150g, Olio EVO 5g, Yogurt greco 250g, Patate dolci 325g | 593 |

Totale Lun: **1742 kcal** · P 87 g · C 234 g · G 53 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Fiocchi d’avena 40g | 496 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 5g, Salmone 120g, Patate dolci 320g | 620 |
| Cena 20:00 | _pasto libero_ | 557 |

Totale Sab: **1115 kcal** · P 61 g · C 130 g · G 41 g

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
| Colazione 07:30 | Banana 1 banana, Uova intere 1 uovo, Fiocchi d’avena 85g, Yogurt greco 100g, Mela 1 mela, Mandorle 10g | 749 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 10g, Salmone 140g, Patate (bollite) 350g, Riso basmati (cotto) 245g | 1015 |
| Cena 20:00 | Zucchine 150g, Olio EVO 10g, Salmone 145g, Patate dolci 350g, Riso basmati (cotto) 150g | 899 |

Totale Lun: **2661 kcal** · P 120 g · C 360 g · G 82 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 2 uova, Fiocchi d’avena 90g, Mandorle 10g | 670 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 10g, Salmone 160g, Patate dolci 350g, Riso basmati (cotto) 160g | 967 |
| Cena 20:00 | _pasto libero_ | 849 |

Totale Sab: **1637 kcal** · P 78 g · C 211 g · G 55 g

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

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 1 note)

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
| Colazione 07:30 | Banana 1 banana, Fiocchi di latte 225g, Pane integrale 45g | 439 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 5g, Fiocchi di latte 185g, Ceci (cotti) 205g | 596 |
| Cena 20:00 | Zucchine 150g, Ricotta 120g, Lenticchie (cotte) 250g | 491 |

Totale Lun: **1525 kcal** · P 110 g · C 179 g · G 45 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Yogurt greco 125g | 461 |
| Pranzo 13:00 | Broccoli 150g, Yogurt greco 300g, Ceci (cotti) 110g | 522 |
| Cena 20:00 | _pasto libero_ | 484 |

Totale Sab: **983 kcal** · P 73 g · C 85 g · G 42 g

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

- ⚠️ `D5` Carboidrati: i pasti danno in media il 106% del target (giorno peggiore: 32% di scarto)
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1506 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---

## Luca, 22 anni — massa muscolare, esperto

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 1 note)

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
| Colazione 07:30 | Banana 1 banana, Uova intere 1 uovo, Pane integrale 120g, Fiocchi d’avena 25g, Mandorle 15g | 665 |
| Spuntino mattina 10:30 | Mela 1 mela, Uova intere 1 uovo, Pane integrale 35g | 232 |
| Pranzo 13:00 | Zucchine 150g, Olio EVO 10g, Yogurt greco 300g, Patate dolci 350g, Riso basmati (cotto) 155g | 894 |
| Spuntino pomeriggio 17:00 | Mirtilli 100g, Proteine whey (polvere) 5g, Pane integrale 45g, Mandorle 10g | 245 |
| Cena 20:00 | Fagiolini 150g, Olio EVO 10g, Yogurt greco 280g, Riso basmati (cotto) 310g | 782 |

Totale Lun: **2816 kcal** · P 130 g · C 388 g · G 85 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 2 uova, Fiocchi d’avena 100g | 651 |
| Spuntino mattina 10:30 | Mela 1 mela, Uova intere 1 uovo, Pane integrale 35g | 232 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 10g, Manzo magro 95g, Patate dolci 350g, Riso basmati (cotto) 175g, Mandorle 15g | 901 |
| Spuntino pomeriggio 17:00 | Mirtilli 100g, Proteine whey (polvere) 5g, Pane integrale 45g, Mandorle 10g | 245 |
| Cena 20:00 | _pasto libero_ | 789 |

Totale Sab: **2028 kcal** · P 99 g · C 285 g · G 59 g

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

---

## Alessandro, 29 anni — molto attivo, anni di esperienza

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 2 note)

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
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Fiocchi d’avena 100g, Mela 2 mele, Olio EVO 10g | 947 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 25g, Salmone 125g, Patate (bollite) 350g, Tonno al naturale 50g, Riso basmati (cotto) 350g | 1303 |
| Cena 20:00 | Zucchine 150g, Olio EVO 10g, Salmone 135g, Patate dolci 350g, Yogurt greco 90g, Riso basmati (cotto) 300g | 1146 |

Totale Lun: **3394 kcal** · P 148 g · C 446 g · G 113 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Fiocchi d’avena 100g, Mela 2 mele, Olio EVO 10g | 947 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 20g, Salmone 145g, Patate dolci 350g, Tonno al naturale 40g, Riso basmati (cotto) 350g | 1301 |
| Cena 20:00 | _pasto libero_ | 1138 |

Totale Sab: **2247 kcal** · P 97 g · C 298 g · G 76 g

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

- ⚠️ `D5` Proteine: i pasti danno in media il 116% del target (giorno peggiore: 24% di scarto)
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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 300g, Fiocchi d’avena 15g, Uova intere 2 uova | 611 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 5g, Yogurt greco 300g, Pane integrale 120g, Riso basmati (cotto) 80g | 763 |
| Cena 20:00 | Zucchine 150g, Olio EVO 5g, Petto di pollo 120g, Riso basmati (cotto) 260g, Mandorle 15g | 670 |

Totale Lun: **2043 kcal** · P 142 g · C 208 g · G 71 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Yogurt greco 225g | 558 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 5g, Petto di tacchino 120g, Pasta (cotta) 180g, Mandorle 25g | 686 |
| Cena 20:00 | _pasto libero_ | 610 |

Totale Sab: **1244 kcal** · P 96 g · C 109 g · G 50 g

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

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 2 note)

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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 300g, Fiocchi d’avena 15g | 456 |
| Pranzo 13:00 | Spinaci 150g, Salmone 185g, Patate (bollite) 230g | 620 |
| Cena 20:00 | Zucchine 150g, Salmone 175g, Patate dolci 175g | 541 |

Totale Lun: **1616 kcal** · P 116 g · C 139 g · G 65 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Yogurt greco 145g | 481 |
| Pranzo 13:00 | Broccoli 150g, Salmone 195g, Patate dolci 120g | 560 |
| Cena 20:00 | _pasto libero_ | 504 |

Totale Sab: **1040 kcal** · P 79 g · C 69 g · G 50 g

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

- ⚠️ `D5` Carboidrati: i pasti danno in media il 89% del target (giorno peggiore: 19% di scarto)
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1591 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 2 sedute di corsa a settimana (es. "Corsa facile 35 min")

---

## Paolo, 38 anni — solo corsa, resistenza

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 2 note)

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
| Colazione 07:30 | Banana 1 banana, Uova intere 1 uovo, Fiocchi d’avena 75g, Mela 2 mele, Mandorle 20g | 723 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 10g, Salmone 115g, Patate (bollite) 350g, Riso basmati (cotto) 275g | 1000 |
| Cena 20:00 | Zucchine 150g, Olio EVO 10g, Salmone 125g, Patate dolci 350g, Riso basmati (cotto) 170g | 881 |

Totale Lun: **2602 kcal** · P 104 g · C 378 g · G 76 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 1 uovo, Fiocchi d’avena 75g, Mela 1 mela, Mandorle 20g | 705 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 10g, Salmone 140g, Patate dolci 350g, Riso basmati (cotto) 170g | 937 |
| Cena 20:00 | _pasto libero_ | 821 |

Totale Sab: **1641 kcal** · P 68 g · C 235 g · G 51 g

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

- ⚠️ `D5` Grassi: i pasti danno in media il 88% del target (giorno peggiore: 13% di scarto)
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2622 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 4 sedute di corsa a settimana (es. "Corsa facile 30 min")

---

## Andrea, 40 anni — solo dieta

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 2 avvisi, 2 note)

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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 300g, Fiocchi d’avena 20g | 476 |
| Pranzo 13:00 | Spinaci 150g, Salmone 200g, Patate (bollite) 215g | 638 |
| Cena 20:00 | Zucchine 150g, Salmone 190g, Patate dolci 165g | 563 |

Totale Lun: **1676 kcal** · P 123 g · C 138 g · G 69 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Yogurt greco 170g | 505 |
| Pranzo 13:00 | Broccoli 150g, Salmone 205g, Patate dolci 180g | 632 |
| Cena 20:00 | _pasto libero_ | 567 |

Totale Sab: **1136 kcal** · P 84 g · C 82 g · G 53 g

_Nessun piano di allenamento generato._

**Controlli**

- ⚠️ `D5` Carboidrati: i pasti danno in media il 86% del target (giorno peggiore: 22% di scarto)
- ⚠️ `D5` Grassi: i pasti danno in media il 111% del target (giorno peggiore: 21% di scarto)
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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 275g | 374 |
| Pranzo 13:00 | Spinaci 150g, Salmone 135g, Patate (bollite) 205g | 494 |
| Cena 20:00 | Zucchine 150g, Yogurt greco 295g, Patate dolci 140g | 432 |

Totale Lun: **1299 kcal** · P 92 g · C 127 g · G 48 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova | 335 |
| Pranzo 13:00 | Broccoli 150g, Salmone 145g, Patate dolci 110g | 448 |
| Cena 20:00 | _pasto libero_ | 403 |

Totale Sab: **782 kcal** · P 56 g · C 61 g · G 36 g

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
| Colazione 07:30 | Banana 1 banana, Uova intere 2 uova, Fiocchi d’avena 100g | 651 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 10g, Salmone 140g, Patate (bollite) 350g, Riso basmati (cotto) 185g | 943 |
| Cena 20:00 | Zucchine 150g, Olio EVO 10g, Yogurt greco 300g, Patate dolci 350g, Riso basmati (cotto) 95g | 821 |

Totale Lun: **2414 kcal** · P 112 g · C 326 g · G 74 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 2 uova, Fiocchi d’avena 85g, Mandorle 5g | 622 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 10g, Salmone 160g, Patate dolci 350g, Riso basmati (cotto) 100g | 894 |
| Cena 20:00 | _pasto libero_ | 784 |

Totale Sab: **1516 kcal** · P 74 g · C 191 g · G 52 g

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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 220g, Fiocchi d’avena 60g | 553 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 5g, Salmone 150g, Patate (bollite) 350g | 696 |
| Cena 20:00 | Zucchine 150g, Olio EVO 5g, Salmone 145g, Patate dolci 315g | 643 |

Totale Lun: **1891 kcal** · P 108 g · C 218 g · G 66 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Fiocchi d’avena 35g | 476 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 5g, Salmone 160g, Patate dolci 315g | 699 |
| Cena 20:00 | _pasto libero_ | 627 |

Totale Sab: **1174 kcal** · P 68 g · C 126 g · G 46 g

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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 240g, Fiocchi d’avena 80g | 651 |
| Pranzo 13:00 | Spinaci 150g, Olio EVO 10g, Salmone 180g, Patate (bollite) 350g, Riso basmati (cotto) 70g | 887 |
| Cena 20:00 | Zucchine 150g, Salmone 165g, Patate dolci 350g, Riso basmati (cotto) 95g | 785 |

Totale Lun: **2322 kcal** · P 128 g · C 280 g · G 75 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Yogurt greco 285g, Fiocchi d’avena 60g | 616 |
| Pranzo 13:00 | Broccoli 150g, Salmone 190g, Patate dolci 350g, Riso basmati (cotto) 65g | 826 |
| Cena 20:00 | _pasto libero_ | 720 |

Totale Sab: **1443 kcal** · P 87 g · C 174 g · G 45 g

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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 300g, Fiocchi d’avena 20g | 476 |
| Pranzo 13:00 | Spinaci 150g, Salmone 180g, Patate (bollite) 250g | 627 |
| Cena 20:00 | Zucchine 150g, Salmone 170g, Patate dolci 195g | 548 |

Totale Lun: **1649 kcal** · P 116 g · C 151 g · G 64 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Yogurt greco 145g | 481 |
| Pranzo 13:00 | Broccoli 150g, Olio EVO 5g, Petto di pollo 115g, Patate dolci 220g, Mandorle 15g | 561 |
| Cena 20:00 | _pasto libero_ | 508 |

Totale Sab: **1041 kcal** · P 80 g · C 92 g · G 42 g

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

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 2 avvisi, 2 note)

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
| Colazione 07:30 | Banana 1 banana, Yogurt greco 300g, Uova intere 1 uovo | 476 |
| Pranzo 13:00 | Spinaci 150g, Salmone 205g, Patate (bollite) 220g | 652 |
| Cena 20:00 | Zucchine 150g, Salmone 195g, Patate dolci 170g | 578 |

Totale Lun: **1705 kcal** · P 128 g · C 127 g · G 74 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Banana 1 banana, Uova intere 3 uova, Yogurt greco 180g | 515 |
| Pranzo 13:00 | Broccoli 150g, Salmone 210g, Patate dolci 180g | 643 |
| Cena 20:00 | _pasto libero_ | 578 |

Totale Sab: **1157 kcal** · P 86 g · C 82 g · G 54 g

_Nessun piano di allenamento generato._

**Controlli**

- ⚠️ `D5` Carboidrati: i pasti danno in media il 87% del target (giorno peggiore: 26% di scarto)
- ⚠️ `D5` Grassi: i pasti danno in media il 113% del target (giorno peggiore: 26% di scarto)
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1734 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S3` Utente solo dieta: la tab Allenamento deve mostrare che il piano non è stato richiesto

---
