## Requisiti

Per eseguire l'applicazione sono necessari:

- un browser moderno con supporto alla Web Audio API, ad esempio Chrome, Chromium, Brave, Edge o Firefox;
- Python 3, oppure un altro server HTTP locale;
- un microfono, solamente per utilizzare la funzione di registrazione.

Non è necessario installare pacchetti JavaScript per il normale utilizzo dell'applicazione. WaveSurfer.js e il plugin Hover sono già inclusi nella cartella `lib/`.

## Avvio dell'applicazione

L'applicazione utilizza moduli JavaScript ES6 e non deve essere aperta direttamente facendo doppio clic su `index.html` o tramite un indirizzo `file://`.

1. Estrarre l'archivio del progetto.
2. Aprire un terminale nella cartella principale, cioè nella cartella che contiene `index.html`.
3. Avviare un server HTTP locale
4. Aprire nel browser: http://127.0.0.1:8000

## Utilizzo dell'applicazione

### 1. Caricamento o registrazione

È possibile fornire il segnale originale in due modi:

- selezionando un file WAV, MP3 oppure OGG tramite **Select WAV, MP3 or OGG**;
- registrando dal microfono tramite **Start Recording** e **Stop Recording**.

Al primo utilizzo della registrazione, il browser chiede il permesso di accedere al microfono. L'applicazione deve essere eseguita da `localhost` o da `127.0.0.1` affinché la registrazione possa essere autorizzata correttamente dal browser.

Dopo il caricamento o la registrazione vengono mostrati:

- waveform del segnale originale;
- sample rate;
- numero di canali;
- valore di picco;
- picco in dBFS;
- posizione corrente e durata totale.

### 2. Riproduzione e seek

Ogni waveform dispone di un player indipendente:

- **Play** avvia la riproduzione dal punto corrente;
- durante la riproduzione il pulsante diventa **Pause**;
- **Stop** arresta l'audio e riporta la posizione all'inizio;
- un clic sulla waveform sposta la riproduzione nel punto selezionato.

WaveSurfer.js viene utilizzato solamente per la visualizzazione e per il seek. La riproduzione audio è gestita direttamente dalla Web Audio API.

### 3. Configurazione del processing

La catena di elaborazione segue questo ordine:

```text
Input Gain
→ Three-Band Equalizer
→ Dynamic Range Compressor
→ Distortion / Saturation
→ Chorus
→ Delay / Echo
→ Reverb
→ Peak Normalization
→ Limiter
```

`Input Gain` è sempre attivo. Gli altri moduli possono essere abilitati o disabilitati facendo clic sulla rispettiva scheda. Quando un modulo è attivo, i suoi controlli diventano utilizzabili.

Le manopole possono essere regolate:

- trascinando verticalmente con il mouse;
- usando i tasti freccia quando la manopola ha il focus.

### 4. Applicazione del processing

Dopo aver configurato i parametri, premere:

```text
Apply Processing
```

L'elaborazione viene eseguita tramite `OfflineAudioContext`. Durante il rendering non è possibile avviare un secondo job.

Al termine vengono aggiornati:

- waveform processata;
- metriche del segnale processato;
- durata comprensiva delle eventuali code degli effetti;
- player dell'audio processato;
- stato dell'esportazione.

Se un parametro viene modificato dopo il rendering, il risultato precedente rimane disponibile per l'ascolto, ma l'esportazione viene disabilitata. È necessario premere nuovamente **Apply Processing** per ottenere un risultato coerente con i nuovi parametri.

### 5. Confronto

I player **Original Audio** e **Processed Audio** sono indipendenti. È quindi possibile ascoltare separatamente la sorgente e il risultato, effettuare seek sulle due waveform e confrontare le rispettive metriche.

### 6. Esportazione WAV

Dopo un rendering valido:

1. modificare facoltativamente il nome del file;
2. premere **Download processed WAV**.

Il risultato viene esportato come file WAV PCM lineare a 16 bit. Tutte le operazioni di decodifica, elaborazione ed esportazione avvengono localmente nel browser; i file audio non vengono inviati a server esterni.

## Test automatici

I test sono realizzati con Playwright e non sono necessari per usare l'applicazione.
Per prepararli, installare Node.js e npm, quindi eseguire dalla cartella principale:

```bash
npm ci
npx playwright install
```

Per avviare l'intera suite:

```bash
npm test
```

Playwright avvia automaticamente il server locale configurato in `playwright.config.js` e prova il progetto con Chromium, Firefox e WebKit.

Per utilizzare l'interfaccia grafica di Playwright:

```bash
npm run test:ui
```

È anche possibile installare ed eseguire soltanto Chromium:

```bash
npx playwright install chromium
npx playwright test --project=chromium
```

## Struttura principale

```text
css/                fogli di stile
favicon/            icone del sito
js/analysis/        analisi delle proprietà del segnale
js/audio/           caricamento, playback, registrazione, rendering ed export
js/controllers/     coordinamento delle funzioni dell'applicazione
js/processing/      moduli della catena di elaborazione
js/ui/              gestione dell'interfaccia e delle waveform
lib/                dipendenze JavaScript incluse localmente
relazione tecnica/  breve relazione tecnica da 4 pagine
tests/              test automatici Playwright
index.html          pagina principale
file .json          files di configurazione e gestione dipendenze per playwright
```
