"use client";

/** Records microphone audio and returns a 16 kHz mono WAV as base64. */
export class Recorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private analyser: AnalyserNode | null = null;
  private ctx: AudioContext | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100);
  }

  /** 0..1 loudness for a meter. */
  level(): number {
    if (!this.analyser) return 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) {
      const x = (v - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 4);
  }

  async stop(): Promise<{ wavBase64: string; durationSec: number }> {
    const rec = this.recorder;
    if (!rec) throw new Error("not recording");
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType }));
      rec.stop();
    });
    this.stream?.getTracks().forEach((t) => t.stop());
    const ctx = this.ctx ?? new AudioContext();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    await ctx.close();
    this.ctx = null;
    this.recorder = null;
    this.stream = null;
    const wav = encodeWav(downmixAndResample(decoded, 16000), 16000);
    return { wavBase64: bufToBase64(wav), durationSec: decoded.duration };
  }

  cancel() {
    try {
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.recorder = null;
    this.stream = null;
  }
}

function downmixAndResample(buffer: AudioBuffer, targetRate: number): Float32Array {
  const channels = buffer.numberOfChannels;
  const len = buffer.length;
  const mono = new Float32Array(len);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
  }
  if (buffer.sampleRate === targetRate) return mono;
  const ratio = buffer.sampleRate / targetRate;
  const outLen = Math.floor(len / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(len, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += mono[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Play an MP3 returned by the TTS endpoint. Returns when playback ends. */
export async function playTts(text: string, lang: string): Promise<void> {
  const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) });
  if (!res.ok) throw new Error("tts failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    const a = new Audio(url);
    a.onended = () => resolve();
    a.onerror = () => reject(new Error("playback failed"));
    a.play().catch(reject);
  });
  URL.revokeObjectURL(url);
}
