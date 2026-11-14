# Guida Android: app con Health Connect (APK)

L'app Android è la stessa PWA impacchettata con **Capacitor**. In più legge passi e sonno da **Health Connect**,
dove arrivano i dati del telefono e di Garmin, Samsung Health, Fitbit e altre app.

## Garmin → Health Connect

1. Apri **Garmin Connect** → **Altro** → **Impostazioni** → **App collegate / Health Connect**.
2. Attiva la condivisione di **Passi** e **Sonno**.
3. Apri **Health Connect** (su Android 14+ è in Impostazioni → Sicurezza e privacy → Privacy → Health Connect)
   e controlla che Garmin abbia i permessi di scrittura.

## Compilare l'APK

Requisiti (già presenti su questo PC): Node 22, JDK 21, Android SDK.

```bash
npm run build          # build web
npx cap sync android   # copia la build nel progetto Android
cd android
./gradlew assembleDebug
```

L'APK è in `android/app/build/outputs/apk/debug/app-debug.apk`.

> Prima di compilare la versione "vera", crea `.env` con le chiavi Supabase: le variabili `VITE_*` vengono
> incluse nella build. Senza `.env` l'app gira in **modalità demo**, con i dati solo sul telefono.

## Installare l'APK

1. Copia `app-debug.apk` sul telefono (cavo USB, Google Drive, Telegram…), oppure con il telefono collegato:
   `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
2. Aprilo e consenti **Installa app sconosciute** per l'app da cui lo apri.
3. Apri **Winner for Life** → **Profile → Settings → Data sources** → **Connect Health Connect**.
4. Concedi **Passi** e **Sonno**.

## Quando sincronizza

- All'**apertura** dell'app e ogni volta che torna in **primo piano** (al massimo una volta ogni 10 minuti).
- Con il pulsante **Sync now** (ultimi 30 giorni).
- I **passi** usano una query **aggregata**: Health Connect elimina i doppioni telefono + orologio.
- Il **sonno**: per ogni giorno di risveglio prende la sessione più lunga (i pisolini sono ignorati).
  Conta solo il tempo davvero dormito: le fasi "sveglio" sono escluse.
- Se hai inserito un dato **a mano**, la sincronizzazione **non lo sovrascrive**.

Sync in background (con l'app chiusa): non incluso. Android permette solo lavori periodici nativi (WorkManager)
che richiedono codice nativo aggiuntivo. Si può valutare in futuro; per ora basta aprire l'app una volta al giorno.

## Aggiornare l'app

Ricompila e installa sopra la versione esistente (`adb install -r …`): i dati restano.
Le build di debug sono firmate con la chiave di debug di **questo PC**. Se compili da un altro PC, Android rifiuta
l'aggiornamento e va prima disinstallata la versione vecchia. Per distribuire agli amici in modo stabile, più avanti
conviene creare un keystore di release (non va mai committato: è già in `.gitignore`).
