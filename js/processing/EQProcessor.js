const DEFAULT_SETTINGS = {
    lowGain: 0,
    midGain: 0,
    highGain: 0,

    lowFrequency: 250,
    midFrequency: 1000,
    highFrequency: 5000,

    midQ: 1,
};

const MIN_GAIN_DB = -12;
const MAX_GAIN_DB = 12;

export function createThreeBandEq(audioContext, settings = {}) {
    if (!audioContext) {
        throw new Error('An audio context is required to create the equalizer.');
    }

    const sanitizedSettings = sanitizeEqSettings(audioContext, settings);

    const lowShelf = audioContext.createBiquadFilter();

    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = sanitizedSettings.lowFrequency;

    lowShelf.gain.value = sanitizedSettings.lowGain;

    const midPeak = audioContext.createBiquadFilter();

    midPeak.type = 'peaking';
    midPeak.frequency.value = sanitizedSettings.midFrequency;

    midPeak.Q.value = sanitizedSettings.midQ;

    midPeak.gain.value = sanitizedSettings.midGain;

    const highShelf = audioContext.createBiquadFilter();

    highShelf.type = 'highshelf';
    highShelf.frequency.value = sanitizedSettings.highFrequency;

    highShelf.gain.value = sanitizedSettings.highGain;

    lowShelf.connect(midPeak);
    midPeak.connect(highShelf);

    return {
        input: lowShelf,
        output: highShelf,

        lowShelf,
        midPeak,
        highShelf,
    };
}

function sanitizeEqSettings(audioContext, settings) {
    const maximumFrequency = Math.max(20, audioContext.sampleRate / 2 - 1);

    return {
        lowGain: clamp(Number(settings.lowGain), MIN_GAIN_DB, MAX_GAIN_DB, DEFAULT_SETTINGS.lowGain),

        midGain: clamp(Number(settings.midGain), MIN_GAIN_DB, MAX_GAIN_DB, DEFAULT_SETTINGS.midGain),

        highGain: clamp(Number(settings.highGain), MIN_GAIN_DB, MAX_GAIN_DB, DEFAULT_SETTINGS.highGain),

        lowFrequency: clamp(Number(settings.lowFrequency), 20, maximumFrequency, DEFAULT_SETTINGS.lowFrequency),

        midFrequency: clamp(Number(settings.midFrequency), 20, maximumFrequency, DEFAULT_SETTINGS.midFrequency),

        highFrequency: clamp(Number(settings.highFrequency), 20, maximumFrequency, DEFAULT_SETTINGS.highFrequency),

        midQ: clamp(Number(settings.midQ), 0.0001, 1000, DEFAULT_SETTINGS.midQ),
    };
}

function clamp(value, minimum, maximum, fallback) {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(minimum, Math.min(value, maximum));
}
