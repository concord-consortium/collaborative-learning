/**
 * Tests for the native event fallback in expression tile input handling.
 *
 * The handleMathfieldInput callback is attached as a native DOM event listener
 * (via addEventListener), but typed as a React FormEvent handler. When called
 * natively, the argument is a raw InputEvent with no .nativeEvent property.
 * Accessing e.nativeEvent.inputType without a fallback causes:
 *   "Uncaught TypeError: Cannot read properties of undefined (reading 'inputType')"
 *
 * The fix uses: ((e as any).nativeEvent ?? e) to handle both paths.
 */

export {};

describe("expression tile native event fallback", () => {
  // This replicates the logic on the fixed line in expression-tile.tsx
  function getMathLiveEvent(e: any) {
    return (e.nativeEvent ?? e);
  }

  it("extracts inputType from a React SyntheticEvent (has nativeEvent)", () => {
    const syntheticEvent = {
      nativeEvent: { inputType: "insertText", data: "insertText" },
      target: { mode: "latex", value: "x" },
    };
    const mathLiveEvent = getMathLiveEvent(syntheticEvent);
    expect(mathLiveEvent.inputType).toBe("insertText");
    expect(mathLiveEvent.data).toBe("insertText");
  });

  it("extracts inputType from a native DOM InputEvent (no nativeEvent)", () => {
    // Native InputEvent has inputType and data directly on the event object
    const nativeEvent = {
      inputType: "insertText",
      data: "x",
      target: { mode: "math", value: "x" },
    };
    const mathLiveEvent = getMathLiveEvent(nativeEvent);
    expect(mathLiveEvent.inputType).toBe("insertText");
    expect(mathLiveEvent.data).toBe("x");
  });

  it("does not throw when nativeEvent is undefined (the original bug)", () => {
    // Before the fix, this would throw:
    //   TypeError: Cannot read properties of undefined (reading 'inputType')
    const nativeEvent = {
      inputType: "insertFromPaste",
      data: null,
      target: { mode: "math", value: "y" },
    };
    // nativeEvent property is absent, so .nativeEvent is undefined
    expect(Object.prototype.hasOwnProperty.call(nativeEvent, "nativeEvent")).toBe(false);
    const mathLiveEvent = getMathLiveEvent(nativeEvent);
    // Should fall back to the event itself
    expect(mathLiveEvent.inputType).toBe("insertFromPaste");
  });

  it("handles event with nativeEvent explicitly set to null", () => {
    const event = {
      nativeEvent: null,
      inputType: "deleteContentBackward",
      target: { mode: "math", value: "" },
    };
    // ?? treats null as nullish, so falls back to the event itself
    const mathLiveEvent = getMathLiveEvent(event);
    expect(mathLiveEvent.inputType).toBe("deleteContentBackward");
  });
});
