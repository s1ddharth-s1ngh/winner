# PROJECT BRIEF — Winner for Life

App privata di sfide tra amici su passi e sonno, con stelle, classifiche, streak e badge.
Ispirata a StepUp, ma fatta da noi e su misura per il nostro gruppo.

---

## Come lavoriamo (leggi per primo)

- Parlami in **italiano** e spiegami le scelte in modo semplice.
- Tutto ciò che sta nell'app (testi, UI) e nel codice (nomi, commenti, commit) è in **inglese**.
- Lavora **una fase alla volta**. Prima di scrivere codice per una fase, proponimi il piano e aspetta il mio ok.
- Se una scelta è importante o ha alternative, chiedimelo invece di decidere da solo.
- **Vincolo di costo: zero.** Supabase piano gratuito, niente account Apple Developer, niente Play Store.
- Mai committare chiavi o segreti: usa `.env` (in `.gitignore`) e un `.env.example`.

> Aggiornamento (2026-11-14): il proprietario ha chiesto di eseguire tutte le fasi di fila senza fermarsi,
> frontend prima (tema chiaro), Supabase dopo; solo commit locali, niente push.

---

## L'idea

- Gruppo piccolo di amici (4–10 persone), con telefoni misti: io ho Android, la mia migliore amica ha iPhone, gli altri non si sa.
- Ognuno vede i propri passi e il proprio sonno, e ci sfidiamo in classifiche di gruppo.
- Il gioco deve spingerci ad abitudini migliori, soprattutto ad andare a letto presto.
- Gli allenamenti contano poco: sono un hobby, non il centro dell'app (ma ne registriamo la durata).
- L'app crescerà a poco a poco: aggiungeremo e toglieremo funzioni, quindi il codice deve essere facile da modificare.
- Anche se è per amici, deve sembrare un prodotto professionale che un domani si potrebbe vendere.
- Font: **Manrope**.

---

## Architettura

**Frontend**
- React + TypeScript + Vite + Tailwind, mobile-first.
- Installabile come PWA (`vite-plugin-pwa`).

**Backend: Supabase (piano gratuito)**
- Auth, Postgres con RLS su **tutte** le tabelle, Realtime per la classifica live, Edge Functions.

**Login**
- Niente magic link (su iPhone il link si apre in Safari e non nella PWA).
- Scelta: email + password.

**Da dove arrivano i dati di salute**

Le web app NON possono leggere i dati di salute, quindi passi e sonno arrivano in tre modi.

1. **Android:** la stessa app impacchettata con **Capacitor** + `@capgo/capacitor-health` (Health Connect). APK installato a mano. Garmin → Garmin Connect → Health Connect.
2. **iPhone:** PWA + **Comando Rapido** che legge passi e sonno da Salute e fa POST alla Edge Function `ingest-health`, autenticata con **token personale** (salvato come hash).
3. **Inserimento manuale:** sempre disponibile, anche per chi ha il sync automatico.

---

## Modello dati (proposta, migliorabile)

- `profiles`: id (= auth.users.id), username, avatar_url, timezone (default `Europe/Rome`), created_at
- `groups`: id, name, invite_code, created_by, created_at
- `group_members`: group_id, user_id, role, joined_at
- `daily_stats`: user_id, date, steps, sleep_start, sleep_end, sleep_minutes, source, updated_at
  - Chiave unica (user_id, date). Scritture sempre in **upsert idempotente**.
- `workouts`: id, user_id, date, type, duration_min, note
- `api_tokens`: id, user_id, token_hash, created_at, last_used_at
- `badges`, `user_badges`

**Regole sulle date**
- La notte di sonno appartiene al giorno del **risveglio**.
- Tutte le date vanno calcolate nel fuso orario dell'utente.

---

## Sistema stelle (bozza) — tutto in `src/config/scoring.ts`

| Passi | Stelle |
|---|---|
| 5.000 | 1★ |
| 8.000 | 2★ |
| 10.000 | 3★ |
| 15.000 | 4★ |

| Ora di addormentamento | Stelle |
|---|---|
| entro le 23:00 | 3★ |
| 23:00–00:00 | 2★ |
| 00:00–01:00 | 1★ |
| dopo l'01:00 | 0★ |

Bonus **+1★** se la durata del sonno è tra 7 e 9 ore. **Allenamenti:** +1★ nei giorni con almeno un allenamento (max 1/giorno).

**Classifiche**: passi, sonno, unita (somma). Periodi: oggi, settimana, mese.
Chi non ha dati sul sonno vede "no data" e capisce perché non prende stelle.

---

## Funzioni social

- Classifica di gruppo in tempo reale.
- Notifica "X ti ha superato" (passi di oggi e classifica unita), con limite giornaliero.
- Streak: giorni consecutivi con ≥3★ nei passi; notti consecutive con ≥2★ nel sonno.
- Badge: "10K Club", "Early Bird", "Week Warrior", "Night Owl" (+ altri).

---

## Fasi

0. Setup. 1. Base (login, profilo, gruppi, inserimento manuale, classifica passi).
2. Sync automatico (ingest-health, Comando Rapido, Capacitor + Health Connect).
3. Gioco (stelle, classifiche, streak, badge). 4. Notifiche. 5. Extra (allenamenti, grafici, rifiniture).

## Note tecniche

- Health Connect: usare query **aggregate** per i passi (evita doppio conteggio telefono + orologio).
- Comando Rapido: manda passi di oggi e ultima sessione di sonno; endpoint idempotente, valida input, rifiuta valori assurdi.
- Supabase free va in pausa dopo 7 giorni senza attività.
- Migrazioni versionate in `supabase/migrations`.
