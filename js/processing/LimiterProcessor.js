export function createLimiterNode(
    audioContext,
    settings
) {
    const limiter =
        audioContext.createDynamicsCompressor();

    limiter.threshold.value =
        sanitizeThreshold(settings.threshold);

    /*
     * DynamicsCompressorNode consente un ratio massimo di 20.
     * Lo usiamo come approssimazione di un limiter.
     */
    limiter.ratio.value = 20;

    limiter.knee.value = 0;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    return limiter;
}

function sanitizeThreshold(value) {
    const numericValue =
        Number(value);

    if (!Number.isFinite(numericValue)) {
        return -1;
    }

    return Math.max(
        -100,
        Math.min(0, numericValue)
    );
}