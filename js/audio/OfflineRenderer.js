import {
    createGainNode
} from "../processing/GainProcessor.js";

export async function renderProcessedAudio(originalBuffer, settings) {
    if (!originalBuffer) {
        throw new Error("No original audio loaded.");
    }

    const offlineContext = new OfflineAudioContext(
        originalBuffer.numberOfChannels,
        originalBuffer.length,
        originalBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = originalBuffer;

    let currentNode = source;

    const gainSettings = settings.gain;

    if (gainSettings?.enabled) {
        const gainNode = createGainNode(
            offlineContext,
            gainSettings.value
        );

        currentNode.connect(gainNode);
        currentNode = gainNode;
    }

    currentNode.connect(offlineContext.destination);

    source.start(0);

    return await offlineContext.startRendering();
}