const DEFAULT_SAMPLE_RATE = 48_000;

/**
 * Crea un AudioBuffer generico e richiama fillChannel
 * per popolare ogni canale.
 */
export function createTestBuffer({
  durationSeconds = 1,
  sampleRate = DEFAULT_SAMPLE_RATE,
  numberOfChannels = 1,
  fillChannel = null,
} = {}) {
  validatePositiveNumber(durationSeconds, "durationSeconds");

  validatePositiveNumber(sampleRate, "sampleRate");

  if (!Number.isInteger(numberOfChannels) || numberOfChannels < 1) {
    throw new TypeError("numberOfChannels deve essere un intero positivo.");
  }

  const length = Math.max(1, Math.round(durationSeconds * sampleRate));

  const buffer = new AudioBuffer({
    length,
    numberOfChannels,
    sampleRate,
  });

  if (typeof fillChannel !== "function") {
    return buffer;
  }

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);

    fillChannel(channelData, {
      channel,
      sampleRate,
      length,
    });
  }

  return buffer;
}

/**
 * Buffer completamente silenzioso.
 */
export function createSilenceBuffer({
  durationSeconds = 1,
  sampleRate = DEFAULT_SAMPLE_RATE,
  numberOfChannels = 1,
} = {}) {
  return createTestBuffer({
    durationSeconds,
    sampleRate,
    numberOfChannels,
  });
}

/**
 * Impulso unitario o di ampiezza configurabile.
 *
 * Utile per:
 * - delay;
 * - riverbero;
 * - chorus;
 * - verifica delle code.
 */
export function createImpulseBuffer({
  durationSeconds = 1,
  sampleRate = DEFAULT_SAMPLE_RATE,
  numberOfChannels = 1,
  impulseTimeSeconds = 0,
  amplitude = 1,
} = {}) {
  return createTestBuffer({
    durationSeconds,
    sampleRate,
    numberOfChannels,

    fillChannel(channelData, { sampleRate: actualSampleRate }) {
      const sampleIndex = Math.round(impulseTimeSeconds * actualSampleRate);

      if (sampleIndex >= 0 && sampleIndex < channelData.length) {
        channelData[sampleIndex] = amplitude;
      }
    },
  });
}

/**
 * Sinusoide uguale su tutti i canali.
 *
 * Utile per:
 * - gain;
 * - equalizzatore;
 * - compressore;
 * - distorsione;
 * - chorus.
 */
export function createSineBuffer({
  frequencyHz = 1_000,
  amplitude = 0.5,
  phaseRadians = 0,
  durationSeconds = 1,
  sampleRate = DEFAULT_SAMPLE_RATE,
  numberOfChannels = 1,
} = {}) {
  return createTestBuffer({
    durationSeconds,
    sampleRate,
    numberOfChannels,

    fillChannel(channelData, { sampleRate: actualSampleRate }) {
      for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex++) {
        channelData[sampleIndex] =
          amplitude * Math.sin((2 * Math.PI * frequencyHz * sampleIndex) / actualSampleRate + phaseRadians);
      }
    },
  });
}

/**
 * Rumore bianco deterministico.
 *
 * Il seed garantisce lo stesso buffer a ogni test.
 */
export function createWhiteNoiseBuffer({
  amplitude = 0.5,
  durationSeconds = 1,
  sampleRate = DEFAULT_SAMPLE_RATE,
  numberOfChannels = 1,
  seed = 12_345,
} = {}) {
  return createTestBuffer({
    durationSeconds,
    sampleRate,
    numberOfChannels,

    fillChannel(channelData, { channel }) {
      const random = createPseudoRandom(seed + channel);

      for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex++) {
        channelData[sampleIndex] = (random() * 2 - 1) * amplitude;
      }
    },
  });
}

/**
 * Due sinusoidi differenti, una per canale.
 *
 * Utile per verificare:
 * - conservazione dello stereo;
 * - assenza di scambio dei canali;
 * - assenza di cross-talk.
 */
export function createStereoToneBuffer({
  leftFrequencyHz = 440,
  rightFrequencyHz = 880,
  amplitude = 0.5,
  durationSeconds = 1,
  sampleRate = DEFAULT_SAMPLE_RATE,
} = {}) {
  return createTestBuffer({
    durationSeconds,
    sampleRate,
    numberOfChannels: 2,

    fillChannel(channelData, { channel, sampleRate: actualSampleRate }) {
      const frequencyHz = channel === 0 ? leftFrequencyHz : rightFrequencyHz;

      for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex++) {
        channelData[sampleIndex] = amplitude * Math.sin((2 * Math.PI * frequencyHz * sampleIndex) / actualSampleRate);
      }
    },
  });
}

/**
 * Sinusoide che cambia bruscamente ampiezza.
 *
 * Utile per verificare attack e release
 * del compressore.
 */
export function createAmplitudeStepBuffer({
  frequencyHz = 1_000,
  lowAmplitude = 0.05,
  highAmplitude = 0.9,
  stepTimeSeconds = 0.25,
  durationSeconds = 1,
  sampleRate = DEFAULT_SAMPLE_RATE,
  numberOfChannels = 1,
} = {}) {
  return createTestBuffer({
    durationSeconds,
    sampleRate,
    numberOfChannels,

    fillChannel(channelData, { sampleRate: actualSampleRate }) {
      for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex++) {
        const timeSeconds = sampleIndex / actualSampleRate;

        const amplitude = timeSeconds < stepTimeSeconds ? lowAmplitude : highAmplitude;

        channelData[sampleIndex] = amplitude * Math.sin(2 * Math.PI * frequencyHz * timeSeconds);
      }
    },
  });
}

/**
 * Renderizza un AudioBuffer attraverso un singolo nodo
 * oppure attraverso un effetto che espone input/output.
 */
export async function renderEffect(inputBuffer, createGraph, additionalDurationSeconds = 0) {
  if (!(inputBuffer instanceof AudioBuffer)) {
    throw new TypeError("inputBuffer deve essere un AudioBuffer.");
  }

  if (typeof createGraph !== "function") {
    throw new TypeError("createGraph deve essere una funzione.");
  }

  const additionalFrames = Math.ceil(Math.max(0, additionalDurationSeconds) * inputBuffer.sampleRate);

  const offlineContext = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    inputBuffer.length + additionalFrames,
    inputBuffer.sampleRate,
  );

  const source = offlineContext.createBufferSource();

  source.buffer = inputBuffer;

  const graph = createGraph(offlineContext);

  if (!graph) {
    throw new Error("createGraph non ha restituito un nodo o un effetto.");
  }

  /*
   * I processor semplici restituiscono direttamente
   * un AudioNode.
   *
   * Gli effetti complessi restituiscono:
   * {
   *     input: AudioNode,
   *     output: AudioNode
   * }
   */
  const graphInput = graph.input ?? graph;

  const graphOutput = graph.output ?? graph;

  source.connect(graphInput);

  graphOutput.connect(offlineContext.destination);

  source.start(0);

  return await offlineContext.startRendering();
}

/**
 * Picco assoluto massimo di tutti i canali.
 */
export function getPeak(audioBuffer) {
  let peak = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);

    for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex++) {
      peak = Math.max(peak, Math.abs(channelData[sampleIndex]));
    }
  }

  return peak;
}

/**
 * RMS di una finestra temporale.
 */
export function getRms(audioBuffer, { startSeconds = 0, endSeconds = audioBuffer.duration } = {}) {
  const startIndex = Math.max(0, Math.floor(startSeconds * audioBuffer.sampleRate));

  const endIndex = Math.min(audioBuffer.length, Math.ceil(endSeconds * audioBuffer.sampleRate));

  let squaredSum = 0;
  let sampleCount = 0;

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);

    for (let sampleIndex = startIndex; sampleIndex < endIndex; sampleIndex++) {
      const sample = channelData[sampleIndex];

      squaredSum += sample * sample;

      sampleCount++;
    }
  }

  if (sampleCount === 0) {
    return 0;
  }

  return Math.sqrt(squaredSum / sampleCount);
}

/**
 * Legge il campione corrispondente a un istante.
 */
export function getSampleAtTime(audioBuffer, timeSeconds, channel = 0) {
  if (channel < 0 || channel >= audioBuffer.numberOfChannels) {
    throw new RangeError("Indice di canale non valido.");
  }

  const sampleIndex = Math.max(0, Math.min(audioBuffer.length - 1, Math.round(timeSeconds * audioBuffer.sampleRate)));

  return audioBuffer.getChannelData(channel)[sampleIndex];
}

/**
 * Verifica che non siano presenti NaN o Infinity.
 */
export function hasOnlyFiniteSamples(audioBuffer) {
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);

    for (let sampleIndex = 0; sampleIndex < channelData.length; sampleIndex++) {
      if (!Number.isFinite(channelData[sampleIndex])) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Differenza massima campione per campione.
 */
export function getMaximumDifference(firstBuffer, secondBuffer) {
  if (firstBuffer.numberOfChannels !== secondBuffer.numberOfChannels || firstBuffer.length !== secondBuffer.length) {
    throw new Error("I buffer devono avere stessa lunghezza e stesso numero di canali.");
  }

  let maximumDifference = 0;

  for (let channel = 0; channel < firstBuffer.numberOfChannels; channel++) {
    const firstData = firstBuffer.getChannelData(channel);

    const secondData = secondBuffer.getChannelData(channel);

    for (let sampleIndex = 0; sampleIndex < firstData.length; sampleIndex++) {
      maximumDifference = Math.max(maximumDifference, Math.abs(firstData[sampleIndex] - secondData[sampleIndex]));
    }
  }

  return maximumDifference;
}

function createPseudoRandom(seed) {
  let state = seed >>> 0;

  return function nextRandom() {
    state += 0x6d2b79f5;

    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);

    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function validatePositiveNumber(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} deve essere un numero positivo.`);
  }
}

/**
 * Cerca il campione con ampiezza assoluta maggiore
 * in una finestra attorno all'istante indicato.
 */
export function getPeakInWindow(audioBuffer, centerSeconds, radiusSeconds = 0.01, channel = 0) {
  if (channel < 0 || channel >= audioBuffer.numberOfChannels) {
    throw new RangeError("Indice di canale non valido.");
  }

  const sampleRate = audioBuffer.sampleRate;

  const channelData = audioBuffer.getChannelData(channel);

  const startIndex = Math.max(0, Math.floor((centerSeconds - radiusSeconds) * sampleRate));

  const endIndex = Math.min(channelData.length, Math.ceil((centerSeconds + radiusSeconds) * sampleRate) + 1);

  let peakAmplitude = 0;
  let peakIndex = startIndex;

  for (let sampleIndex = startIndex; sampleIndex < endIndex; sampleIndex++) {
    const amplitude = Math.abs(channelData[sampleIndex]);

    if (amplitude > peakAmplitude) {
      peakAmplitude = amplitude;

      peakIndex = sampleIndex;
    }
  }

  return {
    amplitude: peakAmplitude,

    timeSeconds: peakIndex / sampleRate,
  };
}
