import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import AISettings from "./ai-settings";

const mockSetUnitConfig = jest.fn();
const mockConfig: Record<string, any> = {};
const mockCurriculumValue = {
  unitConfig: { config: mockConfig },
  setUnitConfig: mockSetUnitConfig,
  saveState: undefined as string | undefined
};

jest.mock("../../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));

const aiPromptFields = {
  systemPrompt: "You are a master teacher.",
  mainPrompt: "Evaluate this document.",
  categorizationDescription: "Categorize the document.",
  keyIndicatorsPrompt: "What are the key indicators?",
  discussionPrompt: "Anything else?"
};

// Runs the updater passed to setUnitConfig against a mock draft seeded with the given pre-existing
// config, and returns it.
const applyLastUpdater = (seed: Record<string, any> = {}) => {
  const updaterFn = mockSetUnitConfig.mock.calls[0][0];
  const mockDraft = { config: { ...seed } as Record<string, any> };
  updaterFn(mockDraft);
  return mockDraft;
};

const save = () => fireEvent.click(screen.getByRole("button", { name: /Save/i }));

describe("AISettings", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    for (const key of Object.keys(mockConfig)) delete mockConfig[key];
    mockCurriculumValue.saveState = undefined;
  });

  it("does not offer a choice of the format sent to the AI", () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = { ...aiPromptFields, summarizer: "text" };
    render(<AISettings />);

    expect(screen.queryByText("Format Of Content Sent To AI")).not.toBeInTheDocument();
    expect(screen.queryByText("Image of Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Text Summary of Content")).not.toBeInTheDocument();
    // The only select left on the form is the evaluation method.
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.getByLabelText("AI Evaluation Method")).toBeInTheDocument();
  });

  it("deletes summarizer from a config that has it", async () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = { ...aiPromptFields, summarizer: "text" };
    render(<AISettings />);

    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({
      aiEvaluation: "custom",
      aiPrompt: { ...aiPromptFields, summarizer: "text" }
    });
    expect("summarizer" in mockDraft.config.aiPrompt).toBe(false);
  });

  it("leaves the other aiPrompt fields intact when it drops summarizer", async () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.commentTags = { user: "Who is it for?", form: "What does it look like?" };
    mockConfig.aiPrompt = { ...aiPromptFields, summarizer: "text" };
    render(<AISettings />);

    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({
      aiEvaluation: "custom",
      commentTags: mockConfig.commentTags,
      aiPrompt: { ...aiPromptFields, summarizer: "text", categories: ["user", "form"] }
    });
    expect(mockDraft.config.aiPrompt).toEqual({
      ...aiPromptFields,
      categories: ["user", "form"]
    });
  });

  it("creates an aiPrompt without summarizer when the config had none", async () => {
    render(<AISettings />);

    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect("summarizer" in mockDraft.config.aiPrompt).toBe(false);
  });

  it("turns session-end evaluation on", async () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = aiPromptFields;
    render(<AISettings />);

    expect(screen.getByLabelText("Evaluate At Session End")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Evaluate At Session End"));
    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({ aiEvaluation: "custom", aiPrompt: aiPromptFields });
    expect(mockDraft.config.aiEvaluateOnSessionEnd).toBe(true);
  });

  it("turns session-end evaluation back off", async () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = aiPromptFields;
    mockConfig.aiEvaluateOnSessionEnd = true;
    render(<AISettings />);

    expect(screen.getByLabelText("Evaluate At Session End")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Evaluate At Session End"));
    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({
      aiEvaluation: "custom", aiPrompt: aiPromptFields, aiEvaluateOnSessionEnd: true
    });
    expect(mockDraft.config.aiEvaluateOnSessionEnd).toBe(false);
  });

  // The 17 CMP math units omit discussionPrompt so the AI stops producing generic next-steps
  // advice. The runtime treats it as optional, so the form must not demand one.
  it("saves a custom-evaluation unit that has no discussion prompt", async () => {
    const { discussionPrompt, ...withoutDiscussion } = aiPromptFields;
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = withoutDiscussion;
    render(<AISettings />);

    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
  });

  it("removes an emptied discussion prompt rather than storing an empty string", async () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = aiPromptFields;
    render(<AISettings />);

    fireEvent.change(screen.getByLabelText("Discussion Prompt"), { target: { value: "" } });
    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({ aiEvaluation: "custom", aiPrompt: { ...aiPromptFields } });
    expect("discussionPrompt" in mockDraft.config.aiPrompt).toBe(false);
  });

  it("creates an aiPrompt without an empty discussion prompt", async () => {
    render(<AISettings />);

    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect("discussionPrompt" in mockDraft.config.aiPrompt).toBe(false);
  });

  it("disables session-end evaluation when no evaluation method is set", () => {
    render(<AISettings />);

    expect(screen.getByLabelText("Evaluate At Session End")).toBeDisabled();
  });

  // Not just "custom": session-end evaluation applies to every method.
  it("enables session-end evaluation for a non-custom evaluation method", () => {
    mockConfig.aiEvaluation = "categorize-design";
    render(<AISettings />);

    expect(screen.getByLabelText("Evaluate At Session End")).toBeEnabled();
  });

  // Disabling the box must not clear what it holds, or switching the method off and back on would
  // silently drop the author's choice.
  it("keeps the session-end choice when the evaluation method is switched off", async () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = aiPromptFields;
    mockConfig.aiEvaluateOnSessionEnd = true;
    render(<AISettings />);

    fireEvent.change(screen.getByLabelText("AI Evaluation Method"), { target: { value: "" } });
    expect(screen.getByLabelText("Evaluate At Session End")).toBeDisabled();
    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({
      aiEvaluation: "custom", aiPrompt: aiPromptFields, aiEvaluateOnSessionEnd: true
    });
    expect(mockDraft.config.aiEvaluateOnSessionEnd).toBe(true);
  });

  // An author editing a prompt on one of the CMP units saves the whole form; the box they never
  // touched must not quietly turn their unit's session-end evaluation off.
  it("leaves session-end evaluation on when the form is saved untouched", async () => {
    mockConfig.aiEvaluation = "custom";
    mockConfig.aiPrompt = aiPromptFields;
    mockConfig.aiEvaluateOnSessionEnd = true;
    render(<AISettings />);

    save();

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({
      aiEvaluation: "custom", aiPrompt: aiPromptFields, aiEvaluateOnSessionEnd: true
    });
    expect(mockDraft.config.aiEvaluateOnSessionEnd).toBe(true);
  });
});
