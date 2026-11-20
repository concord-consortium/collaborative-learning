import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import ClassSummarySettings from "./class-summary-settings";
import { CLASS_SUMMARY_STUDENT_INSTRUCTION, IClassSummaryPrompts } from "../../../../shared/class-summary-prompts";

const mockSetUnitConfig = jest.fn();

const mockConfig = {
  classSummaryPrompts: undefined as IClassSummaryPrompts | undefined
};

const mockCurriculumValue = {
  unitConfig: { config: mockConfig },
  setUnitConfig: mockSetUnitConfig,
  saveState: undefined as string | undefined
};

jest.mock("../../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));

// Runs the updater passed to setUnitConfig against a mock draft (seeded with the given pre-existing
// config) and returns it.
const applyLastUpdater = (classSummaryPrompts?: IClassSummaryPrompts) => {
  const {calls} = mockSetUnitConfig.mock;
  const updaterFn = calls[calls.length - 1][0];
  const mockDraft: { config: { classSummaryPrompts?: IClassSummaryPrompts } } =
    { config: { classSummaryPrompts } };
  updaterFn(mockDraft);
  return mockDraft;
};

describe("ClassSummarySettings", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    mockConfig.classSummaryPrompts = undefined;
    mockCurriculumValue.saveState = undefined;
  });

  it("renders both prompt fields", () => {
    render(<ClassSummarySettings />);
    expect(screen.getByText("Class Summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Replace built-in summary prompt")).toBeInTheDocument();
    expect(screen.getByLabelText("Additional summary prompt (appended)")).toBeInTheDocument();
  });

  it("loads existing prompts into the form", () => {
    mockConfig.classSummaryPrompts = {
      replaceStudentPrompt: "List the strategies students tried.",
      appendToStudentPrompt: "Name any misconception you see."
    };
    render(<ClassSummarySettings />);
    const replaceInput = screen.getByLabelText("Replace built-in summary prompt") as HTMLTextAreaElement;
    const appendInput = screen.getByLabelText("Additional summary prompt (appended)") as HTMLTextAreaElement;
    expect(replaceInput.value).toBe("List the strategies students tried.");
    expect(appendInput.value).toBe("Name any misconception you see.");
  });

  it("saves trimmed values, omitting empty fields", async () => {
    const user = userEvent.setup();
    render(<ClassSummarySettings />);

    await user.type(screen.getByLabelText("Additional summary prompt (appended)"), "  Be brief.  ");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    expect(applyLastUpdater().config.classSummaryPrompts).toEqual({ appendToStudentPrompt: "Be brief." });
  });

  it("shows the built-in prompt and copies it to the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    // Restored afterwards: navigator is shared across every test in the run, so a stub left in
    // place is a stub some later suite inherits without asking for it.
    const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      render(<ClassSummarySettings />);

      expect(screen.getByText("View built-in summary prompt")).toBeInTheDocument();
      expect(screen.getByText(/Summarize the key points, themes, topics/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
      expect(writeText).toHaveBeenCalledWith(CLASS_SUMMARY_STUDENT_INSTRUCTION);
      expect(await screen.findByRole("button", { name: "Copied!" })).toBeInTheDocument();
    } finally {
      if (original) Object.defineProperty(navigator, "clipboard", original);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("removes classSummaryPrompts when both fields are blank", async () => {
    mockConfig.classSummaryPrompts = { replaceStudentPrompt: "old" };
    const user = userEvent.setup();
    render(<ClassSummarySettings />);

    const replaceInput = screen.getByLabelText("Replace built-in summary prompt");
    await user.clear(replaceInput);
    await user.type(replaceInput, "   ");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    expect(applyLastUpdater({ replaceStudentPrompt: "old" }).config.classSummaryPrompts).toBeUndefined();
  });
});
