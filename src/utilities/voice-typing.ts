/**
 * Reusable voice typing module using the Web Speech API.
 * Framework-agnostic — no React or editor dependencies.
 */

// Web Speech API types (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export type VoiceTypingDisableReason = "user" | "timeout" | "error" | "evicted";

export interface VoiceTypingCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStateChange: (active: boolean, reason?: VoiceTypingDisableReason) => void;
  onError?: (error: string) => void;
}

const INACTIVITY_TIMEOUT_MS = 60_000;

// Module-level tracking for single-active-instance constraint
let activeInstance: VoiceTyping | null = null;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export class VoiceTyping {
  private recognition: SpeechRecognitionInstance | null = null;
  private callbacks: VoiceTypingCallbacks | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private disableRequested = false;
  private _isActive = false;

  static get supported(): boolean {
    return getSpeechRecognitionConstructor() !== null;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  enable(callbacks: VoiceTypingCallbacks): void {
    // Single-active-instance: disable any previously active instance
    if (activeInstance && activeInstance !== this) {
      activeInstance.disable("evicted");
    }

    // If this instance is already active, disable first
    if (this._isActive) {
      this.disable("user");
    }

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    this.callbacks = callbacks;
    this.disableRequested = false;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    // Do NOT set lang — let browser default apply

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.resetInactivityTimer();
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      this.callbacks?.onTranscript(transcript, isFinal);
    };

    recognition.onend = () => {
      if (this.disableRequested || !this._isActive) {
        // disable() was called — do not restart
        return;
      }
      // Auto-restart: recognition ended naturally (e.g., pause in speech)
      try {
        recognition.start();
      } catch {
        // start() can throw if called in wrong state; treat as error
        this.disable("error");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.callbacks?.onError?.(event.error);
      // "no-speech" and "aborted" are non-fatal — recognition will fire onend
      // and auto-restart. Only disable on truly fatal errors.
      const nonFatal = event.error === "no-speech" || event.error === "aborted";
      if (!nonFatal) {
        this.disable("error");
      }
    };

    this.recognition = recognition;

    try {
      recognition.start();
    } catch {
      this.callbacks?.onError?.("start-failed");
      this.recognition.onresult = null;
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition = null;
      this.callbacks = null;
      return;
    }

    // Only mark active after start() succeeds
    this._isActive = true;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activeInstance = this;
    this.startInactivityTimer();
  }

  disable(reason: VoiceTypingDisableReason = "user"): void {
    if (!this._isActive) return;

    this.disableRequested = true;
    this._isActive = false;

    // Stop recognition — use stop() (not abort()) so the browser can deliver
    // any pending final results via onresult before firing onend.
    // Capture onTranscript in a closure so results can be delivered even after
    // this.callbacks is cleared below.
    if (this.recognition) {
      const rec = this.recognition;
      const onTranscript = this.callbacks?.onTranscript;
      rec.onerror = null;
      rec.onresult = onTranscript ? (event: SpeechRecognitionEvent) => {
        const result = event.results[event.resultIndex];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        onTranscript(transcript, isFinal);
      } : null;
      rec.onend = () => {
        rec.onresult = null;
        rec.onend = null;
      };
      try {
        rec.stop();
      } catch {
        // If stop() throws, clean up immediately
        rec.onresult = null;
        rec.onend = null;
      }
      this.recognition = null;
    }

    // Clear inactivity timer
    this.clearInactivityTimer();

    // Fire onStateChange(false, reason) BEFORE clearing callbacks,
    // so consumer can read and commit last interim transcript
    this.callbacks?.onStateChange(false, reason);
    this.callbacks = null;

    // Clear module-level active instance
    if (activeInstance === this) {
      activeInstance = null;
    }
  }

  private startInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.disable("timeout");
    }, INACTIVITY_TIMEOUT_MS);
  }

  private resetInactivityTimer(): void {
    this.startInactivityTimer();
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer !== null) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}
