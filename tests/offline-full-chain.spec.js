const {
    test,
    expect
} = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/blank.html");
});

test("OfflineRenderer collega e renderizza insieme tutti gli AudioNode di processing", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            createStereoToneBuffer,
            hasOnlyFiniteSamples,
            getPeak
        } = await import(
            "/tests/helpers/audio-buffer-factory.js"
        );

        const {
            renderProcessedAudio
        } = await import(
            "/js/audio/OfflineRenderer.js"
        );

        const {
            calculateChorusTailSeconds
        } = await import(
            "/js/processing/ChorusProcessor.js"
        );

        const {
            calculateDelayTailSeconds
        } = await import(
            "/js/processing/DelayProcessor.js"
        );

        const {
            calculateReverbTailSeconds
        } = await import(
            "/js/processing/ReverbProcessor.js"
        );

        const {
            dbToLinear
        } = await import(
            "/js/analysis/PeakAnalyzer.js"
        );

        const input = createStereoToneBuffer({
            leftFrequencyHz: 440,
            rightFrequencyHz: 880,
            amplitude: 0.3,
            durationSeconds: 0.25,
            sampleRate: 48_000
        });

        const settings = {
            gain: {
                enabled: true,
                value: 1.2
            },
            eq: {
                enabled: true,
                lowGain: 3,
                midGain: -2,
                highGain: 2,
                lowFrequency: 250,
                midFrequency: 1_000,
                highFrequency: 5_000,
                midQ: 1
            },
            compressor: {
                enabled: true,
                threshold: -18,
                ratio: 4,
                attack: 0.005,
                release: 0.1
            },
            distortion: {
                enabled: true,
                drive: 30,
                mix: 0.2,
                oversample: "2x"
            },
            chorus: {
                enabled: true,
                rate: 1,
                depthMs: 5,
                baseDelayMs: 20,
                mix: 0.2
            },
            delay: {
                enabled: true,
                time: 0.05,
                feedback: 0.2,
                mix: 0.15
            },
            reverb: {
                enabled: true,
                duration: 0.2,
                decay: 2,
                mix: 0.15
            },
            normalization: {
                enabled: true,
                targetDb: -3
            },
            limiter: {
                enabled: true,
                threshold: -6
            }
        };

        const output = await renderProcessedAudio(
            input,
            settings
        );

        const totalTail =
            calculateChorusTailSeconds(settings.chorus) +
            calculateDelayTailSeconds(settings.delay) +
            calculateReverbTailSeconds(settings.reverb);

        const expectedLength =
            input.length +
            Math.ceil(totalTail * input.sampleRate);

        return {
            channels: output.numberOfChannels,
            sampleRate: output.sampleRate,
            length: output.length,
            expectedLength,
            finite: hasOnlyFiniteSamples(output),
            peak: getPeak(output),
            limiterCeiling: dbToLinear(-6)
        };
    });

    expect(result.channels).toBe(2);
    expect(result.sampleRate).toBe(48_000);
    expect(result.length).toBe(result.expectedLength);
    expect(result.finite).toBe(true);
    expect(result.peak).toBeGreaterThan(0);
    expect(result.peak).toBeLessThanOrEqual(
        result.limiterCeiling + 1e-6
    );
});
