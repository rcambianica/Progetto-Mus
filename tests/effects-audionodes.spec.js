const {
    test,
    expect
} = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/blank.html");
});

test("DistortionProcessor configura il WaveShaperNode e il crossfade equal-power", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createDistortionEffect
        } = await import(
            "/js/processing/DistortionProcessor.js"
        );

        const context =
            new OfflineAudioContext(1, 128, 48_000);

        const effect = createDistortionEffect(context, {
            drive: 50,
            mix: 0.5,
            oversample: "2x"
        });

        const fallback = createDistortionEffect(context, {
            drive: 50,
            mix: 0.5,
            oversample: "invalid"
        });

        return {
            oversample: effect.waveShaper.oversample,
            fallbackOversample:
                fallback.waveShaper.oversample,
            curveLength: effect.waveShaper.curve.length,
            dry: effect.dryGain.gain.value,
            wet: effect.wetGain.gain.value
        };
    });

    expect(result.oversample).toBe("2x");
    expect(result.fallbackOversample).toBe("4x");
    expect(result.curveLength).toBe(65_536);
    expect(result.dry).toBeCloseTo(Math.SQRT1_2, 6);
    expect(result.wet).toBeCloseTo(Math.SQRT1_2, 6);
});

test("Il WaveShaperNode produce realmente un segnale non lineare sul percorso wet", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            renderEffect,
            getPeak,
            getMaximumDifference,
            hasOnlyFiniteSamples
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createDistortionEffect
        } = await import(
            "/js/processing/DistortionProcessor.js"
        );

        const input = createSineBuffer({
            frequencyHz: 1_000,
            amplitude: 0.5,
            durationSeconds: 0.2,
            sampleRate: 48_000
        });

        const output = await renderEffect(
            input,
            context => createDistortionEffect(context, {
                drive: 100,
                mix: 1,
                oversample: "none"
            })
        );

        return {
            inputPeak: getPeak(input),
            outputPeak: getPeak(output),
            difference: getMaximumDifference(input, output),
            finite: hasOnlyFiniteSamples(output)
        };
    });

    expect(result.finite).toBe(true);
    expect(result.difference).toBeGreaterThan(0.1);
    expect(result.outputPeak).toBeGreaterThan(result.inputPeak);
    expect(result.outputPeak).toBeLessThanOrEqual(1.000001);
});

test("ChorusProcessor con mix zero conserva il segnale", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            renderEffect,
            getMaximumDifference
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createChorusEffect
        } = await import(
            "/js/processing/ChorusProcessor.js"
        );

        const input = createSineBuffer({
            frequencyHz: 440,
            amplitude: 0.4,
            durationSeconds: 0.3,
            sampleRate: 48_000
        });

        const output = await renderEffect(
            input,
            context => createChorusEffect(context, {
                rate: 2,
                depthMs: 10,
                baseDelayMs: 20,
                mix: 0
            })
        );

        return {
            difference: getMaximumDifference(input, output)
        };
    });

    expect(result.difference).toBeLessThan(1e-5);
});

test("OscillatorNode e AudioParam del chorus modulano realmente il DelayNode", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            renderEffect,
            getMaximumDifference,
            hasOnlyFiniteSamples
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createChorusEffect
        } = await import(
            "/js/processing/ChorusProcessor.js"
        );

        const input = createSineBuffer({
            frequencyHz: 440,
            amplitude: 0.4,
            durationSeconds: 1,
            sampleRate: 48_000
        });

        const fixedDelay = await renderEffect(
            input,
            context => createChorusEffect(context, {
                rate: 2,
                depthMs: 0,
                baseDelayMs: 20,
                mix: 1
            }),
            0.04
        );

        const modulatedDelay = await renderEffect(
            input,
            context => createChorusEffect(context, {
                rate: 2,
                depthMs: 10,
                baseDelayMs: 20,
                mix: 1
            }),
            0.04
        );

        return {
            difference: getMaximumDifference(
                fixedDelay,
                modulatedDelay
            ),
            finite:
                hasOnlyFiniteSamples(fixedDelay) &&
                hasOnlyFiniteSamples(modulatedDelay)
        };
    });

    expect(result.finite).toBe(true);
    expect(result.difference).toBeGreaterThan(0.01);
});

test("ReverbProcessor con mix zero conserva il segnale", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            renderEffect,
            getMaximumDifference
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createReverbEffect
        } = await import(
            "/js/processing/ReverbProcessor.js"
        );

        const input = createSineBuffer({
            frequencyHz: 440,
            amplitude: 0.4,
            durationSeconds: 0.2,
            sampleRate: 48_000
        });

        const output = await renderEffect(
            input,
            context => createReverbEffect(context, {
                duration: 0.5,
                decay: 2,
                mix: 0
            })
        );

        return {
            difference: getMaximumDifference(input, output)
        };
    });

    expect(result.difference).toBeLessThan(1e-5);
});

test("Il ConvolverNode renderizza la risposta impulsiva e una coda decadente", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createImpulseBuffer,
            renderEffect,
            getRms,
            hasOnlyFiniteSamples
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createReverbEffect
        } = await import(
            "/js/processing/ReverbProcessor.js"
        );

        const input = createImpulseBuffer({
            durationSeconds: 0.01,
            amplitude: 1,
            sampleRate: 48_000
        });

        let convolverProperties;

        const output = await renderEffect(
            input,
            context => {
                const effect = createReverbEffect(context, {
                    duration: 0.5,
                    decay: 2,
                    mix: 1
                });

                convolverProperties = {
                    normalize: effect.convolver.normalize,
                    impulseDuration:
                        effect.convolver.buffer.duration
                };

                return effect;
            },
            0.5
        );

        return {
            normalize: convolverProperties.normalize,
            impulseDuration:
                convolverProperties.impulseDuration,
            earlyRms: getRms(output, {
                startSeconds: 0,
                endSeconds: 0.1
            }),
            lateRms: getRms(output, {
                startSeconds: 0.4,
                endSeconds: 0.5
            }),
            afterInputRms: getRms(output, {
                startSeconds: 0.05,
                endSeconds: 0.45
            }),
            finite: hasOnlyFiniteSamples(output)
        };
    });

    expect(result.normalize).toBe(true);
    expect(result.impulseDuration).toBeCloseTo(0.5, 4);
    expect(result.finite).toBe(true);
    expect(result.afterInputRms).toBeGreaterThan(0);
    expect(result.earlyRms).toBeGreaterThan(result.lateRms);
});
