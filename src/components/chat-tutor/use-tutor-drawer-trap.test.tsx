import React, { useRef } from "react";
import { render } from "@testing-library/react";
import { useFocusTrap } from "@concord-consortium/accessibility-tools/hooks";
import { useTutorDrawerTrap } from "./use-tutor-drawer-trap";

jest.mock("@concord-consortium/accessibility-tools/hooks", () => ({
  useFocusTrap: jest.fn()
}));

const Harness: React.FC<{ active: boolean }> = ({ active }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useTutorDrawerTrap({ containerRef, bodyRef, onEscape: jest.fn(), active });
  return <div ref={containerRef}><div ref={bodyRef} /></div>;
};

describe("useTutorDrawerTrap", () => {
  const mockUseFocusTrap = useFocusTrap as jest.Mock;
  const enterTrap = jest.fn();

  beforeEach(() => {
    mockUseFocusTrap.mockReset();
    enterTrap.mockReset();
    mockUseFocusTrap.mockImplementation(config => (config ? { enterTrap } : null));
  });

  it("configures the trap and enters it while active", () => {
    render(<Harness active={true} />);
    expect(mockUseFocusTrap.mock.calls[0][0]).toBeDefined();
    expect(enterTrap).toHaveBeenCalledTimes(1);
  });

  it("disables the trap while inactive and enters it when it becomes active", () => {
    const { rerender } = render(<Harness active={false} />);
    expect(mockUseFocusTrap.mock.calls.every(call => call[0] === undefined)).toBe(true);
    expect(enterTrap).not.toHaveBeenCalled();
    rerender(<Harness active={true} />);
    expect(enterTrap).toHaveBeenCalledTimes(1);
  });
});
