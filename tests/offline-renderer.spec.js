const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/fixtures/blank.html");
});

test("OfflineRenderer senza moduli attivi conserva il buffer", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createStereoToneBuffer, getMaximumDifference } = await import("/tests/helpers/audio-buffer-factory.js");

    const { renderProcessedAudio } = await import("/js/audio/OfflineRenderer.js");

    const input = createStereoToneBuffer({
      leftFrequencyHz: 440,
      rightFrequencyHz: 880,
      amplitude: 0.25,
      durationSeconds: 0.1,
      sampleRate: 48_000,
    });

    const output = await renderProcessedAudio(input, {});

    return {
      difference: getMaximumDifference(input, output),
      inputLength: input.length,
      outputLength: output.length,
      inputChannels: input.numberOfChannels,
      outputChannels: output.numberOfChannels,
      inputRate: input.sampleRate,
      outputRate: output.sampleRate,
    };
  });

  expect(result.difference).toBeLessThan(1e-5);
  expect(result.outputLength).toBe(result.inputLength);
  expect(result.outputChannels).toBe(result.inputChannels);
  expect(result.outputRate).toBe(result.inputRate);
});

test("OfflineRenderer estende il buffer in base alla coda del delay", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createImpulseBuffer } = await import("/tests/helpers/audio-buffer-factory.js");

    const { renderProcessedAudio } = await import("/js/audio/OfflineRenderer.js");

    const { calculateDelayTailSeconds } = await import("/js/processing/DelayProcessor.js");

    const input = createImpulseBuffer({
      durationSeconds: 0.01,
      sampleRate: 48_000,
    });

    const delay = {
      enabled: true,
      time: 0.1,
      feedback: 0.5,
      mix: 0.4,
    };

    const output = await renderProcessedAudio(input, { delay });

    const tailSeconds = calculateDelayTailSeconds(delay);

    const expectedLength = input.length + Math.ceil(tailSeconds * input.sampleRate);

    return {
      outputLength: output.length,
      expectedLength,
      tailSeconds,
    };
  });

  expect(result.tailSeconds).toBeGreaterThan(0);
  expect(result.outputLength).toBe(result.expectedLength);
});

test("OfflineRenderer applica normalizzazione prima del limiter", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createSineBuffer, hasOnlyFiniteSamples } = await import("/tests/helpers/audio-buffer-factory.js");

    const { renderProcessedAudio } = await import("/js/audio/OfflineRenderer.js");

    const { getPeak, dbToLinear } = await import("/js/analysis/PeakAnalyzer.js");

    const input = createSineBuffer({
      frequencyHz: 1_000,
      amplitude: 0.2,
      durationSeconds: 0.2,
      sampleRate: 48_000,
    });

    const output = await renderProcessedAudio(input, {
      normalization: {
        enabled: true,
        targetDb: 0,
      },
      limiter: {
        enabled: true,
        threshold: -6,
      },
    });

    return {
      peak: getPeak(output),
      ceiling: dbToLinear(-6),
      finite: hasOnlyFiniteSamples(output),
    };
  });

  expect(result.finite).toBe(true);
  expect(result.peak).toBeGreaterThan(0);
  expect(result.peak).toBeLessThanOrEqual(result.ceiling + 1e-6);
});
