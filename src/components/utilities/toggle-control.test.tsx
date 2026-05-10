import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import ToggleControl from "./toggle-control";

const defaultTitle = "Shared: click to unshare from group";

function renderToggle(value: boolean, onChange: (next: boolean) => void = jest.fn(), title = defaultTitle) {
  const result = render(<ToggleControl value={value} onChange={onChange} title={title} />);
  const control = result.container.querySelector(".toggle-control") as HTMLElement;
  return { ...result, control };
}

describe("ToggleControl", () => {
  it("calls onChange with the negated value when clicked", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { control } = renderToggle(false, onChange);
    await user.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when clicked while on", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { control } = renderToggle(true, onChange);
    await user.click(control);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("has role='switch'", () => {
    const { control } = renderToggle(false);
    expect(control).toHaveAttribute("role", "switch");
  });

  it("sets aria-checked='true' when value is true", () => {
    const { control } = renderToggle(true);
    expect(control).toHaveAttribute("aria-checked", "true");
  });

  it("sets aria-checked='false' when value is false", () => {
    const { control } = renderToggle(false);
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("forwards the title prop to the title attribute (mouse hover)", () => {
    const { control } = renderToggle(false, jest.fn(), "custom hover text");
    expect(control).toHaveAttribute("title", "custom hover text");
  });

  it("uses the title prop as aria-label so screen readers match the tooltip", () => {
    const { control } = renderToggle(false, jest.fn(), "custom hover text");
    expect(control).toHaveAttribute("aria-label", "custom hover text");
  });
});
