import {
    createGainNode
} from "../processing/GainProcessor.js";

import {
    calculateNormalizationGain
} from "../processing/Normalizer.js";

import {
    createCompressorNode
} from "../processing/CompressorProcessor.js";

export async function renderProcessedAudio(
    originalBuffer,
    settings
) {
    if (!originalBuffer) {
        throw new Error("No original audio loaded.");
    }

    const processedBeforeNormalization =
        await renderProcessingChain(
            originalBuffer,
            settings
        );

    if (!settings.normalization?.enabled) {
        return processedBeforeNormalization;
    }

    const normalizationGain =
        calculateNormalizationGain(
            processedBeforeNormalization,
            settings.normalization.targetDb
        );

    return await renderGainPass(
        processedBeforeNormalization,
        normalizationGain
    );
}

async function renderProcessingChain(
    audioBuffer,
    settings
) {
    const offlineContext =
        createOfflineContext(audioBuffer);

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

    if (settings.compressor?.enabled) {
        const compressorNode =
            createCompressorNode(
                offlineContext,
                settings.compressor
            );

        currentNode.connect(compressorNode);
        currentNode = compressorNode;
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

    const normalizationGainNode =
        offlineContext.createGain();

    normalizationGainNode.gain.value =
        gainValue;

    source.connect(normalizationGainNode);

    normalizationGainNode.connect(
        offlineContext.destination
    );

    source.start(0);

    return await offlineContext.startRendering();
}

function createOfflineContext(audioBuffer) {
    return new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
    );
}