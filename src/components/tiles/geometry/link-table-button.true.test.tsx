import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkTableButton } from "./link-table-button";
import { act } from "react-dom/test-utils";

// mocking is module-level, so we have separate modules to mock the different return values
const useFeatureFlag = jest.fn().mockReturnValue(true);
jest.mock("../../../hooks/use-stores", () => ({
  useFeatureFlag: (...args: any) => useFeatureFlag(...args)
}));

describe("LinkTableButton with linking enabled", () => {

  const onClick = jest.fn();

  beforeEach(() => {
    onClick.mockReset();
  });

  it("renders when disabled", () => {
    const { unmount } = render(<LinkTableButton isEnabled={false} onClick={onClick} />);
    expect(screen.getByTestId("table-link-button")).toBeInTheDocument();
    act(() => {
      userEvent.click(screen.getByTestId("table-link-button"));
      unmount();
    });
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders when enabled", () => {
    const { unmount } = render(<LinkTableButton isEnabled={true} onClick={onClick} />);
    expect(screen.getByTestId("table-link-button")).toBeInTheDocument();
    act(() => {
      userEvent.click(screen.getByTestId("table-link-button"));
      unmount();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders when enabled without onClick", () => {
    const { unmount } = render(<LinkTableButton isEnabled={true} />);
    expect(screen.getByTestId("table-link-button")).toBeInTheDocument();
    act(() => {
      userEvent.click(screen.getByTestId("table-link-button"));
      unmount();
    });
    expect(onClick).not.toHaveBeenCalled();
  });
});
