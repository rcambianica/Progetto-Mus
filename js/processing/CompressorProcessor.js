export function createCompressorNode(audioContext, settings) {
  const compressor = audioContext.createDynamicsCompressor();

  compressor.threshold.value = clamp(
    Number(settings.threshold),
    compressor.threshold.minValue,
    compressor.threshold.maxValue,
  );

  compressor.ratio.value = clamp(Number(settings.ratio), compressor.ratio.minValue, compressor.ratio.maxValue);

  compressor.attack.value = clamp(Number(settings.attack), compressor.attack.minValue, compressor.attack.maxValue);

  compressor.release.value = clamp(Number(settings.release), compressor.release.minValue, compressor.release.maxValue);

  return compressor;
}

function clamp(value, minimum, maximum) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.min(value, maximum));
}
