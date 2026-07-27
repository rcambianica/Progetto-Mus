import {
    setProcessedBuffer,
    setProcessedInfo,
    state
} from "../state.js";

import {
    resumeAudioContext
} from "../audio/AudioContextManager.js";

import {
    renderProcessedAudio
} from "../audio/OfflineRenderer.js";

import {
    analyzeAudioBuffer
} from "../analysis/AudioInfo.js";

import {
    clearProcessedWaveSurfer,
    renderProcessedWaveformWithWaveSurfer
} from "../ui/WaveSurferView.js";

import {
    ProcessingControlsView
} from "../ui/ProcessingControlsView.js";

const EMPTY_AUDIO_INFO = {
    durationMs: 0,
    sampleRate: 0,
    numberOfChannels: 0,
    peakLinear: 0,
    peakDb: -Infinity
};

export class ProcessingController {
    constructor({
        playbackController,
        exportController
    }) {
        this.playbackController =
            playbackController;

        this.exportController =
            exportController;

        this.status = "not processed";

        /*
         * Impedisce render concorrenti e permette
         * di riconoscere un risultato diventato
         * obsoleto durante il processing.
         */
        this.isProcessing = false;
        this.settingsRevision = 0;
        this.renderJobId = 0;
        this.applyButton = null;

        this.controlsView =
            new ProcessingControlsView({
                onSettingsChanged:
                    () => {
                        this.markSettingsChanged();
                    }
            });
    }

    bind() {
        this.controlsView.bind();

        this.applyButton =
            document.getElementById(
                "applyProcessingBtn"
            );

        this.applyButton.addEventListener(
            "click",
            () => {
                this.applyProcessing();
            }
        );

        this.renderApplyButtonState();
    }

    render() {
        this.controlsView.render();
        this.renderStatus();
    }

    resetProcessedAudio() {
        /*
         * Invalida anche un eventuale rendering
         * ancora in corso sulla sorgente precedente.
         */
        this.renderJobId += 1;

        this.playbackController.resetTrack(
            "processed"
        );

        setProcessedBuffer(null);
        setProcessedInfo(EMPTY_AUDIO_INFO);

        clearProcessedWaveSurfer();

        this.setStatus("not processed");

        this.exportController.reset();
    }

    markSettingsChanged() {
        this.settingsRevision += 1;

        if (this.isProcessing) {
            const status =
                "processing — settings changed";

            this.setStatus(status);
            this.exportController.invalidate(
                "settings changed — apply processing again"
            );
            return;
        }

        if (state.processedBuffer) {
            const status =
                "settings changed — apply processing again";

            this.setStatus(status);
            this.exportController.invalidate(status);
            return;
        }

        this.setStatus("not processed");
        this.exportController.reset();
    }

    async applyProcessing() {
        if (this.isProcessing) {
            return;
        }

        const originalBuffer =
            state.originalBuffer;

        if (!originalBuffer) {
            alert("No original audio loaded.");
            return;
        }

        /*
         * Il renderer riceve una copia profonda e
         * congelata. Le modifiche successive della UI
         * non possono quindi alterare il job in corso.
         */
        const settingsSnapshot =
            createProcessingSettingsSnapshot(
                state.processingSettings
            );

        const startingSettingsRevision =
            this.settingsRevision;

        const jobId =
            ++this.renderJobId;

        this.isProcessing = true;
        this.renderApplyButtonState();

        try {
            await resumeAudioContext();

            this.setStatus("processing");
            this.exportController.invalidate(
                "processing audio"
            );

            this.playbackController.resetTrack(
                "processed"
            );

            const processedBuffer =
                await renderProcessedAudio(
                    originalBuffer,
                    settingsSnapshot
                );

            /*
             * Se nel frattempo è stata caricata una
             * nuova sorgente o il job è stato invalidato,
             * il risultato non deve sostituire quello
             * associato allo stato corrente.
             */
            if (
                jobId !== this.renderJobId ||
                state.originalBuffer !== originalBuffer
            ) {
                return;
            }

            const processedInfo =
                analyzeAudioBuffer(
                    processedBuffer
                );

            setProcessedBuffer(
                processedBuffer
            );

            setProcessedInfo(
                processedInfo
            );

            this.playbackController.setupTrack(
                "processed",
                state.audioContext,
                processedBuffer
            );

            await renderProcessedWaveformWithWaveSurfer(
                processedBuffer
            );

            if (
                jobId !== this.renderJobId ||
                state.originalBuffer !== originalBuffer
            ) {
                return;
            }

            const settingsAreCurrent =
                this.settingsRevision ===
                startingSettingsRevision;

            if (settingsAreCurrent) {
                this.setStatus("processed");
                this.exportController.markReady();
            } else {
                const status =
                    "settings changed — apply processing again";

                this.setStatus(status);
                this.exportController.invalidate(status);
            }
        } catch (error) {
            if (
                jobId !== this.renderJobId ||
                state.originalBuffer !== originalBuffer
            ) {
                return;
            }

            console.error(error);
            alert(error.message);
            this.setStatus("error");
            this.exportController.invalidate(
                "export unavailable"
            );
        } finally {
            /*
             * Non può esistere un secondo job concorrente:
             * il flag viene quindi sempre rilasciato quando
             * il rendering corrente termina o viene scartato.
             */
            this.isProcessing = false;
            this.renderApplyButtonState();
        }
    }

    renderApplyButtonState() {
        if (!this.applyButton) {
            return;
        }

        this.applyButton.disabled =
            this.isProcessing;
    }

    setStatus(status) {
        this.status = status;
        this.renderStatus();
    }

    renderStatus() {
        const statusElement =
            document.getElementById(
                "processingStatus"
            );

        statusElement.textContent =
            this.status;
    }
}
function createProcessingSettingsSnapshot(settings) {
    const snapshot =
        typeof structuredClone === "function"
            ? structuredClone(settings)
            : JSON.parse(JSON.stringify(settings));

    return deepFreeze(snapshot);
}

function deepFreeze(value) {
    if (
        value === null ||
        typeof value !== "object" ||
        Object.isFrozen(value)
    ) {
        return value;
    }

    Object.freeze(value);

    for (const nestedValue of Object.values(value)) {
        deepFreeze(nestedValue);
    }

    return value;
}
