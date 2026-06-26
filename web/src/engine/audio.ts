// Tiny WAV synthesizer for voice-message demos. Apache-2.0
//
// Headless test environments have no microphone, so the voice-message flow synthesizes a short PCM
// tone and runs it through the SAME encrypted media path (encrypt → store → decrypt) a real
// recording would. In production this is replaced by MediaRecorder (Opus) over getUserMedia; the
// transport/storage path is identical.
export function makeWavTone(durationSec = 0.4, freq = 440, sampleRate = 8000): Uint8Array {
  const n = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2;
  const dataSize = n * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  // RIFF/WAVE header (PCM, mono, 16-bit).
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Samples (a gently-enveloped sine so it sounds like a blip, not a click).
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 200, (n - i) / 200);
    const s = Math.sin((2 * Math.PI * freq * i) / sampleRate) * env * 0.6;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true);
  }
  return new Uint8Array(buf);
}

/** Approx duration label for a WAV byte length (mono 16-bit @ 8kHz). */
export function wavDurationLabel(bytes: number, sampleRate = 8000): string {
  const secs = Math.max(0, (bytes - 44) / 2 / sampleRate);
  return `0:${Math.round(secs).toString().padStart(2, '0')}`;
}
