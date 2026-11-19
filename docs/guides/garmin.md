# Guida Garmin: sincronizzazione automatica con la Personal API

Ogni amico collega il **proprio** account Garmin Connect con una *Personal API key*.
L'app importa da sola: **passi**, **piani saliti**, **sonno** e **attività** (bici, corsa, palestra…, salvate come allenamenti).

Documentazione Garmin: <https://developer.garmin.com/gc-developer-program/personal/personal-api>
(Swagger: <https://developer.garmin.com/gc-developer-program/personal/swagger-docs/>).

## Come funziona (e perché è sicuro)

1. In Garmin Connect crei una chiave (scade dopo 30, 90, 180 giorni o 1 anno).
2. Nell'app: **Impostazioni → Data sources → Garmin Connect**, incolli la chiave e premi **Connect Garmin**.
3. Il server (edge function `garmin`) prova la chiave con Garmin. Se funziona, la salva **cifrata** (AES-256-GCM)
   nella tabella `garmin_secrets`, poi importa gli ultimi 7 giorni.

Sicurezza:
- La chiave non resta mai nel telefono o nel browser e nessuno può rileggerla, nemmeno tu: l'app vede solo le ultime 4 cifre.
- `garmin_secrets` non ha regole RLS: nessun utente può leggerla. Solo l'edge function (service role) ci accede.
- La cifratura usa un segreto del server (`GARMIN_ENC_KEY`) e l'id dell'utente: una chiave copiata su un altro utente non si decifra.
- **Disconnect** cancella la chiave dal server. Puoi anche cancellarla su Garmin Connect: smette subito di funzionare.

Ogni chiave serve solo per i dati personali di chi la crea, senza uso commerciale, come chiedono i termini Garmin.

Cosa viene importato:

| Dato | Endpoint Garmin | Dove finisce |
|---|---|---|
| Passi, piani | `/usersummary-service/v2/dailysummaries` | `daily_stats.steps`, `flights` (source `garmin`) |
| Sonno | `/sleep-service/sleep/dailySleepSummariesByDate` | `daily_stats.sleep_*` (data = giorno del risveglio) |
| Attività | `/activitylist-service/activities/search/activities` | `workouts` (`external_id = garmin:<id>`) |

I dati inseriti **a mano** non vengono mai sovrascritti.

## Setup una volta sola (owner)

### 1. Segreti del server

Serve un solo segreto: `GARMIN_ENC_KEY`, una stringa casuale di almeno 32 caratteri
(es. `openssl rand -hex 32`, oppure un password manager).
Impostalo in Supabase → **Edge Functions → Secrets**, oppure:

```bash
npx supabase secrets set GARMIN_ENC_KEY=<valore>
```

⚠️ Non cambiare più `GARMIN_ENC_KEY`: le chiavi salvate non si potrebbero più leggere e ognuno dovrebbe ricollegare Garmin.

### 2. Database e funzione

```bash
npx supabase db push
npx supabase functions deploy garmin
```

### 3. Sincronizzazione automatica (ogni 3 ore)

Nel pannello Supabase → **SQL Editor**, sostituisci `<project-ref>` ed esegui.
Il segreto del cron lo genera il database dentro Vault: nessuno deve copiarlo.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'garmin_cron_secret');

select cron.schedule('garmin-sync', '15 */3 * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/garmin',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'garmin_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
```

Ogni 3 ore il server importa gli ultimi 3 giorni di tutti gli amici collegati.
Il bottone **Sync now** nell'app importa subito gli ultimi 7 giorni.

Per fermarla: `select cron.unschedule('garmin-sync');`

## Problemi comuni

- **"Garmin refused the key"**: la chiave è scaduta o cancellata. Creane una nuova su Garmin Connect, poi Disconnect e Connect di nuovo.
- **Un allenamento Garmin cancellato nell'app ricompare**: la sync lo reimporta (finché è negli ultimi 7 giorni). Cancellalo su Garmin Connect.
