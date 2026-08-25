const DEFAULT_SETTINGS = {
  drive: 25,
  mix: 0.35,
  oversample: "4x",
};

const CURVE_LENGTH = 65_536;
const MAX_CURVE_SHAPE = 20;
const VALID_OVERSAMPLING_VALUES = new Set(["none", "2x", "4x"]);

export function createDistortionEffect(audioContext, settings = {}) {
  if (!audioContext) {
    throw new Error("An audio context is required to create the distortion effect.");
  }

  const sanitizedSettings = sanitizeDistortionSettings(settings);

  const input = audioContext.createGain();

  const output = audioContext.createGain();

  const dryGain = audioContext.createGain();

  const wetGain = audioContext.createGain();

  const waveShaper = audioContext.createWaveShaper();

  waveShaper.curve = createSoftClipCurve(sanitizedSettings.drive);

  waveShaper.oversample = sanitizedSettings.oversample;

  const mixAngle = (sanitizedSettings.mix * Math.PI) / 2;

  dryGain.gain.value = Math.cos(mixAngle);

  wetGain.gain.value = Math.sin(mixAngle);

  input.connect(dryGain);
  dryGain.connect(output);

  input.connect(waveShaper);
  waveShaper.connect(wetGain);
  wetGain.connect(output);

  return {
    input,
    output,
    waveShaper,
    dryGain,
    wetGain,
  };
}

export function createSoftClipCurve(drive) {
  const sanitizedDrive = clamp(Number(drive), 0, 100, DEFAULT_SETTINGS.drive);

  const curve = new Float32Array(CURVE_LENGTH);

  const shape = (sanitizedDrive / 100) * MAX_CURVE_SHAPE;

  for (let index = 0; index < CURVE_LENGTH; index++) {
    const inputSample = (index * 2) / (CURVE_LENGTH - 1) - 1;

    if (shape === 0) {
      curve[index] = inputSample;
      continue;
    }

    curve[index] = ((1 + shape) * inputSample) / (1 + shape * Math.abs(inputSample));
  }

  return curve;
}

function sanitizeDistortionSettings(settings) {
  const oversample = VALID_OVERSAMPLING_VALUES.has(settings.oversample)
    ? settings.oversample
    : DEFAULT_SETTINGS.oversample;

  return {
    drive: clamp(Number(settings.drive), 0, 100, DEFAULT_SETTINGS.drive),

    mix: clamp(Number(settings.mix), 0, 1, DEFAULT_SETTINGS.mix),

    oversample,
  };
}

function clamp(value, minimum, maximum, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.min(value, maximum));
}
