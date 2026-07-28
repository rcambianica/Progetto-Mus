const DEFAULT_SETTINGS = {
    duration: 2,
    decay: 2,
    mix: 0.25
};

const MIN_DURATION_SECONDS = 0.2;
const MAX_DURATION_SECONDS = 6;
const MIN_DECAY = 0.5;
const MAX_DECAY = 6;

export function createReverbEffect(
    audioContext,
    settings = {}
) {
    if (!audioContext) {
        throw new Error(
            "An audio context is required to create the reverb."
        );
    }

    const sanitizedSettings =
        sanitizeReverbSettings(settings);

    const input =
        audioContext.createGain();

    const output =
        audioContext.createGain();

    const dryGain =
        audioContext.createGain();

    const wetGain =
        audioContext.createGain();

    const convolver =
        audioContext.createConvolver();

    convolver.normalize = true;

    convolver.buffer =
        createImpulseResponse(
            audioContext,
            sanitizedSettings.duration,
            sanitizedSettings.decay
        );

    const mixAngle =
        sanitizedSettings.mix *
        Math.PI / 2;

    dryGain.gain.value =
        Math.cos(mixAngle);

    wetGain.gain.value =
        Math.sin(mixAngle);

    input.connect(dryGain);
    dryGain.connect(output);

    input.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(output);

    return {
        input,
        output,
        convolver,
        dryGain,
        wetGain
    };
}

export function createImpulseResponse(
    audioContext,
    duration,
    decay
) {
    const sanitizedSettings =
        sanitizeReverbSettings({
            duration,
            decay,
            mix: DEFAULT_SETTINGS.mix
        });

    const sampleRate =
        audioContext.sampleRate;

    const length =
        Math.max(
            1,
            Math.ceil(
                sampleRate *
                sanitizedSettings.duration
            )
        );

    const destinationChannels =
        Number(
            audioContext.destination
                ?.channelCount
        );

    const numberOfChannels =
        Number.isFinite(destinationChannels)
            ? Math.max(
                1,
                Math.min(
                    2,
                    destinationChannels
                )
            )
            : 2;

    const impulse =
        audioContext.createBuffer(
            numberOfChannels,
            length,
            sampleRate
        );

    for (
        let channel = 0;
        channel < numberOfChannels;
        channel++
    ) {
        const channelData =
            impulse.getChannelData(channel);

        const random =
            createPseudoRandom(
                0x5f3759df +
                channel * 0x9e3779b9 +
                Math.round(
                    sanitizedSettings.duration *
                    1000
                ) +
                Math.round(
                    sanitizedSettings.decay *
                    100
                )
            );

        for (
            let sampleIndex = 0;
            sampleIndex < length;
            sampleIndex++
        ) {
            const normalizedPosition =
                sampleIndex /
                Math.max(1, length - 1);

            const envelope =
                Math.pow(
                    1 - normalizedPosition,
                    sanitizedSettings.decay
                );

            channelData[sampleIndex] =
                (
                    random() * 2 - 1
                ) * envelope;
        }
    }

    return impulse;
}

export function calculateReverbTailSeconds(
    settings = {}
) {
    const sanitizedSettings =
        sanitizeReverbSettings(settings);

    if (sanitizedSettings.mix <= 0) {
        return 0;
    }

    return sanitizedSettings.duration;
}

function sanitizeReverbSettings(settings) {
    return {
        duration: clamp(
            Number(settings.duration),
            MIN_DURATION_SECONDS,
            MAX_DURATION_SECONDS,
            DEFAULT_SETTINGS.duration
        ),

        decay: clamp(
            Number(settings.decay),
            MIN_DECAY,
            MAX_DECAY,
            DEFAULT_SETTINGS.decay
        ),

        mix: clamp(
            Number(settings.mix),
            0,
            1,
            DEFAULT_SETTINGS.mix
        )
    };
}

function createPseudoRandom(seed) {
    let state = seed >>> 0;

    return function nextRandom() {
        state += 0x6d2b79f5;

        let value = state;

        value = Math.imul(
            value ^ value >>> 15,
            value | 1
        );

        value ^=
            value +
            Math.imul(
                value ^ value >>> 7,
                value | 61
            );

        return (
            (
                value ^ value >>> 14
            ) >>> 0
        ) / 4_294_967_296;
    };
}

function clamp(
    value,
    minimum,
    maximum,
    fallback
) {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(
        minimum,
        Math.min(value, maximum)
    );
}