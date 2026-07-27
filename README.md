# Audio Processing and Mastering

Applicazione web client-side basata sulla Web Audio API per caricare o registrare audio, applicare una catena di elaborazione offline e confrontare il segnale originale con quello processato.

## Requisiti

Per utilizzare l’applicazione sono necessari:

* un browser moderno con supporto alla Web Audio API, come Chrome, Chromium, Brave, Edge o Firefox;
* un server web locale;
* un microfono, solo nel caso in cui si voglia utilizzare la funzione di registrazione.

I file audio non vengono caricati su server esterni. Decodifica, riproduzione ed elaborazione avvengono localmente nel browser.

## WaveSurfer.js

WaveSurfer.js 7.12.11 viene usato esclusivamente come componente di visualizzazione delle forme d’onda e come interfaccia grafica per selezionare una posizione temporale. È attivo il plugin ufficiale Hover.

La libreria non gestisce play, pausa o stop dell’applicazione. Queste operazioni restano affidate ad `AudioPlayer`, costruito con la Web Audio API e `AudioBufferSourceNode`.

File inclusi localmente:

```text
lib/wavesurfer/wavesurfer.esm.js
lib/wavesurfer/plugins/hover.esm.js
```

## Interazione con le waveform

Quando non è disponibile alcun audio, la waveform è disabilitata e Hover non viene mostrato.

Quando l’audio è disponibile:

* un clic sulla waveform seleziona la nuova posizione di riproduzione;
* il pulsante `Play` avvia la riproduzione dal punto corrente e diventa `Pause` durante l’ascolto;
* il pulsante `Pause` sospende la riproduzione mantenendo la posizione;
* il pulsante `Stop` arresta la riproduzione e riporta la posizione all’inizio.

WaveSurfer emette l’evento pubblico `interaction`, che restituisce il tempo selezionato in secondi. Il controller converte il valore in millisecondi e lo passa ad `AudioPlayer.seek()`. La testina grafica viene sincronizzata con `WaveSurfer.setTime()`, senza usare i metodi di riproduzione della libreria.

## Seek durante la riproduzione

Ogni seek eseguito mentre l’audio è in riproduzione arresta il vecchio `AudioBufferSourceNode` e ne crea uno nuovo, avviato dall’offset selezionato. L’evento `ended` del nodo precedente viene ignorato tramite un controllo d’identità sulla source attiva, così non può interrompere la sincronizzazione grafica della nuova riproduzione.

Dopo il seek, `PlaybackController` riavvia esplicitamente il ciclo basato su `requestAnimationFrame` quando `AudioPlayer` risulta ancora in riproduzione. La testina WaveSurfer continua quindi ad avanzare dal nuovo punto senza affidare alla libreria alcun controllo del contesto audio.

## Avvio

L’applicazione utilizza moduli JavaScript ES6 e non deve essere aperta tramite `file://`.

1. Estrarre l’archivio.
2. Avviare un server web locale nella cartella principale.
3. Aprire nel browser l’indirizzo indicato dal server.

Esempio:

```bash
python3 -m http.server 8000
```

Aprire quindi `http://localhost:8000`.
