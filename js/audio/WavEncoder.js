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

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  writeInterleavedPcm16(view, 44, audioBuffer);

  return new Blob([buffer], {
    type: "audio/wav",
  });
}

function writeInterleavedPcm16(view, offset, audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;

  const channelData = [];

  for (let channel = 0; channel < numberOfChannels; channel++) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

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

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
