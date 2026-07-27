const {
    test,
    expect
} = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.goto(
        "/tests/fixtures/blank.html"
    );
});

test(
    "GainProcessor con gain 1 non modifica il segnale",
    async ({ page }) => {
        const result =
            await page.evaluate(
                async () => {
                    const {
                        createSineBuffer,
                        renderEffect,
                        getMaximumDifference,
                        hasOnlyFiniteSamples
                    } =
                        await import(
                            "/tests/helpers/audio-buffer-factory.js"
                        );

                    const {
                        createGainNode
                    } =
                        await import(
                            "/js/processing/GainProcessor.js"
                        );

                    const inputBuffer =
                        createSineBuffer({
                            frequencyHz: 1_000,
                            amplitude: 0.5,
                            durationSeconds: 0.1,
                            sampleRate: 48_000
                        });

                    const outputBuffer =
                        await renderEffect(
                            inputBuffer,
                            audioContext =>
                                createGainNode(
                                    audioContext,
                                    1
                                )
                        );

                    return {
                        maximumDifference:
                            getMaximumDifference(
                                inputBuffer,
                                outputBuffer
                            ),

                        finite:
                            hasOnlyFiniteSamples(
                                outputBuffer
                            )
                    };
                }
            );

        expect(
            result.finite
        ).toBe(true);

        expect(
            result.maximumDifference
        ).toBeLessThan(1e-5);
    }
);

test(
    "GainProcessor con gain 2 raddoppia il picco",
    async ({ page }) => {
        const result =
            await page.evaluate(
                async () => {
                    const {
                        createSineBuffer,
                        renderEffect,
                        getPeak
                    } =
                        await import(
                            "/tests/helpers/audio-buffer-factory.js"
                        );

                    const {
                        createGainNode
                    } =
                        await import(
                            "/js/processing/GainProcessor.js"
                        );

                    const inputBuffer =
                        createSineBuffer({
                            frequencyHz: 1_000,
                            amplitude: 0.25,
                            durationSeconds: 0.1
                        });

                    const outputBuffer =
                        await renderEffect(
                            inputBuffer,
                            audioContext =>
                                createGainNode(
                                    audioContext,
                                    2
                                )
                        );

                    return {
                        inputPeak:
                            getPeak(
                                inputBuffer
                            ),

                        outputPeak:
                            getPeak(
                                outputBuffer
                            )
                    };
                }
            );

        const expectedPeak =
            result.inputPeak * 2;

        expect(
            Math.abs(
                result.outputPeak -
                expectedPeak
            )
        ).toBeLessThan(1e-5);
    }
);

test(
    "GainProcessor con gain 0 produce silenzio",
    async ({ page }) => {
        const result =
            await page.evaluate(
                async () => {
                    const {
                        createSineBuffer,
                        renderEffect,
                        getPeak
                    } =
                        await import(
                            "/tests/helpers/audio-buffer-factory.js"
                        );

                    const {
                        createGainNode
                    } =
                        await import(
                            "/js/processing/GainProcessor.js"
                        );

                    const inputBuffer =
                        createSineBuffer({
                            amplitude: 0.5,
                            durationSeconds: 0.1
                        });

                    const outputBuffer =
                        await renderEffect(
                            inputBuffer,
                            audioContext =>
                                createGainNode(
                                    audioContext,
                                    0
                                )
                        );

                    return {
                        outputPeak:
                            getPeak(
                                outputBuffer
                            )
                    };
                }
            );

        expect(
            result.outputPeak
        ).toBe(0);
    }
);