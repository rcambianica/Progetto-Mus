const {
    test,
    expect
} = require("@playwright/test");

function createTestWav({
    durationSeconds = 0.2,
    sampleRate = 48_000,
    frequencyHz = 440,
    amplitude = 0.5
} = {}) {
    const numberOfChannels = 1;
    const bitsPerSample = 16;

    const sampleCount =
        Math.round(
            durationSeconds *
            sampleRate
        );

    const bytesPerSample =
        bitsPerSample / 8;

    const dataSize =
        sampleCount *
        numberOfChannels *
        bytesPerSample;

    const buffer =
        Buffer.alloc(
            44 + dataSize
        );

    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(
        36 + dataSize,
        4
    );

    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);

    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(
        numberOfChannels,
        22
    );

    buffer.writeUInt32LE(
        sampleRate,
        24
    );

    buffer.writeUInt32LE(
        sampleRate *
            numberOfChannels *
            bytesPerSample,
        28
    );

    buffer.writeUInt16LE(
        numberOfChannels *
            bytesPerSample,
        32
    );

    buffer.writeUInt16LE(
        bitsPerSample,
        34
    );

    buffer.write("data", 36);

    buffer.writeUInt32LE(
        dataSize,
        40
    );

    for (
        let sampleIndex = 0;
        sampleIndex < sampleCount;
        sampleIndex++
    ) {
        const timeSeconds =
            sampleIndex /
            sampleRate;

        const sample =
            amplitude *
            Math.sin(
                2 *
                Math.PI *
                frequencyHz *
                timeSeconds
            );

        const pcmSample =
            Math.round(
                Math.max(
                    -1,
                    Math.min(1, sample)
                ) *
                32_767
            );

        buffer.writeInt16LE(
            pcmSample,
            44 +
                sampleIndex *
                bytesPerSample
        );
    }

    return buffer;
}

async function loadTestAudio(
    page,
    {
        durationSeconds = 0.2,
        sampleRate = 48_000
    } = {}
) {
    const wavBuffer =
        createTestWav({
            durationSeconds,
            sampleRate
        });

    await page
        .locator("#audioFileInput")
        .setInputFiles({
            name:
                "test-tone.wav",

            mimeType:
                "audio/wav",

            buffer:
                wavBuffer
        });

    await expect(
        page.locator(
            "#originalFileName"
        )
    ).toHaveText(
        "test-tone.wav"
    );

    await expect(
        page.locator(
            "#originalPlayPauseBtn"
        )
    ).toBeEnabled();

    await expect(
        page.locator(
            "#originalWaveform"
        )
    ).toHaveClass(
        /waveform--enabled/
    );
}

test.beforeEach(
    async ({ page }) => {
        await page.goto(
            "/index.html"
        );

        await expect(
            page.getByRole(
                "heading",
                {
                    name:
                        "Audio Processing and Mastering"
                }
            )
        ).toBeVisible();
    }
);

test(
    "lo stato iniziale dell'applicazione è corretto",
    async ({ page }) => {
        await expect(
            page.locator(
                "#originalPlayPauseBtn"
            )
        ).toBeDisabled();

        await expect(
            page.locator(
                "#originalStopBtn"
            )
        ).toBeDisabled();

        await expect(
            page.locator(
                "#processedPlayPauseBtn"
            )
        ).toBeDisabled();

        await expect(
            page.locator(
                "#downloadWavBtn"
            )
        ).toBeDisabled();

        await expect(
            page.locator(
                "#processingStatus"
            )
        ).toHaveText(
            "not processed"
        );

        await expect(
            page.locator(
                "#originalWaveform"
            )
        ).toHaveClass(
            /waveform--disabled/
        );

        await expect(
            page.locator(
                "#processedWaveform"
            )
        ).toHaveClass(
            /waveform--disabled/
        );
    }
);

test(
    "il caricamento di un WAV aggiorna waveform, metriche e playback",
    async ({ page }) => {
        await loadTestAudio(
            page,
            {
                durationSeconds: 0.2,
                sampleRate: 48_000
            }
        );

        await expect(
            page.locator(
                "#originalSampleRate"
            )
        ).toHaveText(
            "48000 Hz"
        );

        await expect(
            page.locator(
                "#originalChannels"
            )
        ).toHaveText(
            "1"
        );

        await expect(
            page.locator(
                "#originalDuration"
            )
        ).toHaveText(
            "0:00.200"
        );

        await expect(
            page.locator(
                "#originalPeak"
            )
        ).not.toHaveText("-");

        await expect(
            page.locator(
                "#originalPeakDb"
            )
        ).toContainText(
            "dBFS"
        );

        await expect(
            page.locator(
                "#originalStopBtn"
            )
        ).toBeEnabled();
    }
);

test(
    "Apply Processing produce il buffer processato e abilita l'esportazione",
    async ({ page }) => {
        await loadTestAudio(page);

        await page
            .locator(
                "#applyProcessingBtn"
            )
            .click();

        await expect(
            page.locator(
                "#processingStatus"
            )
        ).toHaveText(
            "processed",
            {
                timeout: 10_000
            }
        );

        await expect(
            page.locator(
                "#processedPlayPauseBtn"
            )
        ).toBeEnabled();

        await expect(
            page.locator(
                "#processedStopBtn"
            )
        ).toBeEnabled();

        await expect(
            page.locator(
                "#processedWaveform"
            )
        ).toHaveClass(
            /waveform--enabled/
        );

        await expect(
            page.locator(
                "#processedSampleRate"
            )
        ).toHaveText(
            "48000 Hz"
        );

        await expect(
            page.locator(
                "#processedChannels"
            )
        ).toHaveText(
            "1"
        );

        await expect(
            page.locator(
                "#downloadWavBtn"
            )
        ).toBeEnabled();

        await expect(
            page.locator(
                "#exportStatus"
            )
        ).toHaveText(
            "ready for download"
        );
    }
);

test(
    "una modifica ai parametri invalida il risultato processato",
    async ({ page }) => {
        await loadTestAudio(page);

        await page
            .locator(
                "#applyProcessingBtn"
            )
            .click();

        await expect(
            page.locator(
                "#processingStatus"
            )
        ).toHaveText(
            "processed"
        );

        await page
            .locator(
                "#gainSlider"
            )
            .fill("2");

        await expect(
            page.locator(
                "#gainValue"
            )
        ).toHaveText(
            "2.00"
        );

        await expect(
            page.locator(
                "#processingStatus"
            )
        ).toHaveText(
            "settings changed — apply processing again"
        );

        await expect(
            page.locator(
                "#downloadWavBtn"
            )
        ).toBeDisabled();

        await expect(
            page.locator(
                "#exportStatus"
            )
        ).toHaveText(
            "settings changed — apply processing again"
        );
    }
);

test(
    "il Delay abilitato estende la durata del buffer processato",
    async ({ page }) => {
        await loadTestAudio(
            page,
            {
                durationSeconds: 0.1
            }
        );

        await page
            .locator(
                "#delayEnabled"
            )
            .check({
                force: true
            });

        await expect(
            page.locator(
                "#delayTime"
            )
        ).toBeEnabled();

        await page
            .locator(
                "#delayTime"
            )
            .fill("0.1");

        await page
            .locator(
                "#delayFeedback"
            )
            .fill("0");

        await page
            .locator(
                "#delayMix"
            )
            .fill("0.5");

        await page
            .locator(
                "#applyProcessingBtn"
            )
            .click();

        await expect(
            page.locator(
                "#processingStatus"
            )
        ).toHaveText(
            "processed",
            {
                timeout: 10_000
            }
        );

        await expect(
            page.locator(
                "#originalDuration"
            )
        ).toHaveText(
            "0:00.100"
        );

        await expect(
            page.locator(
                "#processedDuration"
            )
        ).toHaveText(
            "0:00.200"
        );
    }
);

test(
    "i pulsanti Play e Pause controllano il player originale",
    async ({ page }) => {
        await loadTestAudio(
            page,
            {
                durationSeconds: 1
            }
        );

        const playPauseButton =
            page.locator(
                "#originalPlayPauseBtn"
            );

        await playPauseButton.click();

        await expect(
            playPauseButton
        ).toHaveText(
            "Pause"
        );

        await page.waitForTimeout(100);

        await expect(
            page.locator(
                "#originalCurrentTime"
            )
        ).not.toHaveText(
            "0:00.000"
        );

        await playPauseButton.click();

        await expect(
            playPauseButton
        ).toHaveText(
            "Play"
        );
    }
);

test(
    "il WAV processato viene esportato con il nome atteso",
    async ({ page }) => {
        await loadTestAudio(page);

        await page
            .locator(
                "#applyProcessingBtn"
            )
            .click();

        await expect(
            page.locator(
                "#downloadWavBtn"
            )
        ).toBeEnabled();

        const downloadPromise =
            page.waitForEvent(
                "download"
            );

        await page
            .locator(
                "#downloadWavBtn"
            )
            .click();

        const download =
            await downloadPromise;

        expect(
            download.suggestedFilename()
        ).toBe(
            "test-tone-processed.wav"
        );

        await expect(
            page.locator(
                "#exportStatus"
            )
        ).toHaveText(
            "download started"
        );
    }
);