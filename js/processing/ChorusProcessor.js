const DEFAULT_SETTINGS = {
    rate: 0.5,
    depthMs: 10,
    mix: 0.25,
    baseDelayMs: 20,
};

const MIN_RATE_HZ = 0.05;
const MAX_RATE_HZ = 5;
const MAX_DEPTH_MS = 15;
const MAX_DELAY_SECONDS = 0.05;

export function createChorusEffect(audioContext, settings = {}) {
    if (!audioContext) {
        throw new Error('An audio context is required to create the chorus.');
    }

    const sanitizedSettings = sanitizeChorusSettings(settings);

    const input = audioContext.createGain();

    const output = audioContext.createGain();

    const dryGain = audioContext.createGain();

    const wetGain = audioContext.createGain();

    const delayNode = audioContext.createDelay(MAX_DELAY_SECONDS);

    const lfo = audioContext.createOscillator();

    const lfoGain = audioContext.createGain();

    /**
     * Non un'idea mia, trovata su progetti opensource su github usati come ispirazione.
     * Invece di usare una semplice proporzione lineare (es. se Mix = 0.5, Dry = 0.5 e Wet = 0.5), utilizza la trigonometria.
     * Questo garantisce una curva di crossfade a potenza costante.
     * Se usasse un mix lineare, quando la manopola è al centro si percepirebbe un calo di volume.
     * Con seno e coseno, la potenza acustica percepita rimane costante per tutta la rotazione del parametro Mix.
     */

    const mixAngle = (sanitizedSettings.mix * Math.PI) / 2;

    dryGain.gain.value = Math.cos(mixAngle);

    wetGain.gain.value = Math.sin(mixAngle);

    delayNode.delayTime.value = sanitizedSettings.baseDelayMs / 1000;

    lfo.type = 'sine';

    lfo.frequency.value = sanitizedSettings.rate;

    lfoGain.gain.value = sanitizedSettings.depthMs / 1000;

    input.connect(dryGain);
    dryGain.connect(output);

    input.connect(delayNode);
    delayNode.connect(wetGain);
    wetGain.connect(output);

    lfo.connect(lfoGain);
    lfoGain.connect(delayNode.delayTime);

    lfo.start(0);

    return {
        input,
        output,
        dryGain,
        wetGain,
        delayNode,
        lfo,
        lfoGain,
    };
}

export function calculateChorusTailSeconds(settings = {}) {
    const sanitizedSettings = sanitizeChorusSettings(settings);

    if (sanitizedSettings.mix <= 0) {
        return 0;
    }

    return (sanitizedSettings.baseDelayMs + sanitizedSettings.depthMs) / 1000;
}

function sanitizeChorusSettings(settings) {
    const baseDelayMs = clamp(Number(settings.baseDelayMs), MAX_DEPTH_MS, 30, DEFAULT_SETTINGS.baseDelayMs);

    const maximumSafeDepthMs = Math.min(MAX_DEPTH_MS, baseDelayMs);

    return {
        rate: clamp(Number(settings.rate), MIN_RATE_HZ, MAX_RATE_HZ, DEFAULT_SETTINGS.rate),

        depthMs: clamp(Number(settings.depthMs), 0, maximumSafeDepthMs, DEFAULT_SETTINGS.depthMs),

        mix: clamp(Number(settings.mix), 0, 1, DEFAULT_SETTINGS.mix),

        baseDelayMs,
    };
}

function clamp(value, minimum, maximum, fallback) {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(minimum, Math.min(value, maximum));
}
