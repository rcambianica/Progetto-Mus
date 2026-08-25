const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/fixtures/blank.html");
});

async function readEqResponse(page, settings) {
  return await page.evaluate(async (settingsFromTest) => {
    const { createThreeBandEq } = await import("/js/processing/EQProcessor.js");

    const context = new OfflineAudioContext(1, 128, 48_000);

    const eq = createThreeBandEq(context, settingsFromTest);

    const frequencies = new Float32Array([100, 1_000, 10_000]);

    function magnitudesFor(filter) {
      const magnitude = new Float32Array(frequencies.length);

      const phase = new Float32Array(frequencies.length);

      filter.getFrequencyResponse(frequencies, magnitude, phase);

      return Array.from(magnitude);
    }

    const low = magnitudesFor(eq.lowShelf);
    const mid = magnitudesFor(eq.midPeak);
    const high = magnitudesFor(eq.highShelf);

    return Array.from(frequencies, (frequency, index) => ({
      frequency: Number(frequency),

      magnitude: Number(low[index]) * Number(mid[index]) * Number(high[index]),
    }));
  }, settings);
}

test("EQ flat ha risposta unitaria a basse, medie e alte frequenze", async ({ page }) => {
  const response = await readEqResponse(page, {
    lowGain: 0,
    midGain: 0,
    highGain: 0,
    lowFrequency: 250,
    midFrequency: 1_000,
    highFrequency: 5_000,
    midQ: 1,
  });

  for (const point of response) {
    expect(point.magnitude).toBeCloseTo(1, 4);
  }
});

test("Il lowshelf amplifica 100 Hz più di 1 kHz e 10 kHz", async ({ page }) => {
  const response = await readEqResponse(page, {
    lowGain: 12,
    midGain: 0,
    highGain: 0,
    lowFrequency: 250,
    midFrequency: 1_000,
    highFrequency: 5_000,
    midQ: 1,
  });

  const low = response[0].magnitude;
  const mid = response[1].magnitude;
  const high = response[2].magnitude;

  expect(low).toBeGreaterThan(mid * 1.5);
  expect(low).toBeGreaterThan(high * 1.5);
  expect(low).toBeGreaterThan(1);
});

test("Il filtro peaking attenua maggiormente la frequenza centrale", async ({ page }) => {
  const response = await readEqResponse(page, {
    lowGain: 0,
    midGain: -12,
    highGain: 0,
    lowFrequency: 250,
    midFrequency: 1_000,
    highFrequency: 5_000,
    midQ: 2,
  });

  const low = response[0].magnitude;
  const center = response[1].magnitude;
  const high = response[2].magnitude;

  expect(center).toBeLessThan(low * 0.6);
  expect(center).toBeLessThan(high * 0.6);
  expect(center).toBeLessThan(1);
});

test("L'highshelf amplifica 10 kHz più di 1 kHz e 100 Hz", async ({ page }) => {
  const response = await readEqResponse(page, {
    lowGain: 0,
    midGain: 0,
    highGain: 12,
    lowFrequency: 250,
    midFrequency: 1_000,
    highFrequency: 5_000,
    midQ: 1,
  });

  const low = response[0].magnitude;
  const mid = response[1].magnitude;
  const high = response[2].magnitude;

  expect(high).toBeGreaterThan(mid * 1.5);
  expect(high).toBeGreaterThan(low * 1.5);
  expect(high).toBeGreaterThan(1);
});
