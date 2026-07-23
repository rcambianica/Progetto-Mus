import {
    dbToLinear,
    getPeak
} from "../analysis/PeakAnalyzer.js";

const DEFAULT_THRESHOLD_DB = -1;

/*
 * Piccolo margine per compensare l'arrotondamento
 * dei campioni Float32 e della successiva codifica PCM.
 *
 * È sufficientemente piccolo da non essere percepibile
 * e da mostrare comunque, con due decimali, il target scelto.
 */
const SAFETY_MARGIN_DB = 0.001;

export function createLimiterNode(
    audioContext,
    settings
) {
    if (!audioContext) {
        throw new Error(
            "An audio context is required to create the limiter."
        );
    }

    const limiter =
        audioContext.createDynamicsCompressor();

    limiter.threshold.value =
        sanitizeLimiterThreshold(
            settings?.threshold
        );

    /*
     * DynamicsCompressorNode consente un ratio
     * massimo di 20:1.
     */
    limiter.ratio.value = 20;

    /*
     * Knee a zero per ottenere un intervento
     * più netto attorno alla soglia.
     */
    limiter.knee.value = 0;

    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    return limiter;
}

/*
 * Garantisce che nessun sample del buffer superi
 * la soglia configurata.
 *
 * Il controllo viene applicato dopo il rendering
 * attraverso DynamicsCompressorNode.
 */
export function enforcePeakCeiling(
    audioBuffer,
    thresholdDb
) {
    if (!audioBuffer) {
        throw new Error(
            "An AudioBuffer is required to enforce the peak ceiling."
        );
    }

    const sanitizedThreshold =
        sanitizeLimiterThreshold(
            thresholdDb
        );

    const requestedCeiling =
        dbToLinear(
            sanitizedThreshold
        );

    const safeCeiling =
        dbToLinear(
            sanitizedThreshold -
            SAFETY_MARGIN_DB
        );

    const currentPeak =
        getPeak(audioBuffer);

    /*
     * Silenzio o buffer già sufficientemente
     * sotto la soglia.
     */
    if (
        currentPeak <= 0 ||
        currentPeak <= safeCeiling
    ) {
        return audioBuffer;
    }

    const correctiveGain =
        safeCeiling / currentPeak;

    const correctedBuffer =
        new AudioBuffer({
            numberOfChannels:
                audioBuffer.numberOfChannels,

            length:
                audioBuffer.length,

            sampleRate:
                audioBuffer.sampleRate
        });

    for (
        let channel = 0;
        channel < audioBuffer.numberOfChannels;
        channel++
    ) {
        const sourceData =
            audioBuffer.getChannelData(
                channel
            );

        const destinationData =
            correctedBuffer.getChannelData(
                channel
            );

        for (
            let sampleIndex = 0;
            sampleIndex < sourceData.length;
            sampleIndex++
        ) {
            const correctedSample =
                sourceData[sampleIndex] *
                correctiveGain;

            /*
             * Il clamp è una protezione aggiuntiva
             * contro eventuali arrotondamenti Float32.
             */
            destinationData[sampleIndex] =
                clampSample(
                    correctedSample,
                    safeCeiling
                );
        }
    }

    const correctedPeak =
        getPeak(correctedBuffer);

    /*
     * Verifica interna: in condizioni normali
     * non dovrebbe mai fallire.
     */
    if (
        correctedPeak >
        requestedCeiling
    ) {
        throw new Error(
            "Unable to enforce the limiter peak ceiling."
        );
    }

    return correctedBuffer;
}

export function sanitizeLimiterThreshold(
    value
) {
    const numericValue =
        Number(value);

    if (!Number.isFinite(numericValue)) {
        return DEFAULT_THRESHOLD_DB;
    }

    return Math.max(
        -100,
        Math.min(0, numericValue)
    );
}

function clampSample(
    sample,
    ceiling
) {
    return Math.max(
        -ceiling,
        Math.min(
            ceiling,
            sample
        )
    );
}