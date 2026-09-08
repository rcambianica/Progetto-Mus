import { state, setAudioContext, notifyStateChanged } from '../state.js';

export function getAudioContext() {
    if (!state.audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            throw new Error('Web Audio API is not supported by this browser.');
        }

        const audioContext = new AudioContextClass();

        setAudioContext(audioContext);

        audioContext.addEventListener('statechange', () => {
            notifyStateChanged();
        });
    }

    return state.audioContext;
}

export async function resumeAudioContext() {
    const audioContext = getAudioContext();

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    return audioContext;
}

export async function closeAudioContext() {
    if (!state.audioContext) {
        return;
    }

    await state.audioContext.close();

    setAudioContext(null);
}
