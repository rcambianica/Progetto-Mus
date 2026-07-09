export const state = {
    audioContext: null,

    originalFile: null,
    originalBuffer: null,
    processedBuffer: null,

    originalPlayer: null,
    processedPlayer: null,

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

        compressor: {
            enabled: false,
            threshold: -24,
            ratio: 4,
            attack: 0.003,
            release: 0.25
        },

        limiter: {
            enabled: false,
            threshold: -1
        },

        normalization: {
            enabled: false,
            targetDb: -1
        },

        eq: {
            enabled: false,
            lowGain: 0,
            midGain: 0,
            highGain: 0
        },

        delay: {
            enabled: false,
            time: 0.25,
            feedback: 0.3,
            mix: 0.25
        }
    }
};