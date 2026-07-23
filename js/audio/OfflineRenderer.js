import {
    createGainNode
} from "../processing/GainProcessor.js";

import {
    createCompressorNode
} from "../processing/CompressorProcessor.js";

import {
    calculateNormalizationGain
} from "../processing/Normalizer.js";

import {
    createLimiterNode
} from "../processing/LimiterProcessor.js";

import {
    createThreeBandEq
} from "../processing/EQProcessor.js";

import {
    calculateDelayTailSeconds,
    createDelayEffect
} from "../processing/DelayProcessor.js";

export async function renderProcessedAudio(
    originalBuffer,
    settings
) {
    if (!originalBuffer) {
        throw new Error("No original audio loaded.");
    }

    /*
     * Primo passaggio:
     * gain e compressione.
     */
    let processedBuffer =
        await renderBaseProcessingChain(
            originalBuffer,
            settings
        );

    /*
     * Secondo passaggio:
     * normalizzazione rispetto al risultato
     * di gain e compressione.
     */
    if (settings.normalization?.enabled) {
        const normalizationGain =
            calculateNormalizationGain(
                processedBuffer,
                settings.normalization.targetDb
            );

        processedBuffer =
            await renderGainPass(
                processedBuffer,
                normalizationGain
            );
    }

    /*
     * Ultimo passaggio:
     * limiter, affinché nessun processing
     * successivo rialzi nuovamente i picchi.
     */
    if (settings.limiter?.enabled) {
        processedBuffer =
            await renderLimiterPass(
                processedBuffer,
                settings.limiter
            );
    }

    return processedBuffer;
}

async function renderBaseProcessingChain(
    audioBuffer,
    settings
) {
    const delayTailSeconds =
        settings.delay?.enabled
            ? calculateDelayTailSeconds(
                settings.delay
            )
            : 0;

    const offlineContext =
        createOfflineContext(
            audioBuffer,
            delayTailSeconds
        );

    const source =
        offlineContext.createBufferSource();

    source.buffer = audioBuffer;

    let currentNode = source;

    if (settings.gain?.enabled) {
        const gainNode =
            createGainNode(
                offlineContext,
                settings.gain.value
            );

        currentNode.connect(gainNode);
        currentNode = gainNode;
    }

    if (settings.eq?.enabled) {
        const equalizer =
            createThreeBandEq(
                offlineContext,
                settings.eq
            );

        currentNode.connect(
            equalizer.input
        );

        currentNode =
            equalizer.output;
    }

    if (settings.compressor?.enabled) {
        const compressorNode =
            createCompressorNode(
                offlineContext,
                settings.compressor
            );

        currentNode.connect(
            compressorNode
        );

        currentNode =
            compressorNode;
    }

    if (settings.delay?.enabled) {
        const delayEffect =
            createDelayEffect(
                offlineContext,
                settings.delay
            );

        currentNode.connect(
            delayEffect.input
        );

        currentNode =
            delayEffect.output;
    }

    currentNode.connect(
        offlineContext.destination
    );

    source.start(0);

    return await offlineContext.startRendering();
}

async function renderGainPass(
    audioBuffer,
    gainValue
) {
    const offlineContext =
        createOfflineContext(audioBuffer);

    const source =
        offlineContext.createBufferSource();

    source.buffer = audioBuffer;

    const gainNode =
        offlineContext.createGain();

    gainNode.gain.value =
        gainValue;

    source.connect(gainNode);

    gainNode.connect(
        offlineContext.destination
    );

    source.start(0);

    return await offlineContext.startRendering();
}

async function renderLimiterPass(
    audioBuffer,
    settings
) {
    const offlineContext =
        createOfflineContext(audioBuffer);

    const source =
        offlineContext.createBufferSource();

    source.buffer = audioBuffer;

    const limiterNode =
        createLimiterNode(
            offlineContext,
            settings
        );

    source.connect(limiterNode);

    limiterNode.connect(
        offlineContext.destination
    );

    source.start(0);

    return await offlineContext.startRendering();
}

function createOfflineContext(
    audioBuffer,
    additionalDurationSeconds = 0
) {
    const additionalFrames =
        Math.ceil(
            Math.max(
                0,
                additionalDurationSeconds
            ) * audioBuffer.sampleRate
        );

    const totalLength =
        audioBuffer.length +
        additionalFrames;

    return new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        totalLength,
        audioBuffer.sampleRate
    );
}