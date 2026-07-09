import { state, subscribe } from "./state.js";

import {
    getAudioContext,
    resumeAudioContext
} from "./audio/AudioContextManager.js";

document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
    bindAudioContextControls();

    subscribe(renderAudioContextStatus);

    renderAudioContextStatus(state);
}

function bindAudioContextControls() {
    const initButton =
        document.getElementById("initAudioContextBtn");

    initButton.addEventListener("click", async () => {
        try {
            getAudioContext();

            await resumeAudioContext();

            renderAudioContextStatus(state);
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    });
}

function renderAudioContextStatus(currentState) {
    const statusElement =
        document.getElementById("audioContextStatus");

    const sampleRateElement =
        document.getElementById("audioContextSampleRate");

    if (!currentState.audioContext) {
        statusElement.textContent = "not initialized";
        sampleRateElement.textContent = "-";
        return;
    }

    statusElement.textContent =
        currentState.audioContext.state;

    sampleRateElement.textContent =
        `${currentState.audioContext.sampleRate} Hz`;
}