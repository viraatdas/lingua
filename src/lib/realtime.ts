"use client";

export type TranscriptRole = "tutor" | "you";

export interface TranscriptLine {
  id: string;
  role: TranscriptRole;
  text: string;
  final: boolean;
}

export type RealtimeStatus = "idle" | "connecting" | "live" | "ended" | "error";

export interface RealtimeHandlers {
  onStatus: (s: RealtimeStatus, detail?: string) => void;
  onTranscript: (lines: TranscriptLine[]) => void;
  onSpeaking: (who: TranscriptRole | null) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown> | unknown;
}

interface SessionRequest {
  lang: string;
  level: string;
  scenarioId: string;
  news?: unknown;
  deckSample?: string[];
}

/**
 * Thin WebRTC client for the OpenAI Realtime API.
 * The server mints an ephemeral key with the scenario instructions baked in;
 * the browser only ever sees that short-lived key.
 */
export class RealtimeSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audioEl: HTMLAudioElement;
  private lines: TranscriptLine[] = [];
  private startedAt = 0;
  private handlers: RealtimeHandlers;
  private muted = false;

  constructor(handlers: RealtimeHandlers) {
    this.handlers = handlers;
    this.audioEl = document.createElement("audio");
    this.audioEl.autoplay = true;
  }

  get transcript() {
    return this.lines;
  }

  get elapsedSec() {
    return this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
  }

  async connect(req: SessionRequest) {
    this.handlers.onStatus("connecting");
    const tokenRes = await fetch("/api/realtime/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      this.handlers.onStatus("error", t || "Could not start a session");
      throw new Error(t);
    }
    const { clientSecret, model } = (await tokenRes.json()) as { clientSecret: string; model: string };

    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const pc = new RTCPeerConnection();
    this.pc = pc;
    pc.ontrack = (e) => {
      this.audioEl.srcObject = e.streams[0];
    };
    for (const track of this.mic.getTracks()) pc.addTrack(track, this.mic);

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onmessage = (e) => this.handleEvent(JSON.parse(e.data));
    dc.onopen = () => {
      this.startedAt = Date.now();
      this.handlers.onStatus("live");
      // Ask the tutor to open the conversation.
      this.send({ type: "response.create" });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.handlers.onStatus("error", "Connection dropped");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
      method: "POST",
      body: offer.sdp,
      headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
    });
    if (!sdpRes.ok) {
      const t = await sdpRes.text();
      this.handlers.onStatus("error", t || "Realtime handshake failed");
      throw new Error(t);
    }
    await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });
  }

  send(event: Record<string, unknown>) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(event));
  }

  /** Type a message instead of speaking it (useful for "how do I say..."). */
  sendText(text: string) {
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    this.send({ type: "response.create" });
  }

  /** Out-of-band nudge to the tutor that doesn't show up as a user line. */
  nudge(instructions: string) {
    this.send({ type: "response.create", response: { instructions } });
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !m));
  }

  get isMuted() {
    return this.muted;
  }

  close() {
    this.dc?.close();
    this.pc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.audioEl.srcObject = null;
    this.dc = null;
    this.pc = null;
    this.mic = null;
    this.handlers.onStatus("ended");
  }

  private upsert(id: string, role: TranscriptRole, text: string, final: boolean, append = false) {
    const idx = this.lines.findIndex((l) => l.id === id);
    if (idx === -1) this.lines = [...this.lines, { id, role, text, final }];
    else {
      const prev = this.lines[idx];
      const next = { ...prev, text: append ? prev.text + text : text, final };
      this.lines = [...this.lines.slice(0, idx), next, ...this.lines.slice(idx + 1)];
    }
    this.handlers.onTranscript(this.lines);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleEvent(ev: any) {
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        this.handlers.onSpeaking("you");
        break;
      case "input_audio_buffer.speech_stopped":
        this.handlers.onSpeaking(null);
        break;
      case "conversation.item.input_audio_transcription.delta":
        this.upsert(`u-${ev.item_id}`, "you", ev.delta ?? "", false, true);
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.upsert(`u-${ev.item_id}`, "you", ev.transcript ?? "", true);
        break;
      case "response.output_audio_transcript.delta":
        this.handlers.onSpeaking("tutor");
        this.upsert(`a-${ev.item_id}`, "tutor", ev.delta ?? "", false, true);
        break;
      case "response.output_audio_transcript.done":
        this.upsert(`a-${ev.item_id}`, "tutor", ev.transcript ?? "", true);
        break;
      case "output_audio_buffer.stopped":
      case "response.done":
        this.handlers.onSpeaking(null);
        break;
      case "response.function_call_arguments.done": {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(ev.arguments ?? "{}");
        } catch {
          /* ignore malformed args */
        }
        const result = (await this.handlers.onToolCall?.(ev.name, args)) ?? { ok: true };
        this.send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: ev.call_id, output: JSON.stringify(result) },
        });
        this.send({ type: "response.create" });
        break;
      }
      case "error":
        console.error("realtime error", ev.error);
        break;
      default:
        break;
    }
  }
}
