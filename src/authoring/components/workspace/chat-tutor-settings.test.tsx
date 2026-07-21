import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import ChatTutorSettings from "./chat-tutor-settings";
import { IChatTutorPrompts } from "../../types";
import { CHAT_GENERIC_PROMPT } from "../../../../shared/chat-tutor-generic-prompt";

const mockSetUnitConfig = jest.fn();

const mockConfig = {
  chatTutorPrompts: undefined as IChatTutorPrompts | undefined
};

const mockCurriculumValue = {
  unitConfig: { config: mockConfig },
  setUnitConfig: mockSetUnitConfig,
  saveState: undefined as string | undefined
};

jest.mock("../../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));

// Runs the updater passed to setUnitConfig against a mock draft and returns it.
const applyLastUpdater = (chatTutorPrompts?: IChatTutorPrompts) => {
  const updaterFn = mockSetUnitConfig.mock.calls[0][0];
  const mockDraft = { config: { chatTutorPrompts } };
  updaterFn(mockDraft);
  return mockDraft;
};

describe("ChatTutorSettings", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    mockConfig.chatTutorPrompts = undefined;
    mockCurriculumValue.saveState = undefined;
  });

  it("renders both prompt fields", () => {
    render(<ChatTutorSettings />);
    expect(screen.getByText("Chat Tutor")).toBeInTheDocument();
    expect(screen.getByLabelText("Replace built-in tutor prompt")).toBeInTheDocument();
    expect(screen.getByLabelText("Additional tutor prompt (appended)")).toBeInTheDocument();
  });

  it("loads existing prompts into the form", () => {
    mockConfig.chatTutorPrompts = {
      replaceGenericPrompt: "You are a tutor.",
      appendToGenericPrompt: "Focus on energy transfer."
    };
    render(<ChatTutorSettings />);
    const replaceInput = screen.getByLabelText("Replace built-in tutor prompt") as HTMLTextAreaElement;
    const appendInput = screen.getByLabelText("Additional tutor prompt (appended)") as HTMLTextAreaElement;
    expect(replaceInput.value).toBe("You are a tutor.");
    expect(appendInput.value).toBe("Focus on energy transfer.");
  });

  it("saves trimmed values, omitting empty fields", async () => {
    const user = userEvent.setup();
    render(<ChatTutorSettings />);

    const appendInput = screen.getByLabelText("Additional tutor prompt (appended)");
    await user.type(appendInput, "  Focus on energy transfer.  ");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.chatTutorPrompts).toEqual({
      appendToGenericPrompt: "Focus on energy transfer."
    });
  });

  it("shows the built-in prompt and copies it to the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true
    });
    render(<ChatTutorSettings />);

    expect(screen.getByText("View built-in tutor prompt")).toBeInTheDocument();
    expect(screen.getByText(/warm, patient science tutor/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
    expect(writeText).toHaveBeenCalledWith(CHAT_GENERIC_PROMPT);
    expect(await screen.findByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("deletes chatTutorPrompts when both fields are blank", async () => {
    mockConfig.chatTutorPrompts = { replaceGenericPrompt: "old" };
    const user = userEvent.setup();
    render(<ChatTutorSettings />);

    const replaceInput = screen.getByLabelText("Replace built-in tutor prompt");
    await user.clear(replaceInput);
    await user.type(replaceInput, "   ");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({ replaceGenericPrompt: "old" });
    expect(mockDraft.config.chatTutorPrompts).toBeUndefined();
  });
});
