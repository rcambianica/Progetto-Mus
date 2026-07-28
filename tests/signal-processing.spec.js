const {
    test,
    expect
} = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/blank.html");
});

test("DelayProcessor con feedback zero produce un solo eco", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createImpulseBuffer,
            renderEffect,
            getPeakInWindow
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createDelayEffect
        } = await import("/js/processing/DelayProcessor.js");

        const input = createImpulseBuffer({
            durationSeconds: 0.01,
            sampleRate: 48_000
        });

        const output = await renderEffect(
            input,
            context => createDelayEffect(context, {
                time: 0.1,
                feedback: 0,
                mix: 1
            }),
            0.25
        );

        return {
            start: getPeakInWindow(output, 0, 0.001),
            firstEcho: getPeakInWindow(output, 0.1, 0.01),
            secondEcho: getPeakInWindow(output, 0.2, 0.01)
        };
    });

    expect(result.start.amplitude).toBeLessThan(1e-6);
    expect(result.firstEcho.amplitude).toBeCloseTo(1, 2);
    expect(result.secondEcho.amplitude).toBeLessThan(1e-6);
});

test("Normalizer calcola il gain necessario per raggiungere il target", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            createSilenceBuffer
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            calculateNormalizationGain,
            sanitizeNormalizationTarget
        } = await import("/js/processing/Normalizer.js");

        const sine = createSineBuffer({
            frequencyHz: 1_000,
            amplitude: 0.25,
            durationSeconds: 0.1,
            sampleRate: 48_000
        });

        const silence = createSilenceBuffer({
            durationSeconds: 0.1,
            sampleRate: 48_000
        });

        return {
            gain: calculateNormalizationGain(sine, -6),
            silenceGain: calculateNormalizationGain(silence, -6),
            tooHigh: sanitizeNormalizationTarget(3),
            tooLow: sanitizeNormalizationTarget(-100),
            invalid: sanitizeNormalizationTarget(Number.NaN)
        };
    });

    const targetLinear = 10 ** (-6 / 20);
    const expectedGain = targetLinear / 0.25;

    expect(result.gain).toBeCloseTo(expectedGain, 5);
    expect(result.silenceGain).toBe(1);
    expect(result.tooHigh).toBe(0);
    expect(result.tooLow).toBe(-60);
    expect(result.invalid).toBe(-1);
});

test("Limiter applica un gain uniforme e rispetta il ceiling", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            enforcePeakCeiling
        } = await import("/js/processing/LimiterProcessor.js");

        const {
            getPeak,
            dbToLinear
        } = await import("/js/analysis/PeakAnalyzer.js");

        const input = new AudioBuffer({
            numberOfChannels: 1,
            length: 4,
            sampleRate: 48_000
        });

        input.getChannelData(0).set([
            0.3,
            1.2,
            -0.6,
            -1.1
        ]);

        const output = enforcePeakCeiling(input, -6);
        const outputData = output.getChannelData(0);

        const belowThreshold = new AudioBuffer({
            numberOfChannels: 1,
            length: 2,
            sampleRate: 48_000
        });

        belowThreshold.getChannelData(0).set([
            0.1,
            -0.2
        ]);

        const unchanged = enforcePeakCeiling(
            belowThreshold,
            -1
        );

        return {
            peak: getPeak(output),
            ceiling: dbToLinear(-6),
            ratioA: outputData[0] / 0.3,
            ratioB: outputData[2] / -0.6,
            sameObjectBelowThreshold:
                unchanged === belowThreshold,
            finite: Array.from(outputData).every(
                Number.isFinite
            )
        };
    });

    expect(result.finite).toBe(true);
    expect(result.peak).toBeLessThanOrEqual(
        result.ceiling + 1e-7
    );
    expect(result.ratioA).toBeCloseTo(result.ratioB, 6);
    expect(result.sameObjectBelowThreshold).toBe(true);
});

test("La curva di distorsione è limitata, simmetrica e diventa non lineare", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSoftClipCurve
        } = await import(
            "/js/processing/DistortionProcessor.js"
        );

        const linearCurve = createSoftClipCurve(0);
        const drivenCurve = createSoftClipCurve(100);

        let maximumIdentityError = 0;
        let maximumSymmetryError = 0;
        let maximumAbsoluteValue = 0;

        for (
            let index = 0;
            index < linearCurve.length;
            index++
        ) {
            const expectedInput =
                index * 2 /
                (linearCurve.length - 1) - 1;

            maximumIdentityError = Math.max(
                maximumIdentityError,
                Math.abs(
                    linearCurve[index] -
                    expectedInput
                )
            );

            const oppositeIndex =
                drivenCurve.length - 1 - index;

            maximumSymmetryError = Math.max(
                maximumSymmetryError,
                Math.abs(
                    drivenCurve[index] +
                    drivenCurve[oppositeIndex]
                )
            );

            maximumAbsoluteValue = Math.max(
                maximumAbsoluteValue,
                Math.abs(drivenCurve[index])
            );
        }

        const halfInputIndex = Math.round(
            0.75 * (drivenCurve.length - 1)
        );

        return {
            maximumIdentityError,
            maximumSymmetryError,
            maximumAbsoluteValue,
            linearAtHalf: linearCurve[halfInputIndex],
            drivenAtHalf: drivenCurve[halfInputIndex],
            first: drivenCurve[0],
            last: drivenCurve[drivenCurve.length - 1]
        };
    });

    expect(result.maximumIdentityError).toBeLessThan(1e-6);
    expect(result.maximumSymmetryError).toBeLessThan(1e-6);
    expect(result.maximumAbsoluteValue).toBeLessThanOrEqual(1);
    expect(result.drivenAtHalf).toBeGreaterThan(
        result.linearAtHalf
    );
    expect(result.first).toBeCloseTo(-1, 6);
    expect(result.last).toBeCloseTo(1, 6);
});

test("DistortionProcessor con mix zero conserva il segnale", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createSineBuffer,
            renderEffect,
            getMaximumDifference
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
            durationSeconds: 0.1,
            sampleRate: 48_000
        });

        const output = await renderEffect(
            input,
            context => createDistortionEffect(context, {
                drive: 100,
                mix: 0,
                oversample: "4x"
            })
        );

        return {
            difference: getMaximumDifference(
                input,
                output
            )
        };
    });

    expect(result.difference).toBeLessThan(1e-5);
});

test("La risposta impulsiva del riverbero è deterministica e decadente", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            getMaximumDifference,
            getRms
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            createImpulseResponse,
            calculateReverbTailSeconds
        } = await import("/js/processing/ReverbProcessor.js");

        const context =
            new OfflineAudioContext(2, 48_000, 48_000);

        const first = createImpulseResponse(
            context,
            1,
            2
        );

        const second = createImpulseResponse(
            context,
            1,
            2
        );

        return {
            difference: getMaximumDifference(first, second),
            earlyRms: getRms(first, {
                startSeconds: 0,
                endSeconds: 0.25
            }),
            lateRms: getRms(first, {
                startSeconds: 0.75,
                endSeconds: 1
            }),
            duration: first.duration,
            tail: calculateReverbTailSeconds({
                duration: 1,
                decay: 2,
                mix: 0.5
            }),
            noWetTail: calculateReverbTailSeconds({
                duration: 1,
                decay: 2,
                mix: 0
            })
        };
    });

    expect(result.difference).toBe(0);
    expect(result.earlyRms).toBeGreaterThan(result.lateRms);
    expect(result.duration).toBeCloseTo(1, 6);
    expect(result.tail).toBeCloseTo(1, 6);
    expect(result.noWetTail).toBe(0);
});