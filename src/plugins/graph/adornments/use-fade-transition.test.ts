import { renderHook, act } from "@testing-library/react";
import { useFadeTransition } from "./use-fade-transition";

describe("useFadeTransition", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts in 'fadingIn' when mounted visible", () => {
    const { result } = renderHook(() => useFadeTransition(true, 1000));
    expect(result.current).toBe("fadingIn");
  });

  it("transitions from 'fadingIn' to 'visible' after the duration elapses", () => {
    const { result } = renderHook(() => useFadeTransition(true, 1000));
    expect(result.current).toBe("fadingIn");
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe("visible");
  });

  it("stays 'fadingIn' through unrelated re-renders during the transition", () => {
    // This is the regression we're fixing: the old ref-based logic dropped the
    // fadeIn class on the next re-render, so any concurrent state change ate
    // the animation window before tests (or users) could see it.
    const { result, rerender } = renderHook(
      ({ isVisible }) => useFadeTransition(isVisible, 1000),
      { initialProps: { isVisible: true } }
    );
    expect(result.current).toBe("fadingIn");
    rerender({ isVisible: true });
    rerender({ isVisible: true });
    expect(result.current).toBe("fadingIn");
  });

  it("starts in 'hidden' when mounted invisible, without flashing 'fadingOut'", () => {
    const { result } = renderHook(() => useFadeTransition(false, 1000));
    expect(result.current).toBe("hidden");
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe("hidden");
  });

  it("transitions through 'fadingOut' to 'hidden' when isVisible flips true → false", () => {
    const { result, rerender } = renderHook(
      ({ isVisible }) => useFadeTransition(isVisible, 1000),
      { initialProps: { isVisible: true } }
    );
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe("visible");
    rerender({ isVisible: false });
    expect(result.current).toBe("fadingOut");
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe("hidden");
  });

  it("transitions through 'fadingIn' to 'visible' when isVisible flips false → true", () => {
    const { result, rerender } = renderHook(
      ({ isVisible }) => useFadeTransition(isVisible, 1000),
      { initialProps: { isVisible: false } }
    );
    rerender({ isVisible: true });
    expect(result.current).toBe("fadingIn");
    act(() => { jest.advanceTimersByTime(1000); });
    expect(result.current).toBe("visible");
  });

  it("cancels the pending transition when isVisible flips mid-animation", () => {
    const { result, rerender } = renderHook(
      ({ isVisible }) => useFadeTransition(isVisible, 1000),
      { initialProps: { isVisible: true } }
    );
    expect(result.current).toBe("fadingIn");
    act(() => { jest.advanceTimersByTime(500); });
    rerender({ isVisible: false });
    expect(result.current).toBe("fadingOut");
    // The remaining 500ms of the original fadeIn timer must not fire and flip us to 'visible'.
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe("fadingOut");
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe("hidden");
  });
});
