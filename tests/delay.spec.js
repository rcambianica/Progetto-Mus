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
    "DelayProcessor genera echi con decadimento geometrico",
    async ({ page }) => {
        const result =
            await page.evaluate(
                async () => {
                    const {
                        createImpulseBuffer,
                        renderEffect,
                        getSampleAtTime,
                        getPeakInWindow,
                        hasOnlyFiniteSamples
                    } =
                        await import(
                            "/tests/helpers/audio-buffer-factory.js"
                        );

                    const {
                        createDelayEffect
                    } =
                        await import(
                            "/js/processing/DelayProcessor.js"
                        );

                    const inputBuffer =
                        createImpulseBuffer({
                            durationSeconds: 0.01,
                            amplitude: 1,
                            sampleRate: 48_000
                        });

                    const outputBuffer =
                        await renderEffect(
                            inputBuffer,

                            audioContext =>
                                createDelayEffect(
                                    audioContext,
                                    {
                                        time: 0.1,
                                        feedback: 0.5,
                                        mix: 0.4
                                    }
                                ),

                            0.35
                        );

                    return {
                        dry:
                            getSampleAtTime(
                                outputBuffer,
                                0
                            ),

                        firstEcho:
                            getPeakInWindow(
                                outputBuffer,
                                0.1,
                                0.01
                            ),

                        secondEcho:
                            getPeakInWindow(
                                outputBuffer,
                                0.2,
                                0.01
                            ),

                        thirdEcho:
                            getPeakInWindow(
                                outputBuffer,
                                0.3,
                                0.01
                            ),

                        finite:
                            hasOnlyFiniteSamples(
                                outputBuffer
                            )
                    };
                }
            );

        console.log({
            dry:
                result.dry,

            firstEcho:
                result.firstEcho,

            secondEcho:
                result.secondEcho,

            thirdEcho:
                result.thirdEcho
        });

        expect(
            result.finite
        ).toBe(true);

        expect(
            result.dry
        ).toBeCloseTo(
            0.6,
            3
        );

        expect(
            result.firstEcho.amplitude
        ).toBeCloseTo(
            0.4,
            2
        );

        expect(
            result.secondEcho.amplitude
        ).toBeCloseTo(
            0.2,
            2
        );

        expect(
            result.thirdEcho.amplitude
        ).toBeCloseTo(
            0.1,
            2
        );

        expect(
            result.firstEcho.timeSeconds
        ).toBeGreaterThanOrEqual(
            0.09
        );

        expect(
            result.firstEcho.timeSeconds
        ).toBeLessThanOrEqual(
            0.11
        );

        expect(
            result.secondEcho.timeSeconds
        ).toBeGreaterThanOrEqual(
            0.19
        );

        expect(
            result.secondEcho.timeSeconds
        ).toBeLessThanOrEqual(
            0.21
        );

        expect(
            result.thirdEcho.timeSeconds
        ).toBeGreaterThanOrEqual(
            0.29
        );

        expect(
            result.thirdEcho.timeSeconds
        ).toBeLessThanOrEqual(
            0.31
        );
    }
);
test(
    "DelayProcessor con mix zero restituisce soltanto il segnale dry",
    async ({ page }) => {
        const result =
            await page.evaluate(
                async () => {
                    const {
                        createImpulseBuffer,
                        renderEffect,
                        getMaximumDifference
                    } =
                        await import(
                            "/tests/helpers/audio-buffer-factory.js"
                        );

                    const {
                        createDelayEffect
                    } =
                        await import(
                            "/js/processing/DelayProcessor.js"
                        );

                    const inputBuffer =
                        createImpulseBuffer({
                            durationSeconds: 0.2,
                            amplitude: 1,
                            sampleRate: 48_000
                        });

                    const outputBuffer =
                        await renderEffect(
                            inputBuffer,

                            audioContext =>
                                createDelayEffect(
                                    audioContext,
                                    {
                                        time: 0.1,
                                        feedback: 0.5,
                                        mix: 0
                                    }
                                )
                        );

                    return {
                        maximumDifference:
                            getMaximumDifference(
                                inputBuffer,
                                outputBuffer
                            )
                    };
                }
            );

        expect(
            result.maximumDifference
        ).toBeLessThan(1e-5);
    }
);

test(
    "calculateDelayTailSeconds restituisce la durata prevista",
    async ({ page }) => {
        const result =
            await page.evaluate(
                async () => {
                    const {
                        calculateDelayTailSeconds
                    } =
                        await import(
                            "/js/processing/DelayProcessor.js"
                        );

                    return {
                        noWetSignal:
                            calculateDelayTailSeconds({
                                time: 0.25,
                                feedback: 0.5,
                                mix: 0
                            }),

                        noFeedback:
                            calculateDelayTailSeconds({
                                time: 0.25,
                                feedback: 0,
                                mix: 0.5
                            }),

                        feedbackHalf:
                            calculateDelayTailSeconds({
                                time: 0.1,
                                feedback: 0.5,
                                mix: 0.5
                            }),

                        maximumTail:
                            calculateDelayTailSeconds({
                                time: 2,
                                feedback: 0.9,
                                mix: 1
                            })
                    };
                }
            );

        expect(
            result.noWetSignal
        ).toBe(0);

        expect(
            result.noFeedback
        ).toBe(0.25);

        expect(
            result.feedbackHalf
        ).toBeGreaterThan(0);

        expect(
            result.maximumTail
        ).toBeLessThanOrEqual(15);
    }
);