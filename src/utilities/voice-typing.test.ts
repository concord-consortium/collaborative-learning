import { VoiceTyping, VoiceTypingCallbacks } from "./voice-typing";

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  started = false;
  stopped = false;

  start() {
    this.started = true;
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
    this.started = false;
  }

  abort() {
    this.stopped = true;
    this.started = false;
  }

  // Test helpers
  simulateResult(transcript: string, isFinal: boolean, resultIndex = 0) {
    const event = {
      resultIndex,
      results: {
        [resultIndex]: {
          0: { transcript },
          isFinal,
          length: 1
        },
        length: resultIndex + 1
      }
    };
    this.onresult?.(event);
  }

  simulateEnd() {
    this.onend?.();
  }

  simulateError(error: string) {
    this.onerror?.({ error });
  }
}

let mockInstance: MockSpeechRecognition | null = null;

function installMockSpeechRecognition() {
  mockInstance = null;
  (window as any).SpeechRecognition = undefined;
  (window as any).webkitSpeechRecognition = class extends MockSpeechRecognition {
    constructor() {
      super();
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      mockInstance = this;
    }
  };
}

function removeMockSpeechRecognition() {
  (window as any).SpeechRecognition = undefined;
  (window as any).webkitSpeechRecognition = undefined;
  mockInstance = null;
}

function createCallbacks(): VoiceTypingCallbacks & {
  transcripts: Array<{ text: string; isFinal: boolean }>;
  stateChanges: boolean[];
  errors: string[];
} {
  const transcripts: Array<{ text: string; isFinal: boolean }> = [];
  const stateChanges: boolean[] = [];
  const errors: string[] = [];
  return {
    transcripts,
    stateChanges,
    errors,
    onTranscript: (text, isFinal) => transcripts.push({ text, isFinal }),
    onStateChange: (active) => stateChanges.push(active),
    onError: (error) => errors.push(error)
  };
}

describe("VoiceTyping", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    installMockSpeechRecognition();
  });

  afterEach(() => {
    removeMockSpeechRecognition();
    jest.useRealTimers();
  });

  describe("supported", () => {
    it("returns true when SpeechRecognition is available", () => {
      expect(VoiceTyping.supported).toBe(true);
    });

    it("returns false when SpeechRecognition is not available", () => {
      removeMockSpeechRecognition();
      expect(VoiceTyping.supported).toBe(false);
    });
  });

  describe("enable/disable", () => {
    it("starts recognition on enable()", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      expect(vt.isActive).toBe(true);
      expect(mockInstance).not.toBeNull();
      expect(mockInstance!.started).toBe(true);
      expect(mockInstance!.continuous).toBe(true);
      expect(mockInstance!.interimResults).toBe(true);

      vt.disable();
    });

    it("stops recognition on disable()", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);
      vt.disable();

      expect(vt.isActive).toBe(false);
      expect(callbacks.stateChanges).toEqual([false]);
    });

    it("does nothing if disable() called when not active", () => {
      const vt = new VoiceTyping();
      vt.disable(); // should not throw
      expect(vt.isActive).toBe(false);
    });

    it("fires onStateChange(false) on disable()", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);
      vt.disable();

      expect(callbacks.stateChanges).toEqual([false]);
    });

    it("does not call onStateChange(true) on enable()", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      expect(callbacks.stateChanges).toEqual([]);

      vt.disable();
    });
  });

  describe("onresult", () => {
    it("invokes onTranscript with interim results", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      mockInstance!.simulateResult("hello", false);
      expect(callbacks.transcripts).toEqual([{ text: "hello", isFinal: false }]);

      vt.disable();
    });

    it("invokes onTranscript with final results", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      mockInstance!.simulateResult("hello world", true);
      expect(callbacks.transcripts).toEqual([{ text: "hello world", isFinal: true }]);

      vt.disable();
    });

    it("uses event.resultIndex for non-cumulative transcript", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      // First utterance
      mockInstance!.simulateResult("hello", true, 0);
      // Second utterance at a new resultIndex
      mockInstance!.simulateResult("world", false, 1);

      expect(callbacks.transcripts).toEqual([
        { text: "hello", isFinal: true },
        { text: "world", isFinal: false }
      ]);

      vt.disable();
    });
  });

  describe("auto-restart on onend", () => {
    it("restarts recognition on onend when still active", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      const instance = mockInstance!;
      instance.started = false; // simulate it being stopped
      instance.simulateEnd();

      // Should have restarted
      expect(instance.started).toBe(true);

      vt.disable();
    });

    it("does NOT restart after disable() (disableRequested guard)", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      // Capture the instance before disable clears it
      const instance = mockInstance!;
      const onend = instance.onend;

      vt.disable();

      // Simulate onend firing after disable (async behavior)
      instance.started = false;
      onend?.();

      // Should NOT have restarted
      expect(instance.started).toBe(false);
    });
  });

  describe("inactivity timeout", () => {
    it("disables after 60 seconds without onresult", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      jest.advanceTimersByTime(60_000);

      expect(vt.isActive).toBe(false);
      expect(callbacks.stateChanges).toEqual([false]);
    });

    it("resets timer on each onresult", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      // Advance 50 seconds
      jest.advanceTimersByTime(50_000);
      expect(vt.isActive).toBe(true);

      // Receive a result — resets timer
      mockInstance!.simulateResult("hello", false);

      // Advance another 50 seconds (would have timed out without reset)
      jest.advanceTimersByTime(50_000);
      expect(vt.isActive).toBe(true);

      // Advance to full 60 seconds after last result
      jest.advanceTimersByTime(10_000);
      expect(vt.isActive).toBe(false);
    });

    it("clears timer on disable", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);
      vt.disable();

      // Advancing time should not cause any issues
      jest.advanceTimersByTime(60_000);
      expect(callbacks.stateChanges).toEqual([false]); // Only the one from disable()
    });
  });

  describe("onerror", () => {
    it("calls onError and disables on error", () => {
      const vt = new VoiceTyping();
      const callbacks = createCallbacks();
      vt.enable(callbacks);

      mockInstance!.simulateError("not-allowed");

      expect(callbacks.errors).toEqual(["not-allowed"]);
      expect(vt.isActive).toBe(false);
      expect(callbacks.stateChanges).toEqual([false]);
    });
  });

  describe("single-active-instance constraint", () => {
    it("disables previous instance when a new one is enabled", () => {
      const vt1 = new VoiceTyping();
      const callbacks1 = createCallbacks();
      vt1.enable(callbacks1);

      const vt2 = new VoiceTyping();
      const callbacks2 = createCallbacks();
      vt2.enable(callbacks2);

      expect(vt1.isActive).toBe(false);
      expect(callbacks1.stateChanges).toEqual([false]);
      expect(vt2.isActive).toBe(true);
    });

    it("disables previous instance even when same instance is re-enabled", () => {
      const vt = new VoiceTyping();
      const callbacks1 = createCallbacks();
      vt.enable(callbacks1);

      const callbacks2 = createCallbacks();
      vt.enable(callbacks2);

      expect(callbacks1.stateChanges).toEqual([false]);
      expect(vt.isActive).toBe(true);
    });
  });
});
