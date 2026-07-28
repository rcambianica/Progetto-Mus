const {
    test,
    expect
} = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/blank.html");
});

test("CompressorProcessor configura e limita i parametri del DynamicsCompressorNode", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createCompressorNode
        } = await import(
            "/js/processing/CompressorProcessor.js"
        );

        const context =
            new OfflineAudioContext(1, 128, 48_000);

        const valid = createCompressorNode(context, {
            threshold: -18,
            ratio: 4,
            attack: 0.01,
            release: 0.25
        });

        const clamped = createCompressorNode(context, {
            threshold: 100,
            ratio: -10,
            attack: 100,
            release: -10
        });

        const invalid = createCompressorNode(context, {
            threshold: Number.NaN,
            ratio: Number.NaN,
            attack: Number.NaN,
            release: Number.NaN
        });

        return {
            valid: {
                threshold: valid.threshold.value,
                ratio: valid.ratio.value,
                attack: valid.attack.value,
                release: valid.release.value
            },
            clamped: {
                threshold: clamped.threshold.value,
                ratio: clamped.ratio.value,
                attack: clamped.attack.value,
                release: clamped.release.value
            },
            invalid: {
                threshold: invalid.threshold.value,
                ratio: invalid.ratio.value,
                attack: invalid.attack.value,
                release: invalid.release.value
            },
            limits: {
                thresholdMin: valid.threshold.minValue,
                thresholdMax: valid.threshold.maxValue,
                ratioMin: valid.ratio.minValue,
                ratioMax: valid.ratio.maxValue,
                attackMin: valid.attack.minValue,
                attackMax: valid.attack.maxValue,
                releaseMin: valid.release.minValue,
                releaseMax: valid.release.maxValue
            }
        };
    });

    expect(result.valid.threshold).toBeCloseTo(-18, 6);
    expect(result.valid.ratio).toBeCloseTo(4, 6);
    expect(result.valid.attack).toBeCloseTo(0.01, 6);
    expect(result.valid.release).toBeCloseTo(0.25, 6);

    expect(result.clamped.threshold).toBe(result.limits.thresholdMax);
    expect(result.clamped.ratio).toBe(result.limits.ratioMin);
    expect(result.clamped.attack).toBe(result.limits.attackMax);
    expect(result.clamped.release).toBe(result.limits.releaseMin);

    expect(result.invalid.threshold).toBe(result.limits.thresholdMin);
    expect(result.invalid.ratio).toBe(result.limits.ratioMin);
    expect(result.invalid.attack).toBe(result.limits.attackMin);
    expect(result.invalid.release).toBe(result.limits.releaseMin);
});

test("CompressorProcessor mantiene lineare il rapporto tra segnali sotto soglia", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            renderEffect,
            getRms,
            hasOnlyFiniteSamples
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createCompressorNode
        } = await import(
            "/js/processing/CompressorProcessor.js"
        );

        const settings = {
            threshold: -20,
            ratio: 12,
            attack: 0.003,
            release: 0.1
        };

        const quietInput = createSineBuffer({
            frequencyHz: 1_000,
            amplitude: 0.01,
            durationSeconds: 1,
            sampleRate: 48_000
        });

        const louderInput = createSineBuffer({
            frequencyHz: 1_000,
            amplitude: 0.02,
            durationSeconds: 1,
            sampleRate: 48_000
        });

        const quietOutput = await renderEffect(
            quietInput,
            context => createCompressorNode(
                context,
                settings
            )
        );

        const louderOutput = await renderEffect(
            louderInput,
            context => createCompressorNode(
                context,
                settings
            )
        );

        const window = {
            startSeconds: 0.2,
            endSeconds: 0.8
        };

        return {
            quietRms: getRms(quietOutput, window),
            louderRms: getRms(louderOutput, window),
            finite:
                hasOnlyFiniteSamples(quietOutput) &&
                hasOnlyFiniteSamples(louderOutput)
        };
    });

    expect(result.finite).toBe(true);
    expect(
        result.louderRms / result.quietRms
    ).toBeCloseTo(2, 3);
});

test("CompressorProcessor attenua un segnale stabilmente sopra soglia", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            renderEffect,
            getRms,
            hasOnlyFiniteSamples
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createCompressorNode
        } = await import(
            "/js/processing/CompressorProcessor.js"
        );

        const input = createSineBuffer({
            frequencyHz: 1_000,
            amplitude: 0.9,
            durationSeconds: 1,
            sampleRate: 48_000
        });

        const output = await renderEffect(
            input,
            context => createCompressorNode(context, {
                threshold: -30,
                ratio: 20,
                attack: 0,
                release: 0.1
            })
        );

        const window = {
            startSeconds: 0.25,
            endSeconds: 0.8
        };

        return {
            inputRms: getRms(input, window),
            outputRms: getRms(output, window),
            finite: hasOnlyFiniteSamples(output)
        };
    });

    expect(result.finite).toBe(true);
    expect(result.outputRms).toBeLessThan(
        result.inputRms * 0.75
    );
    expect(result.outputRms).toBeGreaterThan(0);
});
