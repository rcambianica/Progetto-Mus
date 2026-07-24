# Istruzioni per l’utilizzo

## Requisiti

Per utilizzare l’applicazione sono necessari:

* un browser moderno con supporto alla WebAudio API, come Chrome, Chromium, Brave, Edge o Firefox;
* un server web locale;
* un microfono, solo nel caso in cui si voglia utilizzare la funzione di registrazione.

L’applicazione è interamente client-side: i file audio non vengono caricati su un server esterno e tutte le elaborazioni vengono eseguite localmente nel browser.

## Dipendenze esterne

L'applicazione utilizza WaveSurfer.js esclusivamente per la
visualizzazione e l'interazione con le forme d'onda.

La versione utilizzata è inclusa localmente nel progetto:

```text
lib/wavesurfer/wavesurfer.esm.js
```

## Avvio dell’applicazione

L’applicazione utilizza moduli JavaScript ES6 e non deve essere aperta direttamente tramite un indirizzo `file://`.

1. Estrarre l’archivio del progetto.
2. Avviare un server web locale nella cartella principale del progetto.
3. Aprire nel browser l’indirizzo indicato dal server.