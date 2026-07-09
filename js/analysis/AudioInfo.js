import {
    getPeak,
    linearToDb
} from "./PeakAnalyzer.js";

export function analyzeAudioBuffer(audioBuffer) {
    const peakLinear = getPeak(audioBuffer);
    const peakDb = linearToDb(peakLinear);

    return {
        durationMs: audioBuffer.duration * 1000,
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        peakLinear,
        peakDb
    };
}

export function formatDuration(durationMs) {
    const totalSeconds = Math.floor(durationMs / 1000);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const milliseconds = Math.round(durationMs % 1000);

    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

export function formatDb(dbValue) {
    if (dbValue === -Infinity) {
        return "-Infinity dBFS";
    }

    return `${dbValue.toFixed(2)} dBFS`;
}