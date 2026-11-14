# Guida iPhone: Comando Rapido per inviare passi e sonno

Le web app non possono leggere l'app Salute. Per questo usiamo l'app **Comandi** (Shortcuts):
un comando legge passi e sonno da Salute e li manda al server con un **token personale**.
Un'automazione lo fa girare da solo più volte al giorno.

Tempo richiesto: circa 10 minuti, una volta sola.

> I nomi delle azioni possono cambiare leggermente tra versioni di iOS. Tra parentesi trovi il nome inglese.

---

## 0. Prima di iniziare

1. Apri la PWA, vai su **Profile → Settings → Data sources → iPhone · Shortcuts**.
2. Tocca **Create token** e **copia il token** (inizia con `wfl_`). Viene mostrato **una sola volta**.
   Se lo perdi, revocalo e creane un altro.
3. Copia anche l'**Endpoint** (finisce con `/functions/v1/ingest-health`).

Il token è come una password: chi lo ha può scrivere i tuoi passi e il tuo sonno. Non condividerlo.

---

## 1. Crea il comando

Apri **Comandi** → **+** in alto a destra → rinominalo **"Winner for Life sync"**.

### Passi di oggi

1. Aggiungi **Trova campioni di Salute** (*Find Health Samples*).
   - Tipo: **Passi** (*Steps*)
   - Filtro: **Data di inizio** è **oggi** (*Start Date is today*)
   - **Raggruppa per: Giorno** (*Group By: Day*). Importante: così iOS somma come l'app Salute
     e non conta due volte iPhone e Apple Watch.
2. Aggiungi **Calcola statistiche** (*Calculate Statistics*) → **Somma** (*Sum*) dei campioni.
3. Rinomina il risultato in **Passi**: tieni premuta l'icona → *Rinomina*.

### Sonno dell'ultima notte

4. Aggiungi **Trova campioni di Salute**.
   - Tipo: **Analisi del sonno** (*Sleep Analysis*)
   - Filtro 1: **Data di fine** è **nelle ultime 18 ore** (*End Date is in the last 18 hours*)
   - Filtro 2: **Valore** **non è** **A letto** (*Value is not In Bed*)
   - Filtro 3: **Valore** **non è** **Sveglio** (*Value is not Awake*)
   - Ordina per: **Data di inizio**, **Dal più vecchio** (*Oldest First*)
5. Aggiungi **Ottieni elemento dall'elenco** (*Get Item from List*) → **Primo elemento**.
6. Aggiungi **Ottieni dettagli dei campioni di Salute** (*Get Details of Health Sample*) → **Data di inizio**.
7. Aggiungi **Formatta data** (*Format Date*) → formato **ISO 8601**, attiva **Includi ora**.
   Rinomina il risultato in **Inizio**.
8. Ripeti i punti 5–7 sullo stesso elenco del punto 4, ma scegli **Ultimo elemento** e **Data di fine**.
   Rinomina il risultato in **Fine**.

### Invio

9. Aggiungi **Ottieni contenuti dell'URL** (*Get Contents of URL*).
   - URL: incolla l'**Endpoint**.
   - Metodo: **POST**.
   - Intestazioni (*Headers*): chiave `Authorization`, valore `Bearer ` seguito dal token
     (esempio: `Bearer wfl_3f9a…`). Attenzione allo spazio dopo `Bearer`.
   - Corpo della richiesta (*Request Body*): **JSON**, con tre campi:
     - `steps` → tipo **Numero** → variabile **Passi**
     - `sleep_start` → tipo **Testo** → variabile **Inizio**
     - `sleep_end` → tipo **Testo** → variabile **Fine**
10. (Solo per la prova) aggiungi **Mostra risultato** (*Show Result*) con il **Contenuti dell'URL**.

Tocca ▶︎. Se tutto è giusto vedi qualcosa come:

```json
{ "ok": true, "saved": { "steps": { "date": "2026-11-14", "steps": 9488 }, "sleep": { … } }, "skipped": [] }
```

Poi apri la PWA: i dati compaiono subito. Ora puoi togliere **Mostra risultato**.

---

## 2. Automazione (gira da sola)

1. **Comandi** → scheda **Automazione** → **+** → **Ora del giorno** (*Time of Day*).
2. Scegli un orario, **Ogni giorno**, poi **Esegui immediatamente** (*Run Immediately*).
   Disattiva **Notifica quando viene eseguito**.
3. Azione: **Esegui comando** → **Winner for Life sync**.
4. Ripeti per altri orari. Consigliati: **09:30**, **14:00**, **19:00**, **23:30**.

Perché più volte? iOS **non lascia leggere Salute mentre l'iPhone è bloccato**. Se a quell'ora
il telefono è bloccato, quell'esecuzione fallisce in silenzio. Con più orari almeno una va a buon fine.
I reinvii non creano doppioni: il server sovrascrive la stessa giornata.

---

## Cosa succede lato server

- Il token viene confrontato con il suo hash (SHA-256). Il token in chiaro non è mai salvato.
- **Passi** → giorno di oggi nel tuo fuso orario.
- **Sonno** → la notte appartiene al giorno del **risveglio**.
- Valori assurdi vengono rifiutati: passi oltre 100.000, sonno oltre 16 ore, date future o più vecchie di 7 giorni.
- Se hai **inserito a mano** passi o sonno per quel giorno, il comando **non li sovrascrive**.

## Problemi comuni

| Messaggio | Causa |
|---|---|
| `Missing or malformed token` | Manca `Bearer ` o il token è incompleto. |
| `Invalid or revoked token` | Il token è stato revocato: creane uno nuovo. |
| `sleep_start and sleep_end must both be ISO 8601 dates` | Il formato data non è ISO 8601, oppure nessun sonno trovato e un solo campo è vuoto. |
| `sleep must last between 1 minute and 16 hours` | Un pisolino pomeridiano allunga l'intervallo: riduci il filtro a "ultime 12 ore". |
| Nessun dato dopo l'automazione | Telefono bloccato a quell'ora: aggiungi un orario in più. |

Limite noto: se non dormi con l'orologio o con il telefono che registra il sonno, Salute non ha dati.
Il comando manda comunque i passi; il sonno lo puoi inserire a mano dalla PWA (pulsante **+**).
