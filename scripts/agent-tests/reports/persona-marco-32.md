# Test dei piani generati dai questionari

Generato il 2026-10-07 18:44 — 1 questionari finti, piani creati con i generatori reali dell’app.

**Totale:** 0 errori · 0 avvisi · 1 note

| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |
|---|---|---|---|---|---|---|
| Marco, 32 anni | 1913 | 143/192/64 | 6 | 3/0 | 0 | 0 |

## Simulazione: ricalibrazione mensile su 6 mesi

Un corpo virtuale segue il piano; a fine mese l’agente di ricalibrazione vede le pesate (con rumore) e l’aderenza e rielabora dieta e allenamento. Si verifica che il peso vada verso l’obiettivo anche se il metabolismo reale si discosta dal modello del ±10%, e che con bassa aderenza non si corregga sui numeri.

### Marco, 32 anni — dimagrimento, sedentario

| Scenario | Peso (inizio → fine) | Ritmo medio | Verdetti mensili | Regolazione kcal |
|---|---|---|---|---|
| Modello accurato, piano seguito | 92 → 82 kg | -0.39 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Metabolismo più lento del 10% | 92 → 84 kg | -0.31 kg/sett. | too_slow › on_track › too_slow › on_track › on_track › on_track | -100, -100, -200, -200, -200, -200 |
| Metabolismo più veloce del 10% | 92 → 76.7 kg | -0.59 kg/sett. | on_track › on_track › on_track › on_track › on_track › on_track | 0, 0, 0, 0, 0, 0 |
| Segue il piano a metà (mangia il 20% in più, salta metà degli allenamenti) | 92 → 91.3 kg | -0.02 kg/sett. | low_adherence › low_adherence › low_adherence › low_adherence › low_adherence › low_adherence | 0, 0, 0, 0, 0, 0 |

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

**Mese 1 — Adattamento tecnico Full Body**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 2×12-15 @32.5kg; Panca piana 2×12-15 @22.5kg; Rematore con bilanciere 2×12-15 @17kg; Plank 2×12-15; Leg press 2×12-15 @42.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 2×12-15 @32.5kg; Panca piana 2×12-15 @22.5kg; Rematore con bilanciere 2×12-15 @17kg; Plank 2×12-15; Leg press 2×12-15 @42.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 2×12-15 @32.5kg; Panca piana 2×12-15 @22.5kg; Rematore con bilanciere 2×12-15 @17kg; Plank 2×12-15; Leg press 2×12-15 @42.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 6 — Consolidamento e transizione al mantenimento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 4×8-12 @42.5kg; Panca piana 4×8-12 @27.5kg; Plank 4×8-12; Leg press 4×8-12 @55kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Full Body | Back squat 4×8-12 @42.5kg; Panca piana 4×8-12 @27.5kg; Plank 4×8-12; Leg press 4×8-12 @55kg; Chest press macchina 4×8-12 |
| Gio | Riposo | |
| Ven | Full Body | Back squat 4×8-12 @42.5kg; Panca piana 4×8-12 @27.5kg; Plank 4×8-12; Leg press 4×8-12 @55kg; Chest press macchina 4×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `D14` Dal mese 2 in poi il target è identico (1913 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica

---
