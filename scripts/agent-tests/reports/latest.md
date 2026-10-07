# Test dei piani generati dai questionari

Generato il 2026-10-07 20:13 — 16 questionari finti, piani creati con i generatori reali dell’app.

**Totale:** 0 errori · 3 avvisi · 21 note

| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |
|---|---|---|---|---|---|---|
| Sofia, 16 anni | 1703 | 88/209/57 | 4 | 2/0 | 0 | 0 |
| Matteo, 17 anni | 2601 | 118/337/87 | 5 | 3/0 | 0 | 1 |
| Giulia, 24 anni | 1506 | 112/152/50 | 4 | 3/0 | 0 | 1 |
| Luca, 22 anni | 2759 | 129/353/92 | 9 | 5/0 | 0 | 0 |
| Alessandro, 29 anni | 3370 | 128/463/112 | 4 | 4/2 | 0 | 1 |
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
| Colazione 07:30 | Skyr 135g, Granola 60g, Fragole 160g, Semi di chia 15g | 479 |
| Pranzo 13:00 | Gamberi (cotti) 100g, Riso basmati (cotto) 275g, Carote 150g, Olio EVO 15g, Avocado 35g | 683 |
| Cena 20:00 | Tonno al naturale 60g, Pasta (cotta) 230g, Pomodorini 150g, Olio EVO 15g | 607 |

Totale Lun: **1767 kcal** · P 87 g · C 229 g · G 56 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 115g, Fette biscottate 4 fette, Arancia 1 arancia, Mandorle 25g | 435 |
| Pranzo 13:00 | Manzo magro 90g, Patate (bollite) 320g, Fagiolini 150g, Olio EVO 10g | 581 |
| Cena 20:00 | _pasto libero_ | 581 |

Totale Sab: **1016 kcal** · P 57 g · C 129 g · G 33 g

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

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 1 avvisi, 1 note)

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
| Colazione 07:30 | Skyr 135g, Fiocchi d’avena 40g, Banana 2 banane, Mandorle 40g | 687 |
| Pranzo 13:00 | Petto di pollo 80g, Gnocchi di patate 350g, Pane integrale 40g, Spinaci 150g, Olio EVO 25g | 1012 |
| Cena 20:00 | Gamberi (cotti) 80g, Pasta (cotta) 350g, Pomodorini 150g, Olio EVO 25g | 894 |

Totale Lun: **2591 kcal** · P 120 g · C 347 g · G 84 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt proteico 175g, Cereali integrali 80g, Mirtilli 125g, Noci 25g, Semi di chia 15g | 692 |
| Pranzo 13:00 | Gamberi (cotti) 120g, Couscous (cotto) 350g, Carote 150g, Avocado 60g, Olio EVO 25g | 890 |
| Cena 20:00 | _pasto libero_ | 886 |

Totale Sab: **1581 kcal** · P 77 g · C 189 g · G 59 g

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

- ⚠️ `Q6` Mer (mese 5): stessa fonte proteica a pranzo e cena (shrimp)
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
| Colazione 07:30 | Fiocchi di latte 195g, Pane integrale 50g, Fragole 240g | 392 |
| Pranzo 13:00 | Uova intere 3 uova, Pane integrale 140g, Insalata mista 150g | 609 |
| Cena 20:00 | Tofu 220g, Lenticchie (cotte) 230g, Pomodorini 150g, Olio EVO 5g | 519 |

Totale Lun: **1518 kcal** · P 109 g · C 168 g · G 50 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Fiocchi di latte 225g, Fette biscottate 2 fette, Fragole 205g | 360 |
| Pranzo 13:00 | Tofu 250g, Farro (cotto) 145g, Peperone rosso 150g, Mandorle 15g | 500 |
| Cena 20:00 | _pasto libero_ | 505 |

Totale Sab: **859 kcal** · P 61 g · C 92 g · G 33 g

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

- ⚠️ `D5` Proteine: i pasti danno in media il 91% del target (giorno peggiore: 15% di scarto)
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
| Colazione 07:30 | Albume d’uovo 115g, Pane integrale 40g, Banana 2 banane, Mandorle 35g | 576 |
| Spuntino mattina 10:30 | Kefir 290g, Pera 1 pera, Noci 10g | 276 |
| Pranzo 13:00 | Manzo magro 80g, Pasta (cotta) 330g, Pomodorini 150g, Olio EVO 15g | 845 |
| Spuntino pomeriggio 17:00 | Bresaola 30g, Fette biscottate 5 fette, Avocado 35g | 284 |
| Cena 20:00 | Gamberi (cotti) 80g, Riso basmati (cotto) 315g, Broccoli 150g, Pistacchi 20g, Tahina (crema di sesamo) 25g | 772 |

Totale Lun: **2751 kcal** · P 139 g · C 365 g · G 89 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 130g, Crema di riso 65g, Fragole 105g, Semi di chia 20g, Mandorle 25g | 593 |
| Spuntino mattina 10:30 | Fiocchi di latte 80g, Gallette di mais 4 gallette, Burro di arachidi 10g | 289 |
| Pranzo 13:00 | Gamberi (cotti) 80g, Pasta (cotta) 170g, Pane integrale 120g, Pomodorini 150g, Olio EVO 15g | 818 |
| Spuntino pomeriggio 17:00 | Barretta proteica 1 barretta, Pera 1 pera | 255 |
| Cena 20:00 | _pasto libero_ | 777 |

Totale Sab: **1954 kcal** · P 102 g · C 267 g · G 57 g

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
| Colazione 07:30 | Skyr 145g, Muesli 80g, Banana 2 banane, Mandorle 35g, Semi di chia 20g | 895 |
| Pranzo 13:00 | Tonno al naturale 85g, Farro (cotto) 350g, Pane integrale 150g, Carote 150g, Olio EVO 25g, Avocado 55g | 1286 |
| Cena 20:00 | Petto di pollo 80g, Gnocchi di patate 350g, Pane integrale 100g, Pomodorini 150g, Olio EVO 25g | 1166 |

Totale Lun: **3345 kcal** · P 151 g · C 465 g · G 106 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt proteico 160g, Cereali integrali 80g, Banana 2 banane, Mandorle 40g, Noci 10g | 887 |
| Pranzo 13:00 | Gamberi (cotti) 95g, Couscous (cotto) 350g, Pane integrale 160g, Peperone rosso 150g, Avocado 60g, Olio EVO 25g | 1237 |
| Cena 20:00 | _pasto libero_ | 1187 |

Totale Sab: **2124 kcal** · P 96 g · C 286 g · G 70 g

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

- ⚠️ `D5` Proteine: i pasti danno in media il 121% del target (giorno peggiore: 34% di scarto)
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
| Colazione 07:30 | Skyr 270g, Granola 25g, Banana 1 banana, Mandorle 25g | 535 |
| Pranzo 13:00 | Petto di pollo 120g, Pasta (cotta) 235g, Broccoli 150g, Olio EVO 15g | 753 |
| Cena 20:00 | Petto di tacchino 90g, Pane integrale 160g, Insalata mista 150g, Avocado 60g, Olio EVO 5g | 687 |

Totale Lun: **1974 kcal** · P 144 g · C 219 g · G 61 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Fiocchi di latte 245g, Pane integrale 60g, Fragole 140g, Burro di arachidi 10g | 492 |
| Pranzo 13:00 | Uova intere 3 uova, Pane integrale 150g, Melanzane 150g, Olio EVO 5g | 686 |
| Cena 20:00 | _pasto libero_ | 637 |

Totale Sab: **1177 kcal** · P 79 g · C 118 g · G 45 g

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
| Colazione 07:30 | Skyr 215g, Muesli 25g, Fragole 195g, Mandorle 20g, Semi di chia 5g | 428 |
| Pranzo 13:00 | Petto di pollo 110g, Gnocchi di patate 185g, Spinaci 150g, Olio EVO 15g | 628 |
| Cena 20:00 | Gamberi (cotti) 130g, Pasta (cotta) 165g, Pomodorini 150g, Olio EVO 15g | 564 |

Totale Lun: **1617 kcal** · P 119 g · C 171 g · G 52 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 215g, Fette biscottate 2 fette, Fragole 140g, Mandorle 25g | 398 |
| Pranzo 13:00 | Manzo magro 145g, Patate dolci 190g, Fagiolini 150g, Avocado 55g | 569 |
| Cena 20:00 | _pasto libero_ | 526 |

Totale Sab: **967 kcal** · P 78 g · C 91 g · G 35 g

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
| Colazione 07:30 | Skyr 140g, Granola 45g, Banana 2 banane, Mandorle 30g | 679 |
| Pranzo 13:00 | Petto di pollo 80g, Gnocchi di patate 350g, Pane integrale 40g, Spinaci 150g, Olio EVO 25g | 1012 |
| Cena 20:00 | Gamberi (cotti) 80g, Pasta (cotta) 350g, Pomodorini 150g, Olio EVO 25g | 894 |

Totale Lun: **2583 kcal** · P 116 g · C 347 g · G 84 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ricotta magra 120g, Fette biscottate 6 fette, Arancia 2 arance, Burro di arachidi 20g | 645 |
| Pranzo 13:00 | Tonno al naturale 75g, Couscous (cotto) 345g, Pane integrale 50g, Carote 150g, Avocado 60g, Olio EVO 20g | 932 |
| Cena 20:00 | _pasto libero_ | 857 |

Totale Sab: **1575 kcal** · P 70 g · C 205 g · G 56 g

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
| Colazione 07:30 | Skyr 230g, Muesli 25g, Fragole 155g, Mandorle 20g, Semi di chia 10g | 451 |
| Pranzo 13:00 | Tonno al naturale 160g, Riso basmati (cotto) 190g, Carote 150g, Olio EVO 15g | 611 |
| Cena 20:00 | Gamberi (cotti) 85g, Lenticchie (cotte) 235g, Pomodorini 150g, Tahina (crema di sesamo) 15g, Olio EVO 10g | 575 |

Totale Lun: **1634 kcal** · P 128 g · C 167 g · G 53 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 225g, Fette biscottate 3 fette, Fragole 155g, Mandorle 25g | 447 |
| Pranzo 13:00 | Tonno al naturale 140g, Pasta (cotta) 185g, Pomodorini 150g, Olio EVO 15g | 628 |
| Cena 20:00 | _pasto libero_ | 592 |

Totale Sab: **1074 kcal** · P 83 g · C 112 g · G 34 g

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
| Colazione 07:30 | Skyr 160g, Muesli 20g, Fragole 105g, Mandorle 20g, Semi di chia 5g | 348 |
| Pranzo 13:00 | Gamberi (cotti) 125g, Riso basmati (cotto) 125g, Carote 150g, Olio EVO 15g | 470 |
| Cena 20:00 | Tonno al naturale 65g, Fagioli borlotti (cotti) 145g, Pomodorini 150g, Olio EVO 15g | 446 |

Totale Lun: **1262 kcal** · P 92 g · C 124 g · G 47 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Fiocchi di latte 195g, Fette biscottate 2 fette, Fragole 100g | 296 |
| Pranzo 13:00 | Petto di pollo 90g, Pasta (cotta) 95g, Peperone rosso 150g, Olio EVO 15g | 471 |
| Cena 20:00 | _pasto libero_ | 420 |

Totale Sab: **767 kcal** · P 59 g · C 66 g · G 30 g

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
| Colazione 07:30 | Skyr 140g, Muesli 80g, Fragole 250g, Mandorle 25g, Semi di chia 10g | 652 |
| Pranzo 13:00 | Petto di pollo 90g, Gnocchi di patate 350g, Spinaci 150g, Olio EVO 25g | 930 |
| Cena 20:00 | Tonno al naturale 110g, Riso basmati (cotto) 350g, Pomodorini 150g, Avocado 60g, Olio EVO 15g | 822 |

Totale Lun: **2401 kcal** · P 117 g · C 306 g · G 79 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt proteico 165g, Cereali integrali 65g, Mela 1 mela, Mandorle 40g | 635 |
| Pranzo 13:00 | Manzo magro 90g, Patate dolci 295g, Pane integrale 90g, Fagiolini 150g, Avocado 60g, Olio EVO 10g | 875 |
| Cena 20:00 | _pasto libero_ | 818 |

Totale Sab: **1510 kcal** · P 76 g · C 191 g · G 52 g

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
| Colazione 07:30 | Skyr 155g, Muesli 65g, Fragole 135g, Mandorle 25g | 522 |
| Pranzo 13:00 | Gamberi (cotti) 130g, Riso basmati (cotto) 285g, Carote 150g, Olio EVO 15g, Avocado 50g | 749 |
| Cena 20:00 | Tonno al naturale 70g, Fagioli borlotti (cotti) 280g, Pomodorini 150g, Olio EVO 15g | 636 |

Totale Lun: **1904 kcal** · P 116 g · C 233 g · G 59 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 175g, Fette biscottate 5 fette, Arancia 1 arancia, Noci 20g | 495 |
| Pranzo 13:00 | Manzo magro 115g, Patate (bollite) 350g, Fagiolini 150g, Avocado 30g, Olio EVO 10g | 703 |
| Cena 20:00 | _pasto libero_ | 654 |

Totale Sab: **1197 kcal** · P 71 g · C 143 g · G 41 g

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
| Colazione 07:30 | Skyr 185g, Muesli 75g, Fragole 180g, Mandorle 25g, Semi di chia 5g | 616 |
| Pranzo 13:00 | Gamberi (cotti) 115g, Farro (cotto) 340g, Carote 150g, Olio EVO 15g, Avocado 60g | 837 |
| Cena 20:00 | Tonno al naturale 80g, Fagioli borlotti (cotti) 300g, Pomodorini 150g, Tahina (crema di sesamo) 25g, Olio EVO 10g | 779 |

Totale Lun: **2230 kcal** · P 138 g · C 276 g · G 74 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 170g, Fette biscottate 6 fette, Fragole 200g, Burro di arachidi 30g | 567 |
| Pranzo 13:00 | Manzo magro 145g, Patate (bollite) 350g, Fagiolini 150g, Avocado 60g, Olio EVO 5g | 763 |
| Cena 20:00 | _pasto libero_ | 751 |

Totale Sab: **1330 kcal** · P 85 g · C 153 g · G 46 g

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
| Colazione 07:30 | Skyr 215g, Granola 20g, Fragole 250g, Mandorle 10g, Semi di chia 15g | 436 |
| Pranzo 13:00 | Petto di pollo 110g, Gnocchi di patate 195g, Spinaci 150g, Olio EVO 15g | 643 |
| Cena 20:00 | Gamberi (cotti) 125g, Pasta (cotta) 175g, Pomodorini 150g, Olio EVO 15g | 575 |

Totale Lun: **1651 kcal** · P 118 g · C 180 g · G 52 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt proteico 240g, Muesli 20g, Fragole 150g, Mandorle 25g | 398 |
| Pranzo 13:00 | Tonno al naturale 105g, Pane integrale 120g, Insalata mista 150g, Olio EVO 15g | 581 |
| Cena 20:00 | _pasto libero_ | 530 |

Totale Sab: **978 kcal** · P 77 g · C 93 g · G 35 g

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
| Colazione 07:30 | Skyr 245g, Granola 30g, Fragole 170g, Mandorle 20g | 459 |
| Pranzo 13:00 | Gamberi (cotti) 175g, Riso basmati (cotto) 185g, Carote 150g, Olio EVO 15g, Avocado 40g | 656 |
| Cena 20:00 | Tonno al naturale 80g, Lenticchie (cotte) 235g, Pomodorini 150g, Tahina (crema di sesamo) 15g, Olio EVO 10g | 584 |

Totale Lun: **1698 kcal** · P 130 g · C 170 g · G 59 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Skyr 250g, Fette biscottate 3 fette, Fragole 185g, Noci 20g | 458 |
| Pranzo 13:00 | Tonno al naturale 145g, Pasta (cotta) 185g, Pomodorini 150g, Olio EVO 15g | 634 |
| Cena 20:00 | _pasto libero_ | 603 |

Totale Sab: **1091 kcal** · P 85 g · C 112 g · G 35 g

_Nessun piano di allenamento generato._

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1734 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S3` Utente solo dieta: la tab Allenamento deve mostrare che il piano non è stato richiesto

---
