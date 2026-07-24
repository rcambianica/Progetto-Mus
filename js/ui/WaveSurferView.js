import WaveSurfer from
    "../../lib/wavesurfer/wavesurfer.esm.js";
    
import {
    encodeWav
} from "../audio/WavEncoder.js";

let originalWaveSurfer = null;
let processedWaveSurfer = null;

let originalObjectUrl = null;
let processedObjectUrl = null;

let ignoreOriginalInteraction = false;
let ignoreProcessedInteraction = false;

export function initializeWaveSurfers(
    onOriginalInteraction,
    onProcessedInteraction
) {
    originalWaveSurfer = createWaveSurfer(
        "#originalWaveform"
    );

    processedWaveSurfer = createWaveSurfer(
        "#processedWaveform"
    );

    originalWaveSurfer.on(
        "interaction",
        newTimeSeconds => {
            if (ignoreOriginalInteraction) {
                return;
            }

            if (typeof onOriginalInteraction === "function") {
                onOriginalInteraction(
                    newTimeSeconds * 1000
                );
            }
        }
    );

    processedWaveSurfer.on(
        "interaction",
        newTimeSeconds => {
            if (ignoreProcessedInteraction) {
                return;
            }

            if (typeof onProcessedInteraction === "function") {
                onProcessedInteraction(
                    newTimeSeconds * 1000
                );
            }
        }
    );
}

export async function renderOriginalWaveformWithWaveSurfer(file) {
    if (!originalWaveSurfer || !file) {
        return;
    }

    revokeOriginalObjectUrl();

    originalObjectUrl =
        URL.createObjectURL(file);

    await originalWaveSurfer.load(originalObjectUrl);

    syncOriginalWaveSurferToTime(0);
}

export async function renderProcessedWaveformWithWaveSurfer(audioBuffer) {
    if (!processedWaveSurfer || !audioBuffer) {
        return;
    }

    revokeProcessedObjectUrl();

    const wavBlob =
        encodeWav(audioBuffer);

    processedObjectUrl =
        URL.createObjectURL(wavBlob);

    await processedWaveSurfer.load(processedObjectUrl);

    syncProcessedWaveSurferToTime(0);
}

export function syncOriginalWaveSurferToTime(timeMs) {
    syncWaveSurferToTime(
        originalWaveSurfer,
        timeMs,
        "original"
    );
}

export function syncProcessedWaveSurferToTime(timeMs) {
    syncWaveSurferToTime(
        processedWaveSurfer,
        timeMs,
        "processed"
    );
}

export function clearOriginalWaveSurfer() {
    if (originalWaveSurfer) {
        originalWaveSurfer.empty();
    }

    revokeOriginalObjectUrl();
}

export function clearProcessedWaveSurfer() {
    if (processedWaveSurfer) {
        processedWaveSurfer.empty();
    }

    revokeProcessedObjectUrl();
}

export function destroyWaveSurfers() {
    if (originalWaveSurfer) {
        originalWaveSurfer.destroy();
        originalWaveSurfer = null;
    }

    if (processedWaveSurfer) {
        processedWaveSurfer.destroy();
        processedWaveSurfer = null;
    }

    revokeOriginalObjectUrl();
    revokeProcessedObjectUrl();
}

function syncWaveSurferToTime(
    waveSurfer,
    timeMs,
    type
) {
    if (!waveSurfer) {
        return;
    }

    const duration =
        waveSurfer.getDuration();

    if (!duration || duration <= 0) {
        return;
    }

    const timeSeconds =
        Math.max(
            0,
            Math.min(
                timeMs / 1000,
                duration
            )
        );

    const progress =
        timeSeconds / duration;

    if (type === "original") {
        ignoreOriginalInteraction = true;
    } else {
        ignoreProcessedInteraction = true;
    }

    waveSurfer.seekTo(progress);

    queueMicrotask(() => {
        if (type === "original") {
            ignoreOriginalInteraction = false;
        } else {
            ignoreProcessedInteraction = false;
        }
    });
}

function createWaveSurfer(container) {
    return WaveSurfer.create({
        container,
        height: 180,
        waveColor: "#a1a1aa",
        progressColor: "#18181b",
        cursorColor: "#ef4444",
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: false,
        interact: true,
        hideScrollbar: false
    });
}

function revokeOriginalObjectUrl() {
    if (originalObjectUrl) {
        URL.revokeObjectURL(originalObjectUrl);
        originalObjectUrl = null;
    }
}

function revokeProcessedObjectUrl() {
    if (processedObjectUrl) {
        URL.revokeObjectURL(processedObjectUrl);
        processedObjectUrl = null;
    }
}