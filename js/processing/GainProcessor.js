export function createGainNode(audioContext, gainValue) {
    const gainNode = audioContext.createGain();

    gainNode.gain.value = sanitizeGainValue(gainValue);

    return gainNode;
}

export function sanitizeGainValue(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return 1;
    }

    return Math.max(0, Math.min(numericValue, 4));
}