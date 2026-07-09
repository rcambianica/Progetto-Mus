let audioContext = null;

export function getAudioContext() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }

    return audioContext;
}

export async function resumeAudioContext() {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
        await ctx.resume();
    }

    return ctx;
}