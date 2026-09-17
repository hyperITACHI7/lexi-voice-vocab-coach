/**
 * Fallback speech-to-text using the browser's Web Speech API (Chrome, Edge, Safari).
 * Used when Groq Whisper isn't available for the API key. Voice detection still
 * decides turn timing; this only supplies the words.
 */

type RecognitionResultEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserSttSupported(): boolean {
  return getCtor() !== null;
}

const FINALIZE_TIMEOUT_MS = 1800;

export class BrowserStt {
  onError?: (message: string) => void;

  private recognition: Recognition | null = null;
  private wanted = false;
  private finals = ""; // finalized text not yet handed out
  private interim = "";
  private alreadyTaken = ""; // interim text handed out before the browser finalized it
  private waiters: (() => void)[] = [];

  start() {
    this.wanted = true;
    if (this.recognition) return;
    const Ctor = getCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) this.finals = `${this.finals} ${this.withoutTaken(text)}`.trim();
        else interim += text;
      }
      this.interim = interim.trim();
      this.notify();
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.wanted = false;
        this.onError?.("Browser speech recognition was blocked. Please type your answers instead.");
      }
    };
    r.onend = () => {
      // Chrome ends continuous recognition after silence; keep it alive while wanted.
      this.recognition = null;
      if (this.wanted) this.start();
    };
    this.recognition = r;
    try {
      r.start();
    } catch {
      this.recognition = null;
    }
  }

  stop() {
    this.wanted = false;
    this.recognition?.abort();
    this.recognition = null;
    this.finals = "";
    this.interim = "";
    this.notify();
  }

  /**
   * Resolves with the words spoken since the last call, waiting briefly for the
   * browser to finalize a phrase that is still in progress.
   */
  async take(): Promise<string> {
    const deadline = Date.now() + FINALIZE_TIMEOUT_MS;
    while (this.interim && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, Math.max(0, deadline - Date.now()));
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    const text = [this.finals, this.interim].filter(Boolean).join(" ");
    this.alreadyTaken = this.interim;
    this.finals = "";
    this.interim = "";
    return text;
  }

  private withoutTaken(text: string): string {
    const taken = this.alreadyTaken;
    this.alreadyTaken = "";
    if (taken && text.trim().toLowerCase().startsWith(taken.toLowerCase())) {
      return text.trim().slice(taken.length);
    }
    return text;
  }

  private notify() {
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((w) => w());
  }
}
