const DEFAULT_SETTINGS = {
    time: 0.25,
    feedback: 0.3,
    mix: 0.25
};

const MAX_DELAY_SECONDS = 2;
const MAX_FEEDBACK = 0.9;

export function createDelayEffect(
    audioContext,
    settings = {}
) {
    if (!audioContext) {
        throw new Error(
            "An audio context is required to create the delay."
        );
    }

    const sanitizedSettings =
        sanitizeDelaySettings(settings);

    const input =
        audioContext.createGain();

    const output =
        audioContext.createGain();

    const dryGain =
        audioContext.createGain();

    const wetGain =
        audioContext.createGain();

    const delayNode =
        audioContext.createDelay(
            MAX_DELAY_SECONDS
        );

    const feedbackGain =
        audioContext.createGain();

    delayNode.delayTime.value =
        sanitizedSettings.time;

    feedbackGain.gain.value =
        sanitizedSettings.feedback;

    dryGain.gain.value =
        1 - sanitizedSettings.mix;

    wetGain.gain.value =
        sanitizedSettings.mix;

    /*
     * Percorso dry:
     *
     * input → dryGain → output
     */
    input.connect(dryGain);
    dryGain.connect(output);

    /*
     * Percorso wet:
     *
     * input → delay → wetGain → output
     */
    input.connect(delayNode);
    delayNode.connect(wetGain);
    wetGain.connect(output);

    /*
     * Feedback:
     *
     * delay → feedbackGain → delay
     */
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode);

    return {
        input,
        output,

        delayNode,
        feedbackGain,
        dryGain,
        wetGain
    };
}

export function calculateDelayTailSeconds(
    settings = {}
) {
    const sanitizedSettings =
        sanitizeDelaySettings(settings);

    const delayTime =
        sanitizedSettings.time;

    const feedback =
        sanitizedSettings.feedback;

    const mix =
        sanitizedSettings.mix;

    // Con il percorso wet completamente silenziato nessuna ripetizione è udibile e non serve estendere il buffer offline
     
    if (mix <= 0) {
        return 0;
    }

    if (delayTime <= 0) {
        return 0;
    }

    // Anche con feedback = 0 esiste almeno una ripetizione ritardata
    if (feedback <= 0) {
        return delayTime;
    }

    // Calcolo quante ripetizioni per portare l'ampiezza sotto 0.001, equivalente a circa -60 dB
    const minimumAmplitude = 0.001;

    const repetitions =
        Math.ceil(
            Math.log(minimumAmplitude) /
            Math.log(feedback)
        ) + 1;

    return Math.min(
        delayTime * repetitions,
        15
    );
}

function sanitizeDelaySettings(settings) {
    return {
        time: clamp(
            Number(settings.time),
            0,
            MAX_DELAY_SECONDS,
            DEFAULT_SETTINGS.time
        ),

        feedback: clamp(
            Number(settings.feedback),
            0,
            MAX_FEEDBACK,
            DEFAULT_SETTINGS.feedback
        ),

        mix: clamp(
            Number(settings.mix),
            0,
            1,
            DEFAULT_SETTINGS.mix
        )
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