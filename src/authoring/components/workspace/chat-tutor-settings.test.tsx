import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import ChatTutorSettings from "./chat-tutor-settings";
import { IChatTutorPrompts } from "../../types";
import { CHAT_GENERIC_PROMPT } from "../../../../shared/chat-tutor-generic-prompt";
import { CHAT_TUTOR_DEFAULT_INTRO } from "../../../../shared/chat-tutor-default-intro";

const mockSetUnitConfig = jest.fn();

const mockConfig = {
  chatTutorPrompts: undefined as IChatTutorPrompts | undefined,
  chatTutorEnabled: undefined as boolean | undefined,
  chatTutorIntro: undefined as string | undefined
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
const applyLastUpdater = (
  chatTutorPrompts?: IChatTutorPrompts, chatTutorEnabled?: boolean, chatTutorIntro?: string
) => {
  const updaterFn = mockSetUnitConfig.mock.calls[0][0];
  const mockDraft: {
    config: { chatTutorPrompts?: IChatTutorPrompts; chatTutorEnabled?: boolean; chatTutorIntro?: string };
  } = { config: { chatTutorPrompts, chatTutorEnabled, chatTutorIntro } };
  updaterFn(mockDraft);
  return mockDraft;
};

describe("ChatTutorSettings", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    mockConfig.chatTutorPrompts = undefined;
    mockConfig.chatTutorEnabled = undefined;
    mockConfig.chatTutorIntro = undefined;
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

  it("loads the enabled state into the checkbox", () => {
    mockConfig.chatTutorEnabled = true;
    render(<ChatTutorSettings />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("enables the tutor on save, independent of the prompts", async () => {
    const user = userEvent.setup();
    render(<ChatTutorSettings />);

    await user.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.chatTutorEnabled).toBe(true);
  });

  it("seeds the intro with the default and saves a customization", async () => {
    const user = userEvent.setup();
    render(<ChatTutorSettings />);

    const intro = screen.getByLabelText("Chat intro message") as HTMLTextAreaElement;
    expect(intro.value).toBe(CHAT_TUTOR_DEFAULT_INTRO);
    await user.clear(intro);
    await user.type(intro, "Hi. I'm Ada Idea. Let's plan your circuit.");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.chatTutorIntro).toBe("Hi. I'm Ada Idea. Let's plan your circuit.");
  });

  it("loads a custom intro and removes the override when reset to the default", async () => {
    mockConfig.chatTutorIntro = "Custom greeting.";
    const user = userEvent.setup();
    render(<ChatTutorSettings />);

    const intro = screen.getByLabelText("Chat intro message") as HTMLTextAreaElement;
    expect(intro.value).toBe("Custom greeting."); // load path
    await user.clear(intro);
    await user.type(intro, CHAT_TUTOR_DEFAULT_INTRO);
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    // Seed the draft with the existing custom intro so the delete is observable.
    const mockDraft = applyLastUpdater(undefined, undefined, "Custom greeting.");
    expect(mockDraft.config.chatTutorIntro).toBeUndefined();
  });

  it("stores an empty string when the intro is cleared (suppresses it)", async () => {
    const user = userEvent.setup();
    render(<ChatTutorSettings />);

    await user.clear(screen.getByLabelText("Chat intro message"));
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.chatTutorIntro).toBe("");
  });

  it("disabling the tutor writes false (so it overrides a higher-level true) and keeps prompts", async () => {
    mockConfig.chatTutorEnabled = true;
    mockConfig.chatTutorPrompts = { appendToGenericPrompt: "Focus on energy." };
    const user = userEvent.setup();
    render(<ChatTutorSettings />);

    await user.click(screen.getByRole("checkbox")); // was checked; toggle off
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({ appendToGenericPrompt: "Focus on energy." }, true);
    expect(mockDraft.config.chatTutorEnabled).toBe(false);
    expect(mockDraft.config.chatTutorPrompts).toEqual({ appendToGenericPrompt: "Focus on energy." });
  });
});
