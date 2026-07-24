import {
    state
} from "../state.js";

import {
    encodeWav
} from "../audio/WavEncoder.js";

export class ExportController {
    constructor() {
        this.status =
            "no processed audio";
    }

    bind() {
        const downloadButton =
            document.getElementById(
                "downloadWavBtn"
            );

        const fileNameInput =
            document.getElementById(
                "exportFileName"
            );

        fileNameInput.addEventListener(
            "input",
            () => {
                fileNameInput.dataset
                    .userEdited = "true";
            }
        );

        downloadButton.addEventListener(
            "click",
            () => {
                try {
                    this.downloadProcessedAudio();
                } catch (error) {
                    console.error(error);
                    alert(error.message);
                    this.setStatus(
                        "export error"
                    );
                }
            }
        );
    }

    render() {
        const downloadButton =
            document.getElementById(
                "downloadWavBtn"
            );

        const fileNameInput =
            document.getElementById(
                "exportFileName"
            );

        const hasProcessedAudio =
            Boolean(state.processedBuffer);

        downloadButton.disabled =
            !hasProcessedAudio;

        fileNameInput.disabled =
            !hasProcessedAudio;

        if (
            hasProcessedAudio &&
            !fileNameInput.dataset.userEdited
        ) {
            fileNameInput.value =
                this.getDefaultFileName();
        }

        this.renderStatus();
    }

    setStatus(status) {
        this.status = status;
        this.renderStatus();
    }

    downloadProcessedAudio() {
        if (!state.processedBuffer) {
            throw new Error(
                "No processed audio available. Apply processing first."
            );
        }

        this.setStatus("encoding WAV");

        const wavBlob =
            encodeWav(
                state.processedBuffer
            );

        const objectUrl =
            URL.createObjectURL(wavBlob);

        const downloadLink =
            document.createElement("a");

        downloadLink.href = objectUrl;
        downloadLink.download =
            this.buildFileName();

        document.body.appendChild(
            downloadLink
        );

        downloadLink.click();
        downloadLink.remove();

        window.setTimeout(
            () => {
                URL.revokeObjectURL(
                    objectUrl
                );
            },
            1000
        );

        this.setStatus(
            "download started"
        );
    }

    buildFileName() {
        const fileNameInput =
            document.getElementById(
                "exportFileName"
            );

        const requestedName =
            fileNameInput.value.trim();

        const sanitizedName =
            sanitizeFileName(
                requestedName ||
                this.getDefaultFileName()
            );

        if (
            sanitizedName
                .toLowerCase()
                .endsWith(".wav")
        ) {
            return sanitizedName;
        }

        return `${sanitizedName}.wav`;
    }

    getDefaultFileName() {
        const originalName =
            state.originalFile?.name;

        if (!originalName) {
            return "processed-audio";
        }

        const lastDotIndex =
            originalName.lastIndexOf(".");

        const baseName =
            lastDotIndex > 0
                ? originalName.slice(
                    0,
                    lastDotIndex
                )
                : originalName;

        return `${baseName}-processed`;
    }

    renderStatus() {
        const statusElement =
            document.getElementById(
                "exportStatus"
            );

        statusElement.textContent =
            this.status;
    }
}

function sanitizeFileName(fileName) {
    const sanitized =
        fileName
            .replace(
                /[<>:"/\\|?*\u0000-\u001F]/g,
                "-"
            )
            .replace(/\s+/g, " ")
            .trim()
            .replace(/[. ]+$/g, "");

    return sanitized ||
        "processed-audio";
}