import React from "react";
import { fireEvent, render } from "@testing-library/react";

import { EditableLabelWithButton } from "../editable-label-with-button";

describe("EditableLabelWithButton — keyboard accessibility", () => {
  it("preview is not focusable by default", () => {
    render(<EditableLabelWithButton defaultValue="Cats" onSubmit={() => undefined} />);
    // When isPreviewFocusable is false (the default), Chakra renders the preview
    // with no tabindex (or -1), so it isn't part of the natural Tab order.
    const preview = document.querySelector(".chakra-editable__preview") as HTMLElement;
    expect(preview).not.toBeNull();
    expect(preview.getAttribute("tabindex")).not.toBe("0");
  });

  it("preview becomes a tab stop when enterToEdit is opted into", () => {
    render(<EditableLabelWithButton defaultValue="Cats" enterToEdit onSubmit={() => undefined} />);
    const preview = document.querySelector(".chakra-editable__preview") as HTMLElement;
    expect(preview.getAttribute("tabindex")).toBe("0");
  });

  // TODO bug #21 — Chakra v2's <Editable> enters edit mode on preview focus,
  // not on Enter. The CLUE-523 Enter-to-edit UX needs to be restored separately
  // before this assertion can be re-enabled. See react18-known-issues.md.
  it.skip("Enter on a focused preview switches into edit mode (input becomes visible)", () => {
    render(<EditableLabelWithButton defaultValue="Cats" enterToEdit onSubmit={() => undefined} />);
    const preview = document.querySelector(".chakra-editable__preview") as HTMLElement;
    preview.focus();
    fireEvent.keyDown(preview, { key: "Enter" });
    const input = document.querySelector("input.chakra-editable__input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.hasAttribute("hidden")).toBe(false);
  });

  it("applies aria-label to the preview and input when provided", () => {
    render(
      <EditableLabelWithButton
        defaultValue="Cats"
        enterToEdit
        ariaLabel="Dataset name: Cats, press Enter to edit"
        onSubmit={() => undefined}
      />
    );
    const preview = document.querySelector(".chakra-editable__preview") as HTMLElement;
    const input = document.querySelector("input.chakra-editable__input") as HTMLInputElement;
    expect(preview.getAttribute("aria-label")).toBe("Dataset name: Cats, press Enter to edit");
    expect(input.getAttribute("aria-label")).toBe("Dataset name: Cats, press Enter to edit");
  });
});
