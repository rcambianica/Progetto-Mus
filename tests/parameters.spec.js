const {
    test,
    expect
} = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/blank.html");
});

test("GainProcessor limita e corregge i valori non validi", async ({ page }) => {
    const values = await page.evaluate(async () => {
        const {
            sanitizeGainValue
        } = await import("/js/processing/GainProcessor.js");

        return {
            negative: sanitizeGainValue(-1),
            tooHigh: sanitizeGainValue(8),
            invalid: sanitizeGainValue(Number.NaN),
            valid: sanitizeGainValue(2.5)
        };
    });

    expect(values).toEqual({
        negative: 0,
        tooHigh: 4,
        invalid: 1,
        valid: 2.5
    });
});

test("DelayProcessor applica i limiti ai parametri", async ({ page }) => {
    const values = await page.evaluate(async () => {
        const {
            createDelayEffect
        } = await import("/js/processing/DelayProcessor.js");

        const context =
            new OfflineAudioContext(1, 128, 48_000);

        const effect = createDelayEffect(context, {
            time: 99,
            feedback: 99,
            mix: -1
        });

        return {
            time: effect.delayNode.delayTime.value,
            feedback: effect.feedbackGain.gain.value,
            dry: effect.dryGain.gain.value,
            wet: effect.wetGain.gain.value
        };
    });

    expect(values.time).toBeCloseTo(2, 6);
    expect(values.feedback).toBeCloseTo(0.9, 6);
    expect(values.dry).toBeCloseTo(1, 6);
    expect(values.wet).toBeCloseTo(0, 6);
});

test("ChorusProcessor configura modulazione e crossfade equal-power", async ({ page }) => {
    const values = await page.evaluate(async () => {
        const {
            createChorusEffect,
            calculateChorusTailSeconds
        } = await import("/js/processing/ChorusProcessor.js");

        const context =
            new OfflineAudioContext(1, 128, 48_000);

        const effect = createChorusEffect(context, {
            rate: 20,
            depthMs: 50,
            baseDelayMs: 5,
            mix: 0.5
        });

        return {
            rate: effect.lfo.frequency.value,
            depthSeconds: effect.lfoGain.gain.value,
            baseDelaySeconds: effect.delayNode.delayTime.value,
            dry: effect.dryGain.gain.value,
            wet: effect.wetGain.gain.value,
            tail: calculateChorusTailSeconds({
                rate: 20,
                depthMs: 50,
                baseDelayMs: 5,
                mix: 0.5
            }),
            noWetTail: calculateChorusTailSeconds({
                baseDelayMs: 20,
                depthMs: 10,
                mix: 0
            })
        };
    });

    const equalPower = Math.SQRT1_2;

    expect(values.rate).toBeCloseTo(5, 6);
    expect(values.depthSeconds).toBeCloseTo(0.015, 6);
    expect(values.baseDelaySeconds).toBeCloseTo(0.015, 6);
    expect(values.dry).toBeCloseTo(equalPower, 6);
    expect(values.wet).toBeCloseTo(equalPower, 6);
    expect(values.tail).toBeCloseTo(0.03, 6);
    expect(values.noWetTail).toBe(0);
});

test("EQProcessor configura tipi e limiti dei tre filtri", async ({ page }) => {
    const values = await page.evaluate(async () => {
        const {
            createThreeBandEq
        } = await import("/js/processing/EQProcessor.js");

        const context =
            new OfflineAudioContext(1, 128, 48_000);

        const eq = createThreeBandEq(context, {
            lowGain: -99,
            midGain: 99,
            highGain: Number.NaN,
            lowFrequency: 5,
            midFrequency: 999_999,
            highFrequency: Number.NaN,
            midQ: 0
        });

        return {
            lowType: eq.lowShelf.type,
            midType: eq.midPeak.type,
            highType: eq.highShelf.type,
            lowGain: eq.lowShelf.gain.value,
            midGain: eq.midPeak.gain.value,
            highGain: eq.highShelf.gain.value,
            lowFrequency: eq.lowShelf.frequency.value,
            midFrequency: eq.midPeak.frequency.value,
            highFrequency: eq.highShelf.frequency.value,
            midQ: eq.midPeak.Q.value
        };
    });

    expect(values.lowType).toBe("lowshelf");
    expect(values.midType).toBe("peaking");
    expect(values.highType).toBe("highshelf");
    expect(values.lowGain).toBeCloseTo(-12, 6);
    expect(values.midGain).toBeCloseTo(12, 6);
    expect(values.highGain).toBeCloseTo(0, 6);
    expect(values.lowFrequency).toBeCloseTo(20, 6);
    expect(values.midFrequency).toBeCloseTo(23_999, 6);
    expect(values.highFrequency).toBeCloseTo(5_000, 6);
    expect(values.midQ).toBeCloseTo(0.0001, 6);
});

test("LimiterProcessor crea un compressor configurato come limiter", async ({ page }) => {
    const values = await page.evaluate(async () => {
        const {
            createLimiterNode,
            sanitizeLimiterThreshold
        } = await import("/js/processing/LimiterProcessor.js");

        const context =
            new OfflineAudioContext(1, 128, 48_000);

        const limiter = createLimiterNode(context, {
            threshold: -6
        });

        return {
            threshold: limiter.threshold.value,
            ratio: limiter.ratio.value,
            knee: limiter.knee.value,
            attack: limiter.attack.value,
            release: limiter.release.value,
            tooHigh: sanitizeLimiterThreshold(5),
            tooLow: sanitizeLimiterThreshold(-120),
            invalid: sanitizeLimiterThreshold(Number.NaN)
        };
    });

    expect(values.threshold).toBeCloseTo(-6, 6);
    expect(values.ratio).toBeCloseTo(20, 6);
    expect(values.knee).toBeCloseTo(0, 6);
    expect(values.attack).toBeCloseTo(0.001, 6);
    expect(values.release).toBeCloseTo(0.05, 6);
    expect(values.tooHigh).toBe(0);
    expect(values.tooLow).toBe(-100);
    expect(values.invalid).toBe(-1);
});
