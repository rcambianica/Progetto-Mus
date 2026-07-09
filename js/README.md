Pipeline implementativa — Audio Processing and Mastering

Obiettivo: sviluppare una web app client-side che carica o registra audio, applica processing tramite Web Audio API, visualizza originale/processato, permette playback comparativo ed esporta il risultato in WAV.

Tecnologie coerenti con corso e traccia:

HTML
CSS
JavaScript
Simple Web Server
HTMLAudioElement / HTMLMediaElement
Web Audio API
Media Capture and Streams API
MediaStream Recording API
OfflineAudioContext
Canvas
Blob

Librerie esterne: non necessarie. Meglio evitare WaveSurfer se vuoi dimostrare direttamente gli argomenti del corso. La waveform si può fare con Canvas usando AudioBuffer.getChannelData().

1. Struttura progetto
audio-mastering-project/
├── index.html
├── css/
│   ├── app.css
│   ├── layout.css
│   ├── controls.css
│   └── waveform.css
│
├── js/
│   ├── app.js
│   ├── state.js
│   │
│   ├── audio/
│   │   ├── AudioContextManager.js
│   │   ├── AudioLoader.js
│   │   ├── MicrophoneRecorder.js
│   │   ├── AudioPlayer.js
│   │   ├── OfflineRenderer.js
│   │   └── WavEncoder.js
│   │
│   ├── processing/
│   │   ├── GainProcessor.js
│   │   ├── CompressorProcessor.js
│   │   ├── LimiterProcessor.js
│   │   ├── Normalizer.js
│   │   ├── EQProcessor.js
│   │   └── DelayProcessor.js
│   │
│   ├── analysis/
│   │   ├── AudioInfo.js
│   │   ├── PeakAnalyzer.js
│   │   └── WaveformAnalyzer.js
│   │
│   └── ui/
│       ├── ControlsPanel.js
│       ├── WaveformView.js
│       ├── StatusPanel.js
│       └── ExportPanel.js

Avvio tramite Simple Web Server sulla cartella root del progetto.

2. Stato centrale

File:

js/state.js
export const state = {
    audioContext: null,

    originalFile: null,
    originalBuffer: null,
    processedBuffer: null,

    originalPlayer: null,
    processedPlayer: null,

    originalInfo: {
        durationMs: 0,
        sampleRate: 0,
        numberOfChannels: 0,
        peakLinear: 0,
        peakDb: -Infinity
    },

    processedInfo: {
        durationMs: 0,
        sampleRate: 0,
        numberOfChannels: 0,
        peakLinear: 0,
        peakDb: -Infinity
    },

    processingSettings: {
        gain: {
            enabled: true,
            value: 1.0
        },

        compressor: {
            enabled: false,
            threshold: -24,
            ratio: 4,
            attack: 0.003,
            release: 0.25
        },

        limiter: {
            enabled: false,
            threshold: -1
        },

        normalization: {
            enabled: false,
            targetDb: -1
        },

        eq: {
            enabled: false,
            lowGain: 0,
            midGain: 0,
            highGain: 0
        },

        delay: {
            enabled: false,
            time: 0.25,
            feedback: 0.3,
            mix: 0.25
        }
    }
};
3. Layout dell’interfaccia

Sezioni principali:

1. Audio input
   - upload file
   - registrazione microfono

2. Informazioni audio
   - durata
   - sample rate
   - numero canali
   - peak level

3. Playback originale
   - play
   - pause
   - stop
   - seek

4. Processing controls
   - gain
   - compressor
   - limiter
   - normalization
   - EQ
   - delay

5. Processing action
   - apply/render processing

6. Playback processato
   - play
   - pause
   - stop
   - seek

7. Waveform
   - originale
   - processata

8. Export
   - download WAV
4. Fase 1 — AudioContext

Modulo:

js/audio/AudioContextManager.js

Scopo:

creare AudioContext
gestire stato suspended/running
riattivare il contesto dopo interazione utente

Codice base:

let audioContext = null;

export function getAudioContext() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }

    return audioContext;
}

export async function resumeAudioContext() {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
        await ctx.resume();
    }

    return ctx;
}

Argomenti del corso coperti:

Introduzione Web Audio API
AudioContext
Stati di AudioContext
5. Fase 2 — Upload audio

Modulo:

js/audio/AudioLoader.js

Flusso:

utente seleziona WAV/MP3/OGG
file.arrayBuffer()
audioContext.decodeAudioData()
salvataggio in state.originalBuffer
analisi informazioni audio
disegno waveform originale

Codice concettuale:

export async function loadAudioFile(file, audioContext) {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return audioBuffer;
}

Argomenti coperti:

Fetch e Promises
Caricamento file audio
Buffer audio
Blob
6. Fase 3 — Registrazione microfono

Modulo:

js/audio/MicrophoneRecorder.js

API usate:

navigator.mediaDevices.getUserMedia({ audio: true })
MediaRecorder

Flusso:

Start recording
getUserMedia
MediaRecorder.start()
raccolta chunks
Stop recording
creazione Blob
decodeAudioData
salvataggio in originalBuffer

Argomenti coperti:

Media Capture and Streams API
MediaStream Recording API
MediaStreamAudioSourceNode
Blob

Versione minima:

Start Record
Stop Record
usa la registrazione come audio originale
7. Fase 4 — Analisi audio

Moduli:

js/analysis/AudioInfo.js
js/analysis/PeakAnalyzer.js

Dati da calcolare:

durata
sample rate
numero canali
peak lineare
peak in dBFS

Peak analyzer:

export function getPeak(audioBuffer) {
    let peak = 0;

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);

        for (let i = 0; i < data.length; i++) {
            const value = Math.abs(data[i]);

            if (value > peak) {
                peak = value;
            }
        }
    }

    return peak;
}

export function linearToDb(value) {
    if (value === 0) {
        return -Infinity;
    }

    return 20 * Math.log10(value);
}

export function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

Argomenti coperti:

Buffer audio
Analisi del segnale
Parametri audio
8. Fase 5 — Waveform originale con Canvas

Modulo:

js/ui/WaveformView.js

Approccio:

AudioBuffer
getChannelData()
campionamento min/max per blocchi
disegno su Canvas

Per ogni canale:

se mono: una waveform
se stereo: due waveform separate
se multicanale: una waveform per canale

Questa scelta è utile perché dimostra che sai lavorare direttamente sui dati audio.

Argomenti coperti:

Canvas
Buffer audio
Analisi waveform
Visualizzazione audio
9. Fase 6 — Playback originale e processato

Modulo:

js/audio/AudioPlayer.js

Scelta implementativa consigliata:

AudioBufferSourceNode + GainNode

Problema importante:

AudioBufferSourceNode è monouso.
Dopo stop non può essere riavviato.
A ogni play bisogna creare una nuova source.

Funzioni minime:

play()
pause()
stop()
seek(timeMs)

Stato interno del player:

{
    buffer,
    source,
    startedAt,
    pausedAt,
    isPlaying
}

Argomenti coperti:

AudioBufferSourceNode
Nodo di destinazione
Guadagno
Playback tramite Web Audio API
10. Fase 7 — Gain control

Modulo:

js/processing/GainProcessor.js

Nodo Web Audio:

const gainNode = audioContext.createGain();
gainNode.gain.value = userGain;

Controllo UI:

slider gain
range consigliato: 0.0 - 2.0
default: 1.0

Argomenti coperti:

Guadagno
AudioParam
Routing
11. Fase 8 — Normalizzazione

Modulo:

js/processing/Normalizer.js

Obiettivo:

portare il peak del segnale a un valore scelto

Target consigliati:

0 dBFS
-1 dBFS
-3 dBFS

Formula:

targetLinear = Math.pow(10, targetDb / 20)
gain = targetLinear / currentPeak

Esempio:

peak attuale = 0.50
target = -1 dBFS = 0.891
gain = 0.891 / 0.50 = 1.782

Implementazione semplice:

calcolo gain di normalizzazione
applicazione tramite GainNode in OfflineAudioContext

Argomenti coperti:

Buffer audio
Ampiezza
dBFS
Guadagno
OfflineAudioContext
12. Fase 9 — Dynamic range compression

Modulo:

js/processing/CompressorProcessor.js

Nodo Web Audio:

const compressor = audioContext.createDynamicsCompressor();

compressor.threshold.value = settings.threshold;
compressor.ratio.value = settings.ratio;
compressor.attack.value = settings.attack;
compressor.release.value = settings.release;

Controlli UI minimi:

enabled
threshold
ratio

Controlli opzionali ma consigliati:

attack
release

Range consigliati:

threshold: -60 dB / 0 dB
ratio: 1 / 20
attack: 0.001 / 1
release: 0.01 / 1

Argomenti coperti:

Compressori di dinamica
AudioParam
13. Fase 10 — Limiter

Modulo:

js/processing/LimiterProcessor.js

Implementazione didatticamente accettabile:

DynamicsCompressorNode configurato come limiter

Parametri:

limiter.threshold.value = threshold;
limiter.ratio.value = 20;
limiter.attack.value = 0.001;
limiter.release.value = 0.05;

Controllo UI:

enabled
threshold

Nota da scrivere nella relazione:

Il limiter è implementato come compressore ad alto ratio e attacco molto breve. Non è un brickwall limiter con lookahead, ma limita efficacemente i picchi secondo il modello disponibile nella Web Audio API standard.

Argomenti coperti:

Compressori di dinamica
Mastering
Controllo dei picchi
14. Fase 11 — Due effetti obbligatori

Scegli questi:

EQ
Delay/Echo

Sono i più coerenti, semplici e difendibili.

14.1 EQ

Modulo:

js/processing/EQProcessor.js

Nodi:

BiquadFilterNode

Implementazione a 3 bande:

const low = ctx.createBiquadFilter();
low.type = "lowshelf";
low.frequency.value = 200;
low.gain.value = lowGain;

const mid = ctx.createBiquadFilter();
mid.type = "peaking";
mid.frequency.value = 1000;
mid.Q.value = 1;
mid.gain.value = midGain;

const high = ctx.createBiquadFilter();
high.type = "highshelf";
high.frequency.value = 4000;
high.gain.value = highGain;

Catena:

source → low → mid → high → nextNode

Controlli UI:

low gain
mid gain
high gain

Argomenti coperti:

Tipi di filtri
Sintesi sottrattiva
Programmazione timbrica
14.2 Delay/Echo

Modulo:

js/processing/DelayProcessor.js

Nodi:

DelayNode
GainNode

Catena:

source → dryGain → output
source → delay → wetGain → output
delay → feedbackGain → delay

Controlli UI:

delay time
feedback
mix

Parametri consigliati:

delay time: 0.05 - 1.0 s
feedback: 0.0 - 0.8
mix: 0.0 - 1.0

Argomenti coperti:

Linee di ritardo
Effetti di eco
Mixing & routing
15. Fase 12 — Offline rendering

Modulo:

js/audio/OfflineRenderer.js

Questa è la fase centrale del progetto.

Obiettivo:

prendere originalBuffer
applicare tutta la catena di processing
produrre processedBuffer

API:

const offlineCtx = new OfflineAudioContext(
    originalBuffer.numberOfChannels,
    originalBuffer.length,
    originalBuffer.sampleRate
);

Catena consigliata:

source
→ normalization gain
→ user gain
→ compressor
→ limiter
→ EQ
→ delay
→ destination

Ordine pragmatico:

1. normalizzazione
2. gain
3. compressione
4. limiter
5. EQ
6. delay

Render:

const processedBuffer = await offlineCtx.startRendering();

Argomenti coperti:

OfflineAudioContext
Mixing & routing
GainNode
DynamicsCompressorNode
BiquadFilterNode
DelayNode
16. Fase 13 — Waveform processata

Dopo il rendering:

state.processedBuffer = processedBuffer
ricalcola peak
ricalcola info
disegna waveform processata

La UI deve mostrare chiaramente:

Original waveform
Processed waveform

Con informazioni separate:

Original peak
Processed peak
Original duration
Processed duration

Argomenti coperti:

Visualizzazione waveform
Analisi comparativa
17. Fase 14 — Playback processato

Riutilizza:

AudioPlayer.js

Crea due istanze:

const originalPlayer = new AudioPlayer(audioContext);
const processedPlayer = new AudioPlayer(audioContext);

Requisito:

originale e processato devono essere riproducibili indipendentemente

Controlli:

Play Original
Pause Original
Stop Original

Play Processed
Pause Processed
Stop Processed

Seek:

slider originale
slider processato
18. Fase 15 — Export WAV

Modulo:

js/audio/WavEncoder.js

Il browser non esporta WAV direttamente da AudioBuffer.

Serve convertire:

AudioBuffer
→ PCM 16-bit
→ header WAV
→ Blob
→ download

Output:

const wavBlob = encodeWav(state.processedBuffer);
const url = URL.createObjectURL(wavBlob);

Download:

const a = document.createElement("a");
a.href = url;
a.download = "processed.wav";
a.click();

Argomenti coperti:

Blob
Codifica dati audio
Export
19. Fase 16 — Validazioni

Validazioni input:

nessun file selezionato
formato non supportato dal browser
errore decodeAudioData
registrazione microfono negata
registrazione vuota

Validazioni processing:

nessun originalBuffer
parametri fuori range
normalizzazione con peak = 0
delay feedback troppo alto
processedBuffer non ancora generato

Validazioni export:

nessun processedBuffer
errore creazione WAV
download non disponibile
20. Ordine implementativo consigliato
1. Setup con Simple Web Server
2. index.html + CSS base
3. state.js
4. AudioContextManager
5. AudioLoader
6. AudioInfo + PeakAnalyzer
7. WaveformView originale
8. AudioPlayer originale
9. MicrophoneRecorder
10. GainProcessor
11. Normalizer
12. OfflineRenderer minimale
13. WaveformView processata
14. AudioPlayer processato
15. CompressorProcessor
16. LimiterProcessor
17. EQProcessor
18. DelayProcessor
19. WavEncoder
20. ExportPanel
21. Validazioni UI
22. Rifinitura grafica
23. Relazione tecnica
21. Milestone
Milestone 1 — Audio input e analisi

Funzioni:

upload audio
decodeAudioData
durata
sample rate
canali
peak
waveform originale

Questa milestone dimostra già Web Audio API e buffer audio.

Milestone 2 — Playback

Funzioni:

play originale
pause originale
stop originale
seek originale

Qui dimostri HTML/Web Audio playback.

Milestone 3 — Primo processing

Funzioni:

gain
normalizzazione
offline rendering
waveform processata
playback processato

Questa è la prima versione realmente consegnabile.

Milestone 4 — Mastering completo

Funzioni:

compressione
limiter
EQ
delay

Copre i requisiti principali di processing.

Milestone 5 — Input microfono ed export

Funzioni:

registrazione microfono
uso registrazione come input
download WAV

Completa i requisiti obbligatori.

Milestone 6 — Rifinitura

Funzioni:

validazioni
messaggi errore
UI responsive
report tecnico
istruzioni di esecuzione
22. Scelte per ridurre la difficoltà

Implementare questi effetti:

EQ
Delay/Echo

Non implementare come effetti principali:

Reverb
Chorus
Flanger
Phaser
Distortion
AudioWorklet
Custom DSP avanzato

Motivo:

EQ e Delay usano nodi standard semplici.
Sono nel programma.
Sono facili da spiegare.
Sono sufficienti per il requisito "at least two effects".
23. Mappatura requisiti → moduli
Requisito	Modulo
Upload file	AudioLoader
Registrazione microfono	MicrophoneRecorder
WAV/MP3/OGG	decodeAudioData
Playback originale	AudioPlayer
Playback processato	AudioPlayer
Gain	GainProcessor
Compressione	CompressorProcessor
Limiter	LimiterProcessor
Normalizzazione	Normalizer
EQ	EQProcessor
Delay	DelayProcessor
Waveform originale	WaveformView
Waveform processata	WaveformView
Offline render	OfflineRenderer
Download WAV	WavEncoder
Info audio	AudioInfo + PeakAnalyzer
24. Relazione tecnica: struttura consigliata
1. Obiettivo del progetto
2. Tecnologie utilizzate
3. Architettura generale
4. Acquisizione audio
   - upload
   - microfono
5. Analisi audio
   - durata
   - sample rate
   - canali
   - peak
6. Catena di processing
   - gain
   - normalizzazione
   - compressione
   - limiting
   - EQ
   - delay
7. Offline rendering
8. Visualizzazione waveform
9. Export WAV
10. Limitazioni e sviluppi futuri

Frase tecnica utile:

The application is implemented as a fully client-side web application. The Web Audio API is used for decoding, analysis, processing, offline rendering and playback of audio buffers. The waveform visualization is implemented using Canvas by extracting PCM samples from AudioBuffer objects. Microphone acquisition is implemented using the Media Capture and Streams API and MediaRecorder. The processed result is rendered offline through OfflineAudioContext and exported as a WAV file using Blob-based encoding.
25. Difficoltà stimata

Versione minima completa:

35-50 ore

Versione buona:

60-80 ore

Versione rifinita:

80-110 ore

Parti più rischiose:

AudioPlayer con pause/seek
OfflineRenderer con catena completa
WavEncoder
MicrophoneRecorder

Parti più semplici:

Gain
Peak analysis
Normalization
EQ
Delay
Waveform base
26. Priorità assolute

Implementare prima:

upload
decodeAudioData
waveform originale
playback originale
gain
normalizzazione
offline rendering
waveform processata
playback processato
download WAV

Poi:

compressore
limiter
EQ
delay
microfono
validazioni

Questa sequenza evita di bloccarsi subito sulle parti più complesse.