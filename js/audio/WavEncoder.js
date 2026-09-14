/** Per evitare l'utilizzo di librerie esterne o API come audiobuffer-to-wav o MediaRecorder
 *  ho provato a fare un export artigianale prendendo spunto da risorse esterne
 */

// Legge le caratterisriche dell'audio e calcola lo spazio necessario in bytes
export function encodeWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // Creazione dell'header WAV
    // Blocco RIFF
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    //Blocco fmt (formato audio)
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    // significa che il PCM non è compresso
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    // Risoluzione in bit
    view.setUint16(34, 16, true);

    // Inizio dei dati dopo l'header WAV, con la dimensione (dataSize) degli stessi
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    writeInterleavedPcm16(view, 44, audioBuffer);

    return new Blob([buffer], {
        type: 'audio/wav',
    });
}

// Scrittura del file WAV (interleaving per gli audio stereo)
function writeInterleavedPcm16(view, offset, audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    // Recupero dati dai canali dell'audio
    const channelData = [];

    for (let channel = 0; channel < numberOfChannels; channel++) {
        channelData.push(audioBuffer.getChannelData(channel));
    }

    // Conversione del segnale da decimale a intero a 16 bit
    let currentOffset = offset;

    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = clampSample(channelData[channel][i]);

            const pcmValue = sample < 0 ? sample * 0x8000 : sample * 0x7fff;

            view.setInt16(currentOffset, pcmValue, true);

            currentOffset += 2;
        }
    }
}

function clampSample(sample) {
    return Math.max(-1, Math.min(1, sample));
}

// Funzione di appoggio alla creazione dell'header WAV
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
