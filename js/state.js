export const state = {
    audioContext: null,

    originalFile: null,
    originalBuffer: null,
    processedBuffer: null,

    originalInfo: {
        durationMs: 0,
        sampleRate: 0,
        numberOfChannels: 0,
        peakLinear: 0,
        peakDb: -Infinity
    },

    processedInfo: {
        durationMs: 0,
        sampleRate: 0,
        numberOfChannels: 0,
        peakLinear: 0,
        peakDb: -Infinity
    },

    processingSettings: {
        gain: {
            enabled: true,
            value: 1.0
        },

        normalization: {
            enabled: false,
            targetDb: -1
        },

        compressor: {
            enabled: false,
            threshold: -24,
            ratio: 4,
            attack: 0.003,
            release: 0.25
        },

        distortion: {
            enabled: false,
            drive: 25,
            mix: 0.35,
            oversample: "4x"
        },

        chorus: {
            enabled: false,
            rate: 0.5,
            depthMs: 10,
            mix: 0.25,
            baseDelayMs: 20
        },

        limiter: {
            enabled: false,
            threshold: -1
        },

        eq: {
            enabled: false,

            lowGain: 0,
            midGain: 0,
            highGain: 0,

            lowFrequency: 250,
            midFrequency: 1000,
            highFrequency: 5000,

            midQ: 1
        },

        delay: {
            enabled: false,
            time: 0.25,
            feedback: 0.3,
            mix: 0.25
        },

        reverb: {
            enabled: false,
            duration: 2,
            decay: 2,
            mix: 0.25
        }
    }
};

const listeners = new Set();

export function subscribe(listener) {
    listeners.add(listener);

    return function unsubscribe() {
        listeners.delete(listener);
    };
}

export function notifyStateChanged() {
    for (const listener of listeners) {
        listener(state);
    }
}

export function setAudioContext(audioContext) {
    state.audioContext = audioContext;
    notifyStateChanged();
}

export function setOriginalFile(file) {
    state.originalFile = file;
    notifyStateChanged();
}

export function setOriginalBuffer(audioBuffer) {
    state.originalBuffer = audioBuffer;
    notifyStateChanged();
}

export function setProcessedBuffer(audioBuffer) {
    state.processedBuffer = audioBuffer;
    notifyStateChanged();
}

export function setOriginalInfo(info) {
    state.originalInfo = {
        ...state.originalInfo,
        ...info
    };

    notifyStateChanged();
}

export function setProcessedInfo(info) {
    state.processedInfo = {
        ...state.processedInfo,
        ...info
    };

    notifyStateChanged();
}

export function updateProcessingSettings(section, values) {
    state.processingSettings[section] = {
        ...state.processingSettings[section],
        ...values
    };

    notifyStateChanged();
}