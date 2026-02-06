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

export interface VoiceTypingCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStateChange: (active: boolean) => void;
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
      activeInstance.disable();
    }

    // If this instance is already active, disable first
    if (this._isActive) {
      this.disable();
    }

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;

    this.callbacks = callbacks;
    this.disableRequested = false;
    this._isActive = true;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activeInstance = this;

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
        this.disable();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.callbacks?.onError?.(event.error);
      this.disable();
    };

    this.recognition = recognition;
    this.startInactivityTimer();

    try {
      recognition.start();
    } catch {
      this.callbacks?.onError?.("start-failed");
      this.disable();
    }
  }

  disable(): void {
    if (!this._isActive) return;

    this.disableRequested = true;
    this._isActive = false;

    // Stop recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore errors from stop()
      }
      this.recognition.onresult = null;
      this.recognition.onend = null;
      this.recognition.onerror = null;
      this.recognition = null;
    }

    // Clear inactivity timer
    this.clearInactivityTimer();

    // Fire onStateChange(false) BEFORE clearing callbacks,
    // so consumer can read and commit last interim transcript
    this.callbacks?.onStateChange(false);
    this.callbacks = null;

    // Clear module-level active instance
    if (activeInstance === this) {
      activeInstance = null;
    }
  }

  private startInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.disable();
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
