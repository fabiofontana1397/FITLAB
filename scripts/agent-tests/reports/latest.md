# Test dei piani generati dai questionari

Generato il 2026-10-07 17:29 — 18 questionari finti, piani creati con i generatori reali dell’app.

**Totale:** 31 errori · 128 avvisi · 41 note

| Persona | Target kcal | P/C/G (g) | Mesi | Palestra/Corsa a sett. | Errori | Avvisi |
|---|---|---|---|---|---|---|
| Marco, 32 anni | 1938 | 202/161/54 | 5 | 3/0 | 2 | 6 |
| Giulia, 27 anni | 2006 | 112/264/56 | 4 | 4/0 | 1 | 5 |
| Luca, 22 anni | 2875 | 136/403/80 | 7 | 5/0 | 2 | 9 |
| Anna, 45 anni | 1373 | 172/86/38 | 6 | 2/0 | 2 | 8 |
| Paolo, 38 anni | 2583 | 115/369/72 | 4 | 0/4 | 3 | 7 |
| Sara, 30 anni | 2098 | 116/278/58 | 4 | 3/0 | 0 | 8 |
| Roberto, 58 anni | 2546 | 144/333/71 | 4 | 2/0 | 2 | 7 |
| Elena, 35 anni | 1200 | 110/116/33 | 2 | 3/0 | 2 | 5 |
| Davide, 28 anni | 3234 | 275/331/90 | 12 | 4/0 | 1 | 12 |
| Chiara, 25 anni | 1680 | 132/182/47 | 2 | 2/2 | 1 | 9 |
| Andrea, 40 anni | 1702 | 176/144/47 | 3 | –/– | 2 | 6 |
| Ilaria, 29 anni | 2126 | 128/271/59 | 2 | 4/0 | 0 | 0 |
| Giorgio, 34 anni | 2358 | 148/293/66 | 4 | 3/0 | 1 | 11 |
| Valentina, 31 anni | 2193 | 132/279/61 | 3 | 5/0 | 2 | 6 |
| Franco, 67 anni | 1876 | 125/227/52 | 4 | 1/0 | 1 | 9 |
| Tommaso, 35 anni | 2143 | 144/257/60 | 4 | 3/0 | 2 | 8 |
| Nina, 33 anni | 1603 | 154/146/45 | 4 | 3/0 | 3 | 6 |
| Omar, 41 anni | 1903 | 187/170/53 | 4 | –/– | 4 | 6 |

## Controlli generali dell’app

- ❌ `G1` Gli id dei pasti "Segui il piano" (plan-<data>-<pasto>-<n>) non contengono l’utente ma meal_entries.id è chiave primaria globale: due utenti che seguono il piano nello stesso giorno si scontrano e il salvataggio sul server del secondo fallisce in silenzio
- ℹ️ `G2` Nei fusi orari a ovest di Greenwich il giorno della settimana del piano slitta di un giorno (mondayIndex su date ISO): corretto in Italia, sbagliato per utenti in America
- ℹ️ `G3` Peso obiettivo facoltativo ma, se vuoto, il profilo salva 75 kg (valore inventato)
- ⚠️ `G4` generatePlans non ha try/catch: se un generatore lancia un errore isGenerating resta true e la schermata "stiamo creando il tuo piano" non finisce mai
- ❌ `G5` Le risposte vengono salvate sul server a ogni domanda e, al successivo avvio, bastano risposte parziali per considerare l’onboarding completato: chi abbandona il questionario a metà trova Home con profilo a zero e piani generati con target 0 kcal

---

## Marco, 32 anni — dimagrimento, principiante

**Esito:** ❌ NON SUPERATO (2 errori, 6 avvisi, 2 note)

- **Chi è:** Impiegato sedentario, 92 kg per 178 cm, vuole scendere a 82 kg. Mai fatto palestra, 3 giorni a settimana, 45-60 min.
- **Cosa ci aspettiamo:** Deficit moderato (non estremo), proteine alte, durata del piano intorno ai 5 mesi (10 kg a 0,5 kg/sett.), scheda full body principiante con mese 1 di adattamento.

| Dati | Valore |
|---|---|
| Profilo | male · 32 anni · 178 cm · 92 kg → 82 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1878 / 2422 kcal |
| Target calorico | **1938 kcal** (-20% sul fabbisogno) |
| Macro | P 202 g (2.2 g/kg) · C 161 g · G 54 g |
| Idratazione | 3220 ml |
| Durata piano | 5 mesi |

**Piano alimentare** — mesi: 1·2088 kcal → 2·1938 kcal → 3·1938 kcal → 4·1938 kcal → 5·1938 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Fiocchi d’avena 60g, Banana 1 banana | 604 |
| Pranzo 13:00 | Petto di tacchino 260g, Pane integrale 125g, Olio EVO 10g, Noci 20g, Spinaci 150g | 914 |
| Cena 20:00 | Uova intere 4 uova, Riso basmati (cotto) 170g, Olio EVO 10g, Mandorle 30g, Zucchine 150g | 796 |

Totale Lun: **2313 kcal** · P 171 g · C 184 g · G 103 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 230g, Pane integrale 80g, Banana 1 banana | 528 |
| Pranzo 13:00 | Uova intere 4 uova, Pasta (cotta) 140g, Olio EVO 10g, Mandorle 25g, Broccoli 150g | 800 |
| Cena 20:00 | _pasto libero_ | 647 |

Totale Sab: **1327 kcal** · P 75 g · C 130 g · G 60 g

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

**Mese 5 — Mese 5 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×12-15 @37.5kg; Panca piana 3×12-15 @25kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @50kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×12-15 @37.5kg; Panca piana 3×12-15 @25kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @50kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×12-15 @37.5kg; Panca piana 3×12-15 @25kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @50kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Proteine: i pasti danno in media 150 g contro un target di 218 g (69%)
- ❌ `D5` Grassi: i pasti danno in media 95 g contro un target di 58 g (164%)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 4) in 4 pasti della settimana
- ⚠️ `D9` Lun: 7 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 1938 kcal ma il piano (mese 1) ne prescrive 2088 (+150): l’utente vede due numeri diversi
- ⚠️ `R14` I mesi "Mese 2 · Sovraccarico progressivo" (2, 3, 4) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1328 kcal (64% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1938 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Giulia, 27 anni — mantenimento, vegetariana

**Esito:** ❌ NON SUPERATO (1 errori, 5 avvisi, 2 note)

- **Chi è:** Donna, 62 kg per 165 cm, vuole mantenere il peso e migliorare la forma. Intermedia, 4 allenamenti a settimana. Vegetariana.
- **Cosa ci aspettiamo:** Calorie vicine al mantenimento, nessuna carne né pesce nella dieta, split upper/lower a 4 giorni.

| Dati | Valore |
|---|---|
| Profilo | female · 27 anni · 165 cm · 62 kg → 62 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1355 / 2006 kcal |
| Target calorico | **2006 kcal** (0% sul fabbisogno) |
| Macro | P 112 g (1.8 g/kg) · C 264 g · G 56 g |
| Idratazione | 2520 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2006 kcal → 2·2006 kcal → 3·2006 kcal → 4·2006 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Pane integrale 80g, Banana 1 banana | 522 |
| Spuntino mattina 10:30 | Yogurt greco 75g, Pane integrale 25g, Mela 1 mela | 213 |
| Pranzo 13:00 | Fiocchi di latte 300g, Lenticchie (cotte) 220g, Olio EVO 10g, Mandorle 15g, Zucchine 150g | 750 |
| Cena 20:00 | Ricotta 175g, Riso basmati (cotto) 145g, Olio EVO 10g, Noci 20g, Insalata mista 150g | 680 |

Totale Lun: **2164 kcal** · P 123 g · C 208 g · G 98 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 200g, Fiocchi d’avena 45g, Banana 1 banana | 476 |
| Spuntino mattina 10:30 | Fiocchi di latte 65g, Pane integrale 25g, Mela 1 mela | 204 |
| Pranzo 13:00 | Tofu 340g, Riso basmati (cotto) 160g, Olio EVO 10g, Noci 15g, Spinaci 150g | 673 |
| Cena 20:00 | _pasto libero_ | 568 |

Totale Sab: **1352 kcal** · P 76 g · C 152 g · G 55 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @30kg; Military press 4×8-12 @22.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @3kg; Chest press macchina 4×8-12 |
| Mar | Pull | Stacco da terra 4×8-12 @55kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @25kg; Curl bicipiti 4×8-12 @9kg; Lat machine 4×8-12 |
| Mer | Riposo | |
| Gio | Legs | Back squat 4×8-12 @47.5kg; Romanian deadlift 4×8-12 @37.5kg; Leg press 4×8-12 @62.5kg; Affondi 4×8-12 @9kg; Hip thrust 4×8-12 @30kg |
| Ven | Upper | Panca piana 4×8-12 @30kg; Trazioni alla sbarra 4×8-12; Military press 4×8-12 @22.5kg; Curl bicipiti 4×8-12 @9kg; Chest press macchina 4×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @30kg; Military press 4×8-12 @22.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @3kg; Chest press macchina 4×8-12 |
| Mar | Pull | Stacco da terra 4×8-12 @55kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @25kg; Curl bicipiti 4×8-12 @9kg; Lat machine 4×8-12 |
| Mer | Riposo | |
| Gio | Legs | Back squat 4×8-12 @47.5kg; Romanian deadlift 4×8-12 @37.5kg; Leg press 4×8-12 @62.5kg; Affondi 4×8-12 @9kg; Hip thrust 4×8-12 @30kg |
| Ven | Upper | Panca piana 4×8-12 @30kg; Trazioni alla sbarra 4×8-12; Military press 4×8-12 @22.5kg; Curl bicipiti 4×8-12 @9kg; Chest press macchina 4×8-12 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Grassi: i pasti danno in media 85 g contro un target di 56 g (152%)
- ⚠️ `D5` Carboidrati: i pasti danno in media 233 g contro un target di 264 g (88%)
- ⚠️ `D9` Porzioni molto abbondanti in 2 pasti (es. Ven cena: Tofu 340 g)
- ⚠️ `R14` I mesi "Mese 1 · Sovraccarico progressivo" (1, 2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 4 (colazione, spuntinoMattina, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1353 kcal (67% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2006 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Luca, 22 anni — massa muscolare, esperto

**Esito:** ❌ NON SUPERATO (2 errori, 9 avvisi, 2 note)

- **Chi è:** Studente magro (68 kg per 180 cm), vuole arrivare a 75 kg. Esperto, 5 allenamenti a settimana da 60-90 min, 5 pasti.
- **Cosa ci aspettiamo:** Surplus controllato, proteine ~2 g/kg, durata piano ~7 mesi (7 kg a 0,25 kg/sett.), split a 5 giorni senza mese di adattamento.

| Dati | Valore |
|---|---|
| Profilo | male · 22 anni · 180 cm · 68 kg → 75 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1700 / 2567 kcal |
| Target calorico | **2875 kcal** (12% sul fabbisogno) |
| Macro | P 136 g (2.0 g/kg) · C 403 g · G 80 g |
| Idratazione | 2730 ml |
| Durata piano | 7 mesi |

**Piano alimentare** — mesi: 1·2725 kcal → 2·2875 kcal → 3·2875 kcal → 4·2875 kcal → 5·2875 kcal → 6·2875 kcal → 7·2875 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 4 uova, Pane integrale 95g, Banana 1 banana | 613 |
| Spuntino mattina 10:30 | Proteine whey (polvere) 25g, Pane integrale 30g, Mela 1 mela | 247 |
| Pranzo 13:00 | Uova intere 5 uova, Patate dolci 365g, Olio EVO 10g, Avocado 85g, Zucchine 150g | 921 |
| Spuntino pomeriggio 17:00 | Uova intere 1 uovo, Pane integrale 30g, Mirtilli 100g | 224 |
| Cena 20:00 | Yogurt greco 325g, Riso basmati (cotto) 175g, Olio EVO 10g, Noci 25g, Fagiolini 150g | 826 |

Totale Lun: **2830 kcal** · P 152 g · C 288 g · G 126 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 275g, Fiocchi d’avena 60g, Banana 1 banana | 607 |
| Spuntino mattina 10:30 | Uova intere 1 uovo, Pane integrale 30g, Mela 1 mela | 245 |
| Pranzo 13:00 | Uova intere 5 uova, Patate dolci 365g, Olio EVO 10g, Noci 20g, Spinaci 150g | 925 |
| Spuntino pomeriggio 17:00 | Yogurt greco 90g, Pane integrale 30g, Mirtilli 100g | 218 |
| Cena 20:00 | _pasto libero_ | 784 |

Totale Sab: **1995 kcal** · P 104 g · C 224 g · G 81 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @40kg; Military press 4×8-12 @27.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12; Push-up 4×8-12 |
| Mar | Pull | Stacco da terra 4×8-12 @70kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @12kg; Lat machine 4×8-12; Rematore con manubrio 4×8-12 @9kg |
| Mer | Legs | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @77.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg; Leg curl machine 4×8-12 |
| Gio | Riposo | |
| Ven | Upper | Panca piana 4×8-12 @40kg; Trazioni alla sbarra 4×8-12; Military press 4×8-12 @27.5kg; Curl bicipiti 4×8-12 @12kg; Chest press macchina 4×8-12; Lat machine 4×8-12 |
| Sab | Lower | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @77.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg; Leg curl machine 4×8-12 |
| Dom | Riposo | |

**Mese 7 — Mese 7 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @40kg; Military press 4×8-12 @27.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12; Push-up 4×8-12 |
| Mar | Pull | Stacco da terra 4×8-12 @70kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @12kg; Lat machine 4×8-12; Rematore con manubrio 4×8-12 @9kg |
| Mer | Legs | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @77.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg; Leg curl machine 4×8-12 |
| Gio | Riposo | |
| Ven | Upper | Panca piana 4×8-12 @40kg; Trazioni alla sbarra 4×8-12; Military press 4×8-12 @27.5kg; Curl bicipiti 4×8-12 @12kg; Chest press macchina 4×8-12; Lat machine 4×8-12 |
| Sab | Lower | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @77.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg; Leg curl machine 4×8-12 |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Proteine: i pasti danno in media 203 g contro un target di 129 g (157%)
- ❌ `D5` Carboidrati: i pasti danno in media 264 g contro un target di 382 g (69%)
- ⚠️ `D5` Grassi: i pasti danno in media 104 g contro un target di 76 g (137%)
- ⚠️ `D9` Porzione eccessiva: Avocado 85 g (Lun, pranzo)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 5) in 3 pasti della settimana
- ⚠️ `D9` Lun: 9 uova in un giorno
- ⚠️ `D9` Porzioni molto abbondanti in 3 pasti (es. Lun pranzo: Patate dolci 365 g)
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 2875 kcal ma il piano (mese 1) ne prescrive 2725 (-150): l’utente vede due numeri diversi
- ⚠️ `R14` I mesi "Mese 1 · Sovraccarico progressivo" (1, 2, 3, 4, 5, 6) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 5 (colazione, spuntinoMattina, pranzo, spuntinoPomeriggio, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1995 kcal (73% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2875 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Anna, 45 anni — dimagrimento con dolore al ginocchio e intolleranza al lattosio

**Esito:** ❌ NON SUPERATO (2 errori, 8 avvisi, 2 note)

- **Chi è:** Donna, 78 kg per 162 cm, vuole scendere a 65 kg. Sedentaria, principiante, 2 allenamenti. Dolore al ginocchio, intollerante al lattosio.
- **Cosa ci aspettiamo:** Nessun esercizio che carichi il ginocchio, nessun latticino, deficit prudente, durata lunga (13 kg → massimo del range), pochi esercizi per seduta.

| Dati | Valore |
|---|---|
| Profilo | female · 45 anni · 162 cm · 78 kg → 65 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1407 / 1716 kcal |
| Target calorico | **1373 kcal** (-20% sul fabbisogno) |
| Macro | P 172 g (2.2 g/kg) · C 86 g · G 38 g |
| Idratazione | 2730 ml |
| Durata piano | 6 mesi |

**Piano alimentare** — mesi: 1·1523 kcal → 2·1373 kcal → 3·1373 kcal → 4·1373 kcal → 5·1373 kcal → 6·1373 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Fiocchi d’avena 45g, Banana 1 banana | 484 |
| Pranzo 13:00 | Uova intere 4 uova, Patate (bollite) 275g, Olio EVO 10g, Noci 15g, Spinaci 150g | 731 |
| Cena 20:00 | Salmone 115g, Patate dolci 185g, Olio EVO 10g, Mandorle 20g, Zucchine 150g | 628 |

Totale Lun: **1843 kcal** · P 92 g · C 169 g · G 93 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 2 uova, Fiocchi d’avena 35g, Banana 1 banana | 406 |
| Pranzo 13:00 | Salmone 105g, Patate dolci 190g, Olio EVO 10g, Mandorle 15g, Broccoli 150g | 607 |
| Cena 20:00 | _pasto libero_ | 472 |

Totale Sab: **1014 kcal** · P 52 g · C 104 g · G 46 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×15 @18kg; Trazioni alla sbarra 3×15; Military press 3×15 @13kg; Curl bicipiti 3×15 @5kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Romanian deadlift 3×15 @22.5kg; Hip thrust 3×15 @18kg; Abductor machine 3×15; Polpacci alla macchina 3×15 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 6 — Mese 6 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×12-15 @22.5kg; Trazioni alla sbarra 3×12-15; Military press 3×12-15 @15kg; Curl bicipiti 3×12-15 @6kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Romanian deadlift 3×12-15 @25kg; Hip thrust 3×12-15 @22.5kg; Abductor machine 3×12-15; Polpacci alla macchina 3×12-15 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Proteine: i pasti danno in media 104 g contro un target di 191 g (55%)
- ❌ `D5` Grassi: i pasti danno in media 72 g contro un target di 42 g (171%)
- ⚠️ `T9` Carboidrati molto bassi (86 g)
- ⚠️ `D3` Lun: 1843 kcal, 21% rispetto al target
- ⚠️ `D5` Carboidrati: i pasti danno in media 135 g contro un target di 95 g (143%)
- ⚠️ `D9` Lun: 6 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 1373 kcal ma il piano (mese 1) ne prescrive 1523 (+150): l’utente vede due numeri diversi
- ⚠️ `R14` I mesi "Mese 2 · Sovraccarico progressivo" (2, 3, 4, 5) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1013 kcal (67% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1373 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Paolo, 38 anni — solo corsa, resistenza

**Esito:** ❌ NON SUPERATO (3 errori, 7 avvisi, 3 note)

- **Chi è:** Runner amatoriale, 72 kg per 176 cm. Corre 4 volte a settimana, nessuna palestra, vuole migliorare la resistenza.
- **Cosa ci aspettiamo:** Nessuna seduta di palestra, 4 uscite di corsa varie (facili, medio, lungo), carboidrati abbondanti, calorie di mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 38 anni · 176 cm · 72 kg → 72 kg · obiettivo `improveEndurance` |
| Metabolismo basale / fabbisogno | 1635 / 2583 kcal |
| Target calorico | **2583 kcal** (0% sul fabbisogno) |
| Macro | P 115 g (1.6 g/kg) · C 369 g · G 72 g |
| Idratazione | 2870 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2583 kcal → 2·2583 kcal → 3·2583 kcal → 4·2583 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 4 uova, Fiocchi d’avena 70g, Banana 1 banana | 689 |
| Pranzo 13:00 | Uova intere 5 uova, Patate (bollite) 415g, Olio EVO 10g, Noci 25g, Spinaci 150g | 1059 |
| Cena 20:00 | Salmone 175g, Patate dolci 285g, Olio EVO 10g, Mandorle 35g, Zucchine 150g | 926 |

Totale Lun: **2673 kcal** · P 138 g · C 240 g · G 135 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 285g, Fiocchi d’avena 60g, Banana 1 banana | 616 |
| Pranzo 13:00 | Uova intere 5 uova, Patate dolci 320g, Olio EVO 10g, Mandorle 30g, Broccoli 150g | 952 |
| Cena 20:00 | _pasto libero_ | 801 |

Totale Sab: **1569 kcal** · P 83 g · C 161 g · G 71 g

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

- ❌ `D5` Proteine: i pasti danno in media 172 g contro un target di 115 g (149%)
- ❌ `D5` Carboidrati: i pasti danno in media 222 g contro un target di 369 g (60%)
- ❌ `D5` Grassi: i pasti danno in media 113 g contro un target di 72 g (157%)
- ⚠️ `D9` Porzione eccessiva: Patate (bollite) 415 g (Lun, pranzo)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 5) in 5 pasti della settimana
- ⚠️ `D9` Lun: 9 uova in un giorno
- ⚠️ `D9` Porzioni molto abbondanti in 5 pasti (es. Lun pranzo: Patate (bollite) 415 g)
- ⚠️ `H1` Obiettivo settimanale mostrato in Home 2058 kcal contro 0 kcal/sett. voluti dal piano: due modelli energetici diversi
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1568 kcal (61% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2583 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `S2` 4 sedute di corsa a settimana: nell’app compaiono come testo ("Corsa facile 30 min"), senza dettaglio, senza spunta e senza calorie previste; contano come "svolte" solo se registri un’attività quel giorno
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Sara, 30 anni — massa, vegana, allena a casa

**Esito:** ⚠️ SUPERATO CON AVVISI (0 errori, 8 avvisi, 2 note)

- **Chi è:** Donna, 58 kg per 168 cm, vuole mettere massa fino a 62 kg. Vegana, si allena a casa con manubri ed elastici, 3 volte a settimana.
- **Cosa ci aspettiamo:** Dieta senza alcun prodotto animale, proteine vegetali (tofu, legumi), solo esercizi eseguibili con manubri/elastici/corpo libero.

| Dati | Valore |
|---|---|
| Profilo | female · 30 anni · 168 cm · 58 kg → 62 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1319 / 1873 kcal |
| Target calorico | **2098 kcal** (12% sul fabbisogno) |
| Macro | P 116 g (2.0 g/kg) · C 278 g · G 58 g |
| Idratazione | 2030 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1948 kcal → 2·2098 kcal → 3·2098 kcal → 4·2098 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Ceci (cotti) 150g, Fiocchi d’avena 55g, Banana 1 banana | 567 |
| Pranzo 13:00 | Lenticchie (cotte) 280g, Ceci (cotti) 175g, Olio EVO 10g, Noci 20g, Spinaci 150g | 866 |
| Cena 20:00 | Fagioli neri (cotti) 215g, Lenticchie (cotte) 165g, Olio EVO 10g, Avocado 90g, Zucchine 150g | 733 |

Totale Lun: **2165 kcal** · P 110 g · C 313 g · G 63 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Lenticchie (cotte) 180g, Fiocchi d’avena 45g, Banana 1 banana | 491 |
| Pranzo 13:00 | Fagioli neri (cotti) 210g, Lenticchie (cotte) 180g, Olio EVO 10g, Mandorle 20g, Broccoli 150g | 741 |
| Cena 20:00 | _pasto libero_ | 604 |

Totale Sab: **1232 kcal** · P 68 g · C 195 g · G 27 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Squat con manubri 3×12 @6kg; Push-up 3×12; Rematore con manubrio 3×12 @4.5kg; Plank 3×12; Hip thrust 3×12 @11kg |
| Mar | Riposo | |
| Mer | Full Body | Squat con manubri 3×12 @6kg; Push-up 3×12; Rematore con manubrio 3×12 @4.5kg; Plank 3×12; Hip thrust 3×12 @11kg |
| Gio | Riposo | |
| Ven | Full Body | Squat con manubri 3×12 @6kg; Push-up 3×12; Rematore con manubrio 3×12 @4.5kg; Plank 3×12; Hip thrust 3×12 @11kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Squat con manubri 4×8-12 @7kg; Push-up 4×8-12; Rematore con manubrio 4×8-12 @5kg; Plank 4×8-12; Hip thrust 4×8-12 @13kg |
| Mar | Riposo | |
| Mer | Full Body | Squat con manubri 4×8-12 @7kg; Push-up 4×8-12; Rematore con manubrio 4×8-12 @5kg; Plank 4×8-12; Hip thrust 4×8-12 @13kg |
| Gio | Riposo | |
| Ven | Full Body | Squat con manubri 4×8-12 @7kg; Push-up 4×8-12; Rematore con manubrio 4×8-12 @5kg; Plank 4×8-12; Hip thrust 4×8-12 @13kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ⚠️ `D5` Grassi: i pasti danno in media 68 g contro un target di 54 g (127%)
- ⚠️ `D8` Colazione con cibi da pasto principale: Ceci (cotti), Lenticchie (cotte), Fagioli neri (cotti)
- ⚠️ `D9` Porzione eccessiva: Avocado 90 g (Lun, cena)
- ⚠️ `D9` Porzioni molto abbondanti in 3 pasti (es. Mar cena: Tofu 320 g)
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 2098 kcal ma il piano (mese 1) ne prescrive 1948 (-150): l’utente vede due numeri diversi
- ⚠️ `R14` I mesi "Mese 2 · Sovraccarico progressivo" (2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1232 kcal (63% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2098 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Roberto, 58 anni — salute generale, mal di schiena

**Esito:** ❌ NON SUPERATO (2 errori, 7 avvisi, 2 note)

- **Chi è:** Uomo, 90 kg per 175 cm, lavoro in piedi. Vuole stare meglio. Principiante, 2 allenamenti. Mal di schiena lombare.
- **Cosa ci aspettiamo:** Nessun esercizio che carichi la zona lombare (stacchi, rematori, squat pesanti), carichi prudenti, calorie vicine al mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 58 anni · 175 cm · 90 kg → 85 kg · obiettivo `generalHealth` |
| Metabolismo basale / fabbisogno | 1709 / 2546 kcal |
| Target calorico | **2546 kcal** (0% sul fabbisogno) |
| Macro | P 144 g (1.6 g/kg) · C 333 g · G 71 g |
| Idratazione | 3150 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2546 kcal → 2·2546 kcal → 3·2546 kcal → 4·2546 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 4 uova, Fiocchi d’avena 75g, Banana 1 banana | 740 |
| Pranzo 13:00 | Uova intere 6 uova, Patate (bollite) 460g, Olio EVO 10g, Noci 30g, Spinaci 150g | 1176 |
| Cena 20:00 | Salmone 190g, Patate dolci 315g, Olio EVO 10g, Mandorle 40g, Zucchine 150g | 1012 |

Totale Lun: **2928 kcal** · P 152 g · C 261 g · G 148 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 280g, Fiocchi d’avena 60g, Banana 1 banana | 612 |
| Pranzo 13:00 | Uova intere 5 uova, Patate dolci 315g, Olio EVO 10g, Mandorle 30g, Broccoli 150g | 948 |
| Cena 20:00 | _pasto libero_ | 789 |

Totale Sab: **1560 kcal** · P 83 g · C 160 g · G 70 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×10 @20kg; Trazioni alla sbarra 3×10; Military press 3×10 @15kg; Curl bicipiti 3×10 @6kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Leg press 3×10 @42.5kg; Affondi 3×10 @6kg; Hip thrust 3×10 @20kg; Leg curl machine 3×10 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×10 @25kg; Trazioni alla sbarra 3×10; Military press 3×10 @17kg; Curl bicipiti 3×10 @7kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Lower | Leg press 3×10 @50kg; Affondi 3×10 @7kg; Hip thrust 3×10 @25kg; Leg curl machine 3×10 |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Carboidrati: i pasti danno in media 214 g contro un target di 333 g (64%)
- ❌ `D5` Grassi: i pasti danno in media 115 g contro un target di 71 g (162%)
- ⚠️ `D9` Porzione eccessiva: Patate (bollite) 460 g (Lun, pranzo)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 6) in 4 pasti della settimana
- ⚠️ `D9` Lun: 10 uova in un giorno
- ⚠️ `D9` Porzioni molto abbondanti in 2 pasti (es. Lun pranzo: Patate (bollite) 460 g)
- ⚠️ `R14` I mesi "Mese 2 · Sovraccarico progressivo" (2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1560 kcal (61% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2546 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Elena, 35 anni — dimagrimento, corporatura piccola

**Esito:** ❌ NON SUPERATO (2 errori, 5 avvisi, 2 note)

- **Chi è:** Donna, 50 kg per 155 cm, vuole scendere a 47 kg. Sedentaria, 3 allenamenti.
- **Cosa ci aspettiamo:** Il target calorico non deve mai scendere sotto il minimo di sicurezza (1200 kcal) e il deficit non deve essere aggressivo.

| Dati | Valore |
|---|---|
| Profilo | female · 35 anni · 155 cm · 50 kg → 47 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1133 / 1427 kcal |
| Target calorico | **1200 kcal** (-16% sul fabbisogno) |
| Macro | P 110 g (2.2 g/kg) · C 116 g · G 33 g |
| Idratazione | 1750 ml |
| Durata piano | 2 mesi |

**Piano alimentare** — mesi: 1·1350 kcal → 2·1200 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 2 uova, Fiocchi d’avena 40g, Banana 1 banana | 434 |
| Pranzo 13:00 | Uova intere 3 uova, Patate (bollite) 225g, Olio EVO 10g, Noci 10g, Spinaci 150g | 609 |
| Cena 20:00 | Salmone 95g, Patate dolci 155g, Olio EVO 10g, Mandorle 15g, Zucchine 150g | 532 |

Totale Lun: **1573 kcal** · P 78 g · C 148 g · G 79 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 150g, Fiocchi d’avena 30g, Banana 1 banana | 370 |
| Pranzo 13:00 | Uova intere 3 uova, Patate dolci 165g, Olio EVO 10g, Mandorle 10g, Broccoli 150g | 533 |
| Cena 20:00 | _pasto libero_ | 419 |

Totale Sab: **902 kcal** · P 45 g · C 100 g · G 39 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×15 @25kg; Panca piana 3×15 @16kg; Rematore con bilanciere 3×15 @13kg; Plank 3×15; Leg press 3×15 @32.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×15 @25kg; Panca piana 3×15 @16kg; Rematore con bilanciere 3×15 @13kg; Plank 3×15; Leg press 3×15 @32.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×15 @25kg; Panca piana 3×15 @16kg; Rematore con bilanciere 3×15 @13kg; Plank 3×15; Leg press 3×15 @32.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 2 — Mese 2 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Full Body | Back squat 3×12-15 @27.5kg; Panca piana 3×12-15 @19kg; Rematore con bilanciere 3×12-15 @15kg; Plank 3×12-15; Leg press 3×12-15 @37.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×12-15 @27.5kg; Panca piana 3×12-15 @19kg; Rematore con bilanciere 3×12-15 @15kg; Plank 3×12-15; Leg press 3×12-15 @37.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×12-15 @27.5kg; Panca piana 3×12-15 @19kg; Rematore con bilanciere 3×12-15 @15kg; Plank 3×12-15; Leg press 3×12-15 @37.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Proteine: i pasti danno in media 91 g contro un target di 124 g (73%)
- ❌ `D5` Grassi: i pasti danno in media 64 g contro un target di 37 g (173%)
- ⚠️ `D3` Le calorie reali dei pasti (media 1434) si discostano del 6% dal target del mese (1350)
- ⚠️ `D9` Lun: 5 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 1200 kcal ma il piano (mese 1) ne prescrive 1350 (+150): l’utente vede due numeri diversi
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 903 kcal (67% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `T5` Il target è stato forzato al minimo di sicurezza (1200 kcal): il deficit reale è inferiore a quello voluto
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Davide, 28 anni — obesità, obiettivo molto lontano

**Esito:** ❌ NON SUPERATO (1 errori, 12 avvisi, 2 note)

- **Chi è:** Uomo, 125 kg per 185 cm, lavoro fisico, vuole arrivare a 95 kg (−30 kg). Principiante, 4 allenamenti.
- **Cosa ci aspettiamo:** Piano al massimo della durata (12 mesi), deficit sostenibile, proteine calcolate in modo non eccessivo rispetto al peso reale, nessuna scheda estrema.

| Dati | Valore |
|---|---|
| Profilo | male · 28 anni · 185 cm · 125 kg → 95 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 2271 / 4043 kcal |
| Target calorico | **3234 kcal** (-20% sul fabbisogno) |
| Macro | P 275 g (2.2 g/kg) · C 331 g · G 90 g |
| Idratazione | 4725 ml |
| Durata piano | 12 mesi |

**Piano alimentare** — mesi: 1·3384 kcal → 2·3234 kcal → 3·3234 kcal → 4·3234 kcal → 5·3234 kcal → 6·3234 kcal → 7·3234 kcal → 8·3234 kcal → 9·3234 kcal → 10·3234 kcal → 11·3234 kcal → 12·3234 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 5 uova, Fiocchi d’avena 90g, Banana 1 banana | 868 |
| Pranzo 13:00 | Uova intere 7 uova, Patate (bollite) 545g, Olio EVO 10g, Noci 40g, Spinaci 150g | 1402 |
| Cena 20:00 | Salmone 230g, Patate dolci 375g, Olio EVO 10g, Mandorle 50g, Zucchine 150g | 1205 |

Totale Lun: **3473 kcal** · P 182 g · C 304 g · G 177 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 370g, Fiocchi d’avena 80g, Banana 1 banana | 777 |
| Pranzo 13:00 | Uova intere 6 uova, Patate dolci 420g, Olio EVO 10g, Mandorle 45g, Broccoli 150g | 1242 |
| Cena 20:00 | _pasto libero_ | 1049 |

Totale Sab: **2019 kcal** · P 109 g · C 202 g · G 92 g

**Mese 1 — Mese 1 · Adattamento e tecnica**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×15 @30kg; Trazioni alla sbarra 3×15; Military press 3×15 @20kg; Curl bicipiti 3×15 @9kg; Chest press macchina 3×15 |
| Mar | Lower | Back squat 3×15 @45kg; Romanian deadlift 3×15 @35kg; Leg press 3×15 @57.5kg; Affondi 3×15 @9kg; Hip thrust 3×15 @30kg |
| Mer | Riposo | |
| Gio | Upper | Panca piana 3×15 @30kg; Trazioni alla sbarra 3×15; Military press 3×15 @20kg; Curl bicipiti 3×15 @9kg; Chest press macchina 3×15 |
| Ven | Lower | Back squat 3×15 @45kg; Romanian deadlift 3×15 @35kg; Leg press 3×15 @57.5kg; Affondi 3×15 @9kg; Hip thrust 3×15 @30kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 12 — Mese 12 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×12-15 @35kg; Trazioni alla sbarra 3×12-15; Military press 3×12-15 @25kg; Curl bicipiti 3×12-15 @10kg; Chest press macchina 3×12-15 |
| Mar | Lower | Back squat 3×12-15 @52.5kg; Romanian deadlift 3×12-15 @42.5kg; Leg press 3×12-15 @70kg; Affondi 3×12-15 @10kg; Hip thrust 3×12-15 @35kg |
| Mer | Riposo | |
| Gio | Upper | Panca piana 3×12-15 @35kg; Trazioni alla sbarra 3×12-15; Military press 3×12-15 @25kg; Curl bicipiti 3×12-15 @10kg; Chest press macchina 3×12-15 |
| Ven | Lower | Back squat 3×12-15 @52.5kg; Romanian deadlift 3×12-15 @42.5kg; Leg press 3×12-15 @70kg; Affondi 3×12-15 @10kg; Hip thrust 3×12-15 @35kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Grassi: i pasti danno in media 148 g contro un target di 94 g (157%)
- ⚠️ `T7` Proteine 275 g (2.2 g/kg) calcolate sul peso reale con BMI 37: eccessive, andrebbero calcolate sul peso obiettivo/massa magra
- ⚠️ `D5` Proteine: i pasti danno in media 226 g contro un target di 288 g (78%)
- ⚠️ `D5` Carboidrati: i pasti danno in media 282 g contro un target di 346 g (81%)
- ⚠️ `D9` Porzione eccessiva: Patate (bollite) 545 g (Lun, pranzo)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 7) in 7 pasti della settimana
- ⚠️ `D9` Lun: 12 uova in un giorno
- ⚠️ `D9` Porzioni molto abbondanti in 10 pasti (es. Lun pranzo: Patate (bollite) 545 g)
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 3234 kcal ma il piano (mese 1) ne prescrive 3384 (+150): l’utente vede due numeri diversi
- ⚠️ `R14` I mesi "Mese 2 · Sovraccarico progressivo" (2, 3, 4, 5, 6, 7, 8, 9, 10, 11) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `H1` Obiettivo settimanale mostrato in Home -3918 kcal contro -5663 kcal/sett. voluti dal piano: due modelli energetici diversi
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 2019 kcal (60% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (3234 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Chiara, 25 anni — palestra + corsa, giorni insufficienti

**Esito:** ❌ NON SUPERATO (1 errori, 9 avvisi, 2 note)

- **Chi è:** Donna, 60 kg per 168 cm. Vorrebbe 3 palestra + 3 corsa ma ha solo 4 giorni disponibili. Obiettivo dimagrimento.
- **Cosa ci aspettiamo:** Il piano deve rispettare i 4 giorni disponibili (non 6 sedute), bilanciando palestra e corsa, senza mettere due sedute lo stesso giorno.

| Dati | Valore |
|---|---|
| Profilo | female · 25 anni · 168 cm · 60 kg → 56 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1364 / 2101 kcal |
| Target calorico | **1680 kcal** (-20% sul fabbisogno) |
| Macro | P 132 g (2.2 g/kg) · C 182 g · G 47 g |
| Idratazione | 2450 ml |
| Durata piano | 2 mesi |

**Piano alimentare** — mesi: 1·1830 kcal → 2·1680 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Fiocchi d’avena 50g, Banana 1 banana | 519 |
| Pranzo 13:00 | Uova intere 4 uova, Patate (bollite) 295g, Olio EVO 10g, Noci 15g, Spinaci 150g | 773 |
| Cena 20:00 | Salmone 125g, Patate dolci 200g, Olio EVO 10g, Mandorle 20g, Zucchine 150g | 662 |

Totale Lun: **1952 kcal** · P 99 g · C 180 g · G 98 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 200g, Fiocchi d’avena 45g, Banana 1 banana | 476 |
| Pranzo 13:00 | Uova intere 3 uova, Patate dolci 225g, Olio EVO 10g, Mandorle 20g, Broccoli 150g | 705 |
| Cena 20:00 | _pasto libero_ | 567 |

Totale Sab: **1180 kcal** · P 60 g · C 126 g · G 52 g

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

**Mese 2 — Mese 2 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Upper | Panca piana 3×12-15 @30kg; Trazioni alla sbarra 3×12-15; Military press 3×12-15 @20kg; Curl bicipiti 3×12-15 @9kg; Chest press macchina 3×12-15 |
| Mar | Lower | Back squat 3×12-15 @45kg; Romanian deadlift 3×12-15 @35kg; Leg press 3×12-15 @60kg; Affondi 3×12-15 @9kg; Hip thrust 3×12-15 @30kg |
| Mer | Riposo | |
| Gio | Corsa | Corsa facile 35 min |
| Ven | Corsa | Corsa a ritmo medio 30 min |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Grassi: i pasti danno in media 82 g contro un target di 51 g (160%)
- ⚠️ `D5` Proteine: i pasti danno in media 122 g contro un target di 144 g (85%)
- ⚠️ `D5` Carboidrati: i pasti danno in media 167 g contro un target di 198 g (84%)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 4) in 1 pasti della settimana
- ⚠️ `D9` Lun: 7 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 1680 kcal ma il piano (mese 1) ne prescrive 1830 (+150): l’utente vede due numeri diversi
- ⚠️ `C3` Il fabbisogno calorico assume 6 allenamenti a settimana (risposte freq_*) ma il piano ne programma 4
- ⚠️ `H1` Obiettivo settimanale mostrato in Home -121 kcal contro -2947 kcal/sett. voluti dal piano: due modelli energetici diversi
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1181 kcal (65% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `S2` 2 sedute di corsa a settimana: nell’app compaiono come testo ("Corsa facile 35 min"), senza dettaglio, senza spunta e senza calorie previste; contano come "svolte" solo se registri un’attività quel giorno
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Andrea, 40 anni — solo dieta

**Esito:** ❌ NON SUPERATO (2 errori, 6 avvisi, 4 note)

- **Chi è:** Uomo, 80 kg per 180 cm, vuole solo un piano alimentare per dimagrire a 75 kg. Non usa la parte allenamento.
- **Cosa ci aspettiamo:** Il piano di allenamento non deve esistere, la dieta deve essere completa; le schermate di allenamento devono gestire l’assenza del piano.

| Dati | Valore |
|---|---|
| Profilo | male · 40 anni · 180 cm · 80 kg → 75 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1730 / 2128 kcal |
| Target calorico | **1702 kcal** (-20% sul fabbisogno) |
| Macro | P 176 g (2.2 g/kg) · C 144 g · G 47 g |
| Idratazione | 2800 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·1852 kcal → 2·1702 kcal → 3·1702 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Fiocchi d’avena 50g, Banana 1 banana | 511 |
| Pranzo 13:00 | Uova intere 4 uova, Patate (bollite) 245g, Olio EVO 10g, Noci 20g, Spinaci 150g | 746 |
| Cena 20:00 | Salmone 120g, Patate dolci 160g, Olio EVO 10g, Mandorle 25g, Zucchine 150g | 647 |

Totale Lun: **1902 kcal** · P 96 g · C 163 g · G 101 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 220g, Fiocchi d’avena 50g, Banana 1 banana | 515 |
| Pranzo 13:00 | Uova intere 4 uova, Patate dolci 245g, Olio EVO 10g, Mandorle 20g, Broccoli 150g | 745 |
| Cena 20:00 | _pasto libero_ | 617 |

Totale Sab: **1260 kcal** · P 65 g · C 134 g · G 56 g

_Nessun piano di allenamento generato._

**Controlli**

- ❌ `D5` Proteine: i pasti danno in media 124 g contro un target di 192 g (64%)
- ❌ `D5` Grassi: i pasti danno in media 86 g contro un target di 51 g (169%)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 4) in 2 pasti della settimana
- ⚠️ `D9` Lun: 6 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 1702 kcal ma il piano (mese 1) ne prescrive 1852 (+150): l’utente vede due numeri diversi
- ⚠️ `P1` Utente solo dieta: il profilo salva sport "gym" per default (compare in Profilo come "Sala pesi")
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1260 kcal (68% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1702 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `C3` Utente solo dieta: nessun allenamento nel calcolo del fabbisogno (corretto), ma la Home mostrerà comunque tasti di registrazione allenamento
- ℹ️ `S3` Utente solo dieta: la tab Allenamento resta visibile e mostra "Nessun programma generato… scegliendo sala pesi o corsa", frase fuorviante perché la domanda non è mai stata posta
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Ilaria, 29 anni — solo allenamento, forza

**Esito:** ✅ SUPERATO (0 errori, 0 avvisi, 2 note)

- **Chi è:** Donna, 64 kg per 170 cm, vuole solo la scheda per aumentare la forza. 4 giorni, esperta.
- **Cosa ci aspettiamo:** Il piano alimentare non deve esistere, la scheda deve avere schemi di forza (poche ripetizioni, recuperi lunghi).

| Dati | Valore |
|---|---|
| Profilo | female · 29 anni · 170 cm · 64 kg → 66 kg · obiettivo `gainStrength` |
| Metabolismo basale / fabbisogno | 1397 / 2025 kcal |
| Target calorico | **2126 kcal** (5% sul fabbisogno) |
| Macro | P 128 g (2.0 g/kg) · C 271 g · G 59 g |
| Idratazione | 2590 ml |
| Durata piano | 2 mesi |

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

**Mese 2 — Mese 2 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 5×3-5 @37.5kg; Military press 5×3-5 @25kg; Dip alle parallele 5×3-5; Alzate laterali 5×3-5 @3.5kg; Chest press macchina 5×3-5; Push-up 5×3-5 |
| Mar | Pull | Stacco da terra 5×3-5 @65kg; Trazioni zavorrate 5×3-5; Rematore con bilanciere 5×3-5 @30kg; Curl bicipiti 5×3-5 @11kg; Lat machine 5×3-5; Rematore con manubrio 5×3-5 @9kg |
| Mer | Riposo | |
| Gio | Legs | Back squat 5×3-5 @55kg; Romanian deadlift 5×3-5 @45kg; Leg press 5×3-5 @72.5kg; Affondi 5×3-5 @11kg; Hip thrust 5×3-5 @37.5kg; Leg curl machine 5×3-5 |
| Ven | Upper | Panca piana 5×3-5 @37.5kg; Trazioni alla sbarra 5×3-5; Military press 5×3-5 @25kg; Curl bicipiti 5×3-5 @11kg; Chest press macchina 5×3-5; Lat machine 5×3-5 |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ℹ️ `S4` Utente solo allenamento: Home e Nutrizione mostrano comunque target calorici e macro del profilo (nessun piano alimentare dietro) e la tab Nutrizione mostra tutti e 6 i pasti
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Giorgio, 34 anni — celiaco e allergico alla frutta secca

**Esito:** ❌ NON SUPERATO (1 errori, 11 avvisi, 2 note)

- **Chi è:** Uomo, 82 kg per 181 cm, mantenimento. Celiaco (niente glutine) e allergico alla frutta secca e alle noci. 3 allenamenti.
- **Cosa ci aspettiamo:** Nessuna fonte di glutine (pasta, pane, couscous…) e nessuna frutta secca in nessun pasto del piano.

| Dati | Valore |
|---|---|
| Profilo | male · 34 anni · 181 cm · 82 kg → 82 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1786 / 2358 kcal |
| Target calorico | **2358 kcal** (0% sul fabbisogno) |
| Macro | P 148 g (1.8 g/kg) · C 293 g · G 66 g |
| Idratazione | 2870 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2358 kcal → 2·2358 kcal → 3·2358 kcal → 4·2358 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 4 uova, Fiocchi d’avena 65g, Banana 1 banana | 655 |
| Pranzo 13:00 | Uova intere 5 uova, Patate dolci 400g, Olio EVO 10g, Spinaci 150g | 862 |
| Cena 20:00 | Salmone 165g, Riso basmati (cotto) 190g, Olio EVO 10g, Zucchine 150g | 687 |

Totale Lun: **2203 kcal** · P 121 g · C 213 g · G 98 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 260g, Fiocchi d’avena 55g, Banana 1 banana | 573 |
| Pranzo 13:00 | Uova intere 4 uova, Patate (bollite) 290g, Olio EVO 10g, Broccoli 150g | 724 |
| Cena 20:00 | _pasto libero_ | 731 |

Totale Sab: **1298 kcal** · P 72 g · C 144 g · G 52 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @40kg; Military press 4×8-12 @27.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @75kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @12kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @62.5kg; Romanian deadlift 4×8-12 @50kg; Leg press 4×8-12 @82.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @40kg; Military press 4×8-12 @27.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @75kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @12kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @62.5kg; Romanian deadlift 4×8-12 @50kg; Leg press 4×8-12 @82.5kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D3` Le calorie reali dei pasti (media 2011) si discostano del -15% dal target del mese (2358)
- ⚠️ `D3` Mar: 1808 kcal, -23% rispetto al target
- ⚠️ `D3` Gio: 1844 kcal, -22% rispetto al target
- ⚠️ `D3` Dom: 1812 kcal, -23% rispetto al target
- ⚠️ `D5` Carboidrati: i pasti danno in media 194 g contro un target di 293 g (66%)
- ⚠️ `D5` Grassi: i pasti danno in media 73 g contro un target di 66 g (111%)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 5) in 6 pasti della settimana
- ⚠️ `D9` Lun: 9 uova in un giorno
- ⚠️ `D9` Porzioni molto abbondanti in 2 pasti (es. Lun pranzo: Patate dolci 400 g)
- ⚠️ `R14` I mesi "Mese 1 · Sovraccarico progressivo" (1, 2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1297 kcal (55% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2358 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Valentina, 31 anni — spalla infortunata, preferisce Push/Pull/Legs

**Esito:** ❌ NON SUPERATO (2 errori, 6 avvisi, 2 note)

- **Chi è:** Donna, 66 kg per 172 cm, ipertrofia. Esperta, 5 giorni, vuole Push/Pull/Legs. Infortunio recente alla spalla sinistra.
- **Cosa ci aspettiamo:** Nessun esercizio che sovraccarichi la spalla (panca, military press, dip, alzate…), anche se la preferenza è PPL: la sicurezza prevale.

| Dati | Valore |
|---|---|
| Profilo | female · 31 anni · 172 cm · 66 kg → 69 kg · obiettivo `gainMuscle` |
| Metabolismo basale / fabbisogno | 1419 / 1958 kcal |
| Target calorico | **2193 kcal** (12% sul fabbisogno) |
| Macro | P 132 g (2.0 g/kg) · C 279 g · G 61 g |
| Idratazione | 2660 ml |
| Durata piano | 3 mesi |

**Piano alimentare** — mesi: 1·2043 kcal → 2·2193 kcal → 3·2193 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Fiocchi d’avena 55g, Banana 1 banana | 561 |
| Pranzo 13:00 | Uova intere 4 uova, Patate (bollite) 320g, Olio EVO 10g, Noci 15g, Spinaci 150g | 817 |
| Cena 20:00 | Salmone 135g, Patate dolci 220g, Olio EVO 10g, Mandorle 25g, Zucchine 150g | 729 |

Totale Lun: **2107 kcal** · P 108 g · C 194 g · G 105 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 245g, Fiocchi d’avena 55g, Banana 1 banana | 559 |
| Pranzo 13:00 | Uova intere 4 uova, Patate dolci 325g, Olio EVO 10g, Mandorle 20g, Broccoli 150g | 853 |
| Cena 20:00 | _pasto libero_ | 700 |

Totale Sab: **1411 kcal** · P 73 g · C 155 g · G 60 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Back squat 4×8-12 @57.5kg; Rematore con bilanciere 4×8-12 @30kg; Plank 4×8-12; Leg press 4×8-12 @75kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12 |
| Mar | Pull | Stacco da terra 4×8-12 @67.5kg; Rematore con bilanciere 4×8-12 @30kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12; Rematore con manubrio 4×8-12 @9kg |
| Mer | Legs | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @45kg; Leg press 4×8-12 @75kg; Affondi 4×8-12 @11kg; Hip thrust 4×8-12 @37.5kg; Leg curl machine 4×8-12 |
| Gio | Riposo | |
| Ven | Push | Back squat 4×8-12 @57.5kg; Rematore con bilanciere 4×8-12 @30kg; Plank 4×8-12; Leg press 4×8-12 @75kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12 |
| Sab | Pull | Stacco da terra 4×8-12 @67.5kg; Rematore con bilanciere 4×8-12 @30kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12; Rematore con manubrio 4×8-12 @9kg |
| Dom | Riposo | |

**Mese 3 — Mese 3 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Back squat 4×8-12 @57.5kg; Rematore con bilanciere 4×8-12 @30kg; Plank 4×8-12; Leg press 4×8-12 @75kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12 |
| Mar | Pull | Stacco da terra 4×8-12 @67.5kg; Rematore con bilanciere 4×8-12 @30kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12; Rematore con manubrio 4×8-12 @9kg |
| Mer | Legs | Back squat 4×8-12 @57.5kg; Romanian deadlift 4×8-12 @45kg; Leg press 4×8-12 @75kg; Affondi 4×8-12 @11kg; Hip thrust 4×8-12 @37.5kg; Leg curl machine 4×8-12 |
| Gio | Riposo | |
| Ven | Push | Back squat 4×8-12 @57.5kg; Rematore con bilanciere 4×8-12 @30kg; Plank 4×8-12; Leg press 4×8-12 @75kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12 |
| Sab | Pull | Stacco da terra 4×8-12 @67.5kg; Rematore con bilanciere 4×8-12 @30kg; Curl bicipiti 4×8-12 @11kg; Lat machine 4×8-12; Rematore con manubrio 4×8-12 @9kg |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Carboidrati: i pasti danno in media 180 g contro un target di 260 g (69%)
- ❌ `D5` Grassi: i pasti danno in media 89 g contro un target di 57 g (157%)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 4) in 3 pasti della settimana
- ⚠️ `D9` Lun: 7 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 2193 kcal ma il piano (mese 1) ne prescrive 2043 (-150): l’utente vede due numeri diversi
- ⚠️ `R14` I mesi "Mese 1 · Sovraccarico progressivo" (1, 2) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1412 kcal (69% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2193 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Franco, 67 anni — salute, sedentario, un solo giorno

**Esito:** ❌ NON SUPERATO (1 errori, 9 avvisi, 2 note)

- **Chi è:** Uomo, 78 kg per 170 cm, pensionato. Può allenarsi 1 volta a settimana, 30 minuti, principiante.
- **Cosa ci aspettiamo:** Una sola seduta a settimana (full body, 3 esercizi), piano non invasivo, calorie di mantenimento.

| Dati | Valore |
|---|---|
| Profilo | male · 67 anni · 170 cm · 78 kg → 76 kg · obiettivo `generalHealth` |
| Metabolismo basale / fabbisogno | 1513 / 1876 kcal |
| Target calorico | **1876 kcal** (0% sul fabbisogno) |
| Macro | P 125 g (1.6 g/kg) · C 227 g · G 52 g |
| Idratazione | 2730 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1876 kcal → 2·1876 kcal → 3·1876 kcal → 4·1876 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 4 uova, Fiocchi d’avena 70g, Banana 1 banana | 681 |
| Pranzo 13:00 | Uova intere 5 uova, Patate (bollite) 410g, Olio EVO 10g, Noci 25g, Spinaci 150g | 1047 |
| Cena 20:00 | Salmone 170g, Patate dolci 280g, Olio EVO 10g, Mandorle 35g, Zucchine 150g | 912 |

Totale Lun: **2638 kcal** · P 136 g · C 238 g · G 133 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 205g, Fiocchi d’avena 45g, Banana 1 banana | 481 |
| Pranzo 13:00 | Uova intere 3 uova, Patate dolci 230g, Olio EVO 10g, Mandorle 20g, Broccoli 150g | 717 |
| Cena 20:00 | _pasto libero_ | 582 |

Totale Sab: **1197 kcal** · P 62 g · C 127 g · G 53 g

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
| Lun | Full Body | Back squat 3×10 @32.5kg; Panca piana 3×10 @22.5kg; Rematore con bilanciere 3×10 @17kg |
| Mar | Riposo | |
| Mer | Riposo | |
| Gio | Riposo | |
| Ven | Riposo | |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Grassi: i pasti danno in media 88 g contro un target di 52 g (169%)
- ⚠️ `D3` Lun: 2638 kcal, 41% rispetto al target
- ⚠️ `D5` Carboidrati: i pasti danno in media 164 g contro un target di 227 g (72%)
- ⚠️ `D9` Porzione eccessiva: Patate (bollite) 410 g (Lun, pranzo)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 5) in 2 pasti della settimana
- ⚠️ `D9` Lun: 9 uova in un giorno
- ⚠️ `D9` Porzioni molto abbondanti in 1 pasti (es. Lun pranzo: Patate (bollite) 410 g)
- ⚠️ `R14` I mesi "Mese 2 · Sovraccarico progressivo" (2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1198 kcal (64% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1876 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Tommaso, 35 anni — si allena una volta ogni due settimane

**Esito:** ❌ NON SUPERATO (2 errori, 8 avvisi, 2 note)

- **Chi è:** Uomo, 80 kg per 178 cm, mantenimento. In palestra va "una volta ogni 2 settimane" e ha 3 giorni disponibili.
- **Cosa ci aspettiamo:** Il piano non deve inventare 3 sedute a settimana per chi ne fa meno di una; il fabbisogno e il piano devono contare lo stesso numero di allenamenti.

| Dati | Valore |
|---|---|
| Profilo | male · 35 anni · 178 cm · 80 kg → 80 kg · obiettivo `maintainImprove` |
| Metabolismo basale / fabbisogno | 1743 / 2143 kcal |
| Target calorico | **2143 kcal** (0% sul fabbisogno) |
| Macro | P 144 g (1.8 g/kg) · C 257 g · G 60 g |
| Idratazione | 2800 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2143 kcal → 2·2143 kcal → 3·2143 kcal → 4·2143 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 4 uova, Fiocchi d’avena 60g, Banana 1 banana | 611 |
| Pranzo 13:00 | Uova intere 5 uova, Patate (bollite) 360g, Olio EVO 10g, Noci 20g, Spinaci 150g | 924 |
| Cena 20:00 | Salmone 150g, Patate dolci 245g, Olio EVO 10g, Mandorle 30g, Zucchine 150g | 811 |

Totale Lun: **2345 kcal** · P 120 g · C 212 g · G 118 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 235g, Fiocchi d’avena 50g, Banana 1 banana | 530 |
| Pranzo 13:00 | Uova intere 4 uova, Patate dolci 265g, Olio EVO 10g, Mandorle 25g, Broccoli 150g | 814 |
| Cena 20:00 | _pasto libero_ | 664 |

Totale Sab: **1344 kcal** · P 70 g · C 140 g · G 60 g

**Mese 1 — Mese 1 · Sovraccarico progressivo**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @40kg; Military press 4×8-12 @27.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @72.5kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @12kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @60kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @80kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Mese 4 — Mese 4 · Consolidamento**

| Giorno | Seduta | Dettaglio |
|---|---|---|
| Lun | Push | Panca piana 4×8-12 @40kg; Military press 4×8-12 @27.5kg; Dip alle parallele 4×8-12; Alzate laterali 4×8-12 @4kg; Chest press macchina 4×8-12 |
| Mar | Riposo | |
| Mer | Pull | Stacco da terra 4×8-12 @72.5kg; Trazioni zavorrate 4×8-12; Rematore con bilanciere 4×8-12 @32.5kg; Curl bicipiti 4×8-12 @12kg; Lat machine 4×8-12 |
| Gio | Riposo | |
| Ven | Legs | Back squat 4×8-12 @60kg; Romanian deadlift 4×8-12 @47.5kg; Leg press 4×8-12 @80kg; Affondi 4×8-12 @12kg; Hip thrust 4×8-12 @40kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Grassi: i pasti danno in media 97 g contro un target di 60 g (162%)
- ❌ `P4` freq_gym="biweekly" (meno di una volta a settimana): il piano programma 3 sedute settimanali, il fabbisogno calorico ne conta 0
- ⚠️ `D5` Carboidrati: i pasti danno in media 188 g contro un target di 257 g (73%)
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 5) in 3 pasti della settimana
- ⚠️ `D9` Lun: 8 uova in un giorno
- ⚠️ `D9` Porzioni molto abbondanti in 3 pasti (es. Lun pranzo: Patate (bollite) 360 g)
- ⚠️ `R14` I mesi "Mese 1 · Sovraccarico progressivo" (1, 2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `C3` Il fabbisogno calorico assume 0 allenamenti a settimana (risposte freq_*) ma il piano ne programma 3
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1344 kcal (63% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (2143 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Nina, 33 anni — dimagrimento senza peso obiettivo

**Esito:** ❌ NON SUPERATO (3 errori, 6 avvisi, 2 note)

- **Chi è:** Donna, 70 kg per 166 cm, vuole dimagrire ma lascia vuoto il peso obiettivo (domanda facoltativa).
- **Cosa ci aspettiamo:** Il profilo e le schermate non devono usare un peso obiettivo inventato; la durata del piano deve avere senso anche senza obiettivo.

| Dati | Valore |
|---|---|
| Profilo | female · 33 anni · 166 cm · 70 kg → undefined kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1412 / 2004 kcal |
| Target calorico | **1603 kcal** (-20% sul fabbisogno) |
| Macro | P 154 g (2.2 g/kg) · C 146 g · G 45 g |
| Idratazione | 2450 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·1753 kcal → 2·1603 kcal → 3·1603 kcal → 4·1603 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Fiocchi d’avena 50g, Banana 1 banana | 519 |
| Pranzo 13:00 | Uova intere 4 uova, Patate (bollite) 295g, Olio EVO 10g, Noci 15g, Spinaci 150g | 773 |
| Cena 20:00 | Salmone 125g, Patate dolci 200g, Olio EVO 10g, Mandorle 20g, Zucchine 150g | 662 |

Totale Lun: **1952 kcal** · P 99 g · C 180 g · G 98 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 190g, Fiocchi d’avena 40g, Banana 1 banana | 447 |
| Pranzo 13:00 | Uova intere 3 uova, Patate dolci 215g, Olio EVO 10g, Mandorle 15g, Broccoli 150g | 659 |
| Cena 20:00 | _pasto libero_ | 543 |

Totale Sab: **1106 kcal** · P 57 g · C 119 g · G 49 g

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
| Lun | Full Body | Back squat 3×12-15 @40kg; Panca piana 3×12-15 @27.5kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @52.5kg |
| Mar | Riposo | |
| Mer | Full Body | Back squat 3×12-15 @40kg; Panca piana 3×12-15 @27.5kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @52.5kg |
| Gio | Riposo | |
| Ven | Full Body | Back squat 3×12-15 @40kg; Panca piana 3×12-15 @27.5kg; Rematore con bilanciere 3×12-15 @20kg; Plank 3×12-15; Leg press 3×12-15 @52.5kg |
| Sab | Riposo | |
| Dom | Riposo | |

**Controlli**

- ❌ `D5` Proteine: i pasti danno in media 117 g contro un target di 168 g (69%)
- ❌ `D5` Grassi: i pasti danno in media 80 g contro un target di 49 g (163%)
- ❌ `P2` Peso obiettivo non indicato: il profilo (Progressi, grafico del peso, Profilo) usa un valore inventato di 75 kg, nella direzione sbagliata rispetto all’obiettivo (peso attuale 70 kg), mentre il piano usa la durata standard di 4 mesi
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 4) in 1 pasti della settimana
- ⚠️ `D9` Lun: 7 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 1603 kcal ma il piano (mese 1) ne prescrive 1753 (+150): l’utente vede due numeri diversi
- ⚠️ `R14` I mesi "Mese 2 · Sovraccarico progressivo" (2, 3) sono identici: stessi esercizi, serie, ripetizioni e carichi — nel piano non c’è un vero sovraccarico progressivo
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1106 kcal (63% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1603 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---

## Omar, 41 anni — ora solo dieta, ma aveva già fatto il questionario con allenamento

**Esito:** ❌ NON SUPERATO (4 errori, 6 avvisi, 4 note)

- **Chi è:** Uomo, 85 kg per 180 cm. Rifà il questionario scegliendo solo dieta; nelle risposte restano i dati di allenamento di prima (4 allenamenti di palestra).
- **Cosa ci aspettiamo:** Con modalità "solo dieta" le vecchie risposte di allenamento non devono influenzare né il fabbisogno né l’alternanza giorni allenamento/riposo.

| Dati | Valore |
|---|---|
| Profilo | male · 41 anni · 178 cm · 85 kg → 78 kg · obiettivo `loseFat` |
| Metabolismo basale / fabbisogno | 1763 / 2379 kcal |
| Target calorico | **1903 kcal** (-20% sul fabbisogno) |
| Macro | P 187 g (2.2 g/kg) · C 170 g · G 53 g |
| Idratazione | 3325 ml |
| Durata piano | 4 mesi |

**Piano alimentare** — mesi: 1·2053 kcal → 2·1903 kcal → 3·1903 kcal → 4·1903 kcal

Esempio giorno di allenamento (Lun) e pasto libero (Sab):

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Uova intere 3 uova, Fiocchi d’avena 55g, Banana 1 banana | 569 |
| Pranzo 13:00 | Uova intere 4 uova, Patate (bollite) 330g, Olio EVO 10g, Noci 20g, Spinaci 150g | 867 |
| Cena 20:00 | Salmone 140g, Patate dolci 225g, Olio EVO 10g, Mandorle 25g, Zucchine 150g | 744 |

Totale Lun: **2178 kcal** · P 111 g · C 197 g · G 110 g

| Pasto | Alimenti | kcal |
|---|---|---|
| Colazione 07:30 | Yogurt greco 225g, Fiocchi d’avena 50g, Banana 1 banana | 520 |
| Pranzo 13:00 | Uova intere 4 uova, Patate dolci 255g, Olio EVO 10g, Mandorle 20g, Broccoli 150g | 769 |
| Cena 20:00 | _pasto libero_ | 636 |

Totale Sab: **1289 kcal** · P 67 g · C 137 g · G 57 g

_Nessun piano di allenamento generato._

**Controlli**

- ❌ `D5` Proteine: i pasti danno in media 137 g contro un target di 202 g (68%)
- ❌ `D5` Grassi: i pasti danno in media 92 g contro un target di 57 g (162%)
- ❌ `P3` Utente solo dieta con risposte di allenamento rimaste da un questionario precedente: il fabbisogno conta 4 allenamenti/sett.
- ❌ `P3` Utente solo dieta: la dieta alterna giorni di allenamento/riposo in base a risposte vecchie
- ⚠️ `D9` Troppe uova in un solo pasto (fino a 4) in 3 pasti della settimana
- ⚠️ `D9` Lun: 7 uova in un giorno
- ⚠️ `D15` La scheda profilo dell’onboarding mostra 1903 kcal ma il piano (mese 1) ne prescrive 2053 (+150): l’utente vede due numeri diversi
- ⚠️ `H1` Obiettivo settimanale mostrato in Home -434 kcal contro -3332 kcal/sett. voluti dal piano: due modelli energetici diversi
- ⚠️ `N1` La tab Nutrizione mostra sempre 6 pasti (con orari fissi) ma l’utente ne fa 3 (colazione, pranzo, cena): compaiono schede di pasti che non fa
- ⚠️ `N3` Sab: con "Segui il piano" il giorno si riempie con 1289 kcal (63% del target): la cena libera non aggiunge nulla e l’anello calorie resta sotto
- ℹ️ `D14` Dal mese 2 in poi il target è identico (1903 kcal): nessuna periodizzazione automatica nel piano, solo l’aggiustamento mensile (check-in) lo modifica
- ℹ️ `C3` Utente solo dieta: il fabbisogno assume 4 allenamenti/sett.
- ℹ️ `S3` Utente solo dieta: la tab Allenamento resta visibile e mostra "Nessun programma generato… scegliendo sala pesi o corsa", frase fuorviante perché la domanda non è mai stata posta
- ℹ️ `Q4` Risposte raccolte ma non usate da nessuna parte: generalActivityLevel, bedTime, wakeTime, sleepQuality

---
