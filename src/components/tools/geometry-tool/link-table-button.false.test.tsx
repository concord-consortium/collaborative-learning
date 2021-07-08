import React from "react";
import { render, screen } from "@testing-library/react";
import { LinkTableButton } from "./link-table-button";

// mocking is module-level, so we have separate modules to mock the different return values
const useFeatureFlag = jest.fn().mockReturnValue(false);
jest.mock("../../../hooks/use-stores", () => ({
  useFeatureFlag: (...args: any) => useFeatureFlag(...args)
}));

describe("LinkTableButton with linking disabled", () => {

  const onClick = jest.fn();

  it("doesn't render when disabled", () => {
    render(<LinkTableButton isEnabled={false} onClick={onClick} />);
    expect(screen.queryByTestId("table-link-button")).toBeNull();
  });

  it("doesn't render when enabled", () => {
    render(<LinkTableButton isEnabled={true} onClick={onClick} />);
    expect(screen.queryByTestId("table-link-button")).toBeNull();
  });
});
