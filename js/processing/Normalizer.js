import {
    dbToLinear,
    getPeak
} from "../analysis/PeakAnalyzer.js";

export function calculateNormalizationGain(
    audioBuffer,
    targetDb
) {
    if (!audioBuffer) {
        throw new Error(
            "An AudioBuffer is required for normalization."
        );
    }

    const sanitizedTargetDb =
        sanitizeNormalizationTarget(targetDb);

    const currentPeak =
        getPeak(audioBuffer);

    if (currentPeak <= 0) {
        return 1;
    }

    const targetLinear =
        dbToLinear(sanitizedTargetDb);

    return targetLinear / currentPeak;
}

export function sanitizeNormalizationTarget(targetDb) {
    const numericTarget =
        Number(targetDb);

    if (!Number.isFinite(numericTarget)) {
        return -1;
    }

    return Math.max(
        -60,
        Math.min(0, numericTarget)
    );
}