import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import TermOverridesSettings from "./term-overrides-settings";
import { TERM_METADATA } from "../../../utilities/translation";

const mockSetUnitConfig = jest.fn();

const mockConfig = {
  termOverrides: {} as Record<string, string>,
  tagPrompt: "Test Tag Prompt"
};

const mockUnitConfig = {
  config: mockConfig
};

const mockCurriculumValue = {
  unitConfig: mockUnitConfig,
  setUnitConfig: mockSetUnitConfig,
  saveState: undefined as string | undefined
};

jest.mock("../../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));

describe("TermOverridesSettings", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    mockConfig.termOverrides = {};
    mockCurriculumValue.saveState = undefined;
  });

  it("renders all terms from TERM_METADATA", () => {
    render(<TermOverridesSettings />);

    expect(screen.getByText("Term Overrides")).toBeInTheDocument();
    expect(screen.getByText(/Configure customized terminology/)).toBeInTheDocument();

    TERM_METADATA.forEach(term => {
      expect(screen.getByLabelText(term.key)).toBeInTheDocument();
      expect(screen.getByText(term.description)).toBeInTheDocument();
    });
  });

  it("displays default values in placeholders", () => {
    render(<TermOverridesSettings />);

    const groupInput = screen.getByLabelText("Group") as HTMLInputElement;
    expect(groupInput.placeholder).toBe("Group");

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.placeholder).toBe("Student");

    // Strategy should use tagPrompt as fallback since its default is empty
    const strategyInput = screen.getByLabelText("Strategy") as HTMLInputElement;
    expect(strategyInput.placeholder).toBe("Test Tag Prompt");
  });

  it("shows special help text for Strategy term", () => {
    render(<TermOverridesSettings />);

    // The help text should contain both the explanation and the current tag prompt value
    expect(screen.getByText(/If left blank, defaults to the tag prompt.*Test Tag Prompt/)).toBeInTheDocument();
  });

  it("allows entering custom override values", async () => {
    render(<TermOverridesSettings />);

    const groupInput = screen.getByLabelText("Group") as HTMLInputElement;
    await userEvent.type(groupInput, "Team");

    expect(groupInput.value).toBe("Team");
  });

  it("calls setUnitConfig with custom labels on save", async () => {
    render(<TermOverridesSettings />);

    const groupInput = screen.getByLabelText("Group") as HTMLInputElement;
    await userEvent.type(groupInput, "Team");

    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSetUnitConfig).toHaveBeenCalled();
    });

    // Get the updater function that was passed
    const updaterFn = mockSetUnitConfig.mock.calls[0][0];

    // Create a mock draft to test the updater function
    const mockDraft = {
      config: {
        termOverrides: undefined as Record<string, string> | undefined
      }
    };
    updaterFn(mockDraft);

    expect(mockDraft.config.termOverrides).toEqual({ Group: "Team" });
  });

  it("does not save labels that match the default value", async () => {
    render(<TermOverridesSettings />);

    const groupInput = screen.getByLabelText("Group") as HTMLInputElement;
    userEvent.type(groupInput, "Group");

    const saveButton = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSetUnitConfig).toHaveBeenCalled();
    });

    const updaterFn = mockSetUnitConfig.mock.calls[0][0];
    const mockDraft = {
      config: {
        termOverrides: { Group: "OldValue" }
      }
    };
    updaterFn(mockDraft);

    // termOverrides should be deleted since value matches default
    expect(mockDraft.config.termOverrides).toBeUndefined();
  });

  it("loads existing custom labels into form", () => {
    mockConfig.termOverrides = { Group: "Team", Name: "Participant" };

    render(<TermOverridesSettings />);

    const groupInput = screen.getByLabelText("Group") as HTMLInputElement;
    expect(groupInput.value).toBe("Team");

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Participant");
  });

});
