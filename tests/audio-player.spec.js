const {
    test,
    expect
} = require("@playwright/test");

test.beforeEach(async ({ page }) => {
    await page.goto("/tests/fixtures/blank.html");
});

test("AudioPlayer usa GainNode e AudioBufferSourceNode reali e ricrea la source dopo il seek", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            AudioPlayer
        } = await import("/js/audio/AudioPlayer.js");

        const context = new AudioContext();
        const player = new AudioPlayer(context);

        const buffer = context.createBuffer(
            1,
            context.sampleRate,
            context.sampleRate
        );

        player.setBuffer(buffer);
        player.play();

        const firstSource = player.source;

        const beforeSeek = {
            gainNodeIsReal:
                player.gainNode instanceof GainNode,
            sourceIsReal:
                firstSource instanceof AudioBufferSourceNode,
            sourceUsesBuffer:
                firstSource.buffer === buffer,
            isPlaying: player.isPlaying
        };

        player.seek(500);

        const secondSource = player.source;

        const afterSeek = {
            sourceWasRecreated:
                secondSource !== firstSource,
            sourceIsReal:
                secondSource instanceof AudioBufferSourceNode,
            sourceUsesBuffer:
                secondSource.buffer === buffer,
            offsetSeconds: player.pausedAt,
            isPlaying: player.isPlaying
        };

        player.pause();

        const afterPause = {
            sourceIsNull: player.source === null,
            isPlaying: player.isPlaying,
            pausedAt: player.pausedAt
        };

        player.stop();

        const afterStop = {
            sourceIsNull: player.source === null,
            isPlaying: player.isPlaying,
            pausedAt: player.pausedAt
        };

        await context.close();

        return {
            beforeSeek,
            afterSeek,
            afterPause,
            afterStop
        };
    });

    expect(result.beforeSeek.gainNodeIsReal).toBe(true);
    expect(result.beforeSeek.sourceIsReal).toBe(true);
    expect(result.beforeSeek.sourceUsesBuffer).toBe(true);
    expect(result.beforeSeek.isPlaying).toBe(true);

    expect(result.afterSeek.sourceWasRecreated).toBe(true);
    expect(result.afterSeek.sourceIsReal).toBe(true);
    expect(result.afterSeek.sourceUsesBuffer).toBe(true);
    expect(result.afterSeek.offsetSeconds).toBeCloseTo(0.5, 6);
    expect(result.afterSeek.isPlaying).toBe(true);

    expect(result.afterPause.sourceIsNull).toBe(true);
    expect(result.afterPause.isPlaying).toBe(false);
    expect(result.afterPause.pausedAt).toBeCloseTo(0.5, 2);

    expect(result.afterStop.sourceIsNull).toBe(true);
    expect(result.afterStop.isPlaying).toBe(false);
    expect(result.afterStop.pausedAt).toBe(0);
});

test("AudioPlayer non crea una nuova source quando il seek raggiunge la fine", async ({ page }) => {
    const result = await page.evaluate(async () => {
        const {
            AudioPlayer
        } = await import("/js/audio/AudioPlayer.js");

        const context = new AudioContext();
        const player = new AudioPlayer(context);

        const buffer = context.createBuffer(
            1,
            context.sampleRate,
            context.sampleRate
        );

        player.setBuffer(buffer);
        player.play();
        player.seek(1_000);

        const state = {
            sourceIsNull: player.source === null,
            isPlaying: player.isPlaying,
            pausedAt: player.pausedAt,
            currentTimeMs: player.getCurrentTimeMs(),
            durationMs: player.getDurationMs()
        };

        player.stop();
        await context.close();

        return state;
    });

    expect(result.sourceIsNull).toBe(true);
    expect(result.isPlaying).toBe(false);
    expect(result.pausedAt).toBeCloseTo(1, 6);
    expect(result.currentTimeMs).toBeCloseTo(1_000, 3);
    expect(result.durationMs).toBeCloseTo(1_000, 3);
});
