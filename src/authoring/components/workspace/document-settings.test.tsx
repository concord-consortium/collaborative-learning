import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import DocumentSettings from "./document-settings";

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

// Runs the updater passed to setUnitConfig against a mock draft seeded with the given pre-existing
// config, and returns it.
const applyLastUpdater = (seed: Record<string, any> = {}) => {
  const updaterFn = mockSetUnitConfig.mock.calls[0][0];
  const mockDraft = { config: { ...seed }, sections: {} };
  updaterFn(mockDraft);
  return mockDraft;
};

const shareCheckbox = () =>
  screen.getByRole("checkbox", { name: "Show the share button on student documents" });

describe("DocumentSettings — Share Button", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    for (const key of Object.keys(mockConfig)) delete mockConfig[key];
    mockCurriculumValue.saveState = undefined;
  });

  it("defaults the share-button checkbox to checked when the config is unset", () => {
    render(<DocumentSettings />);
    expect(shareCheckbox()).toBeChecked();
  });

  it("loads showShare:false as unchecked", () => {
    mockConfig.showShare = false;
    render(<DocumentSettings />);
    expect(shareCheckbox()).not.toBeChecked();
  });

  it("stores showShare:false when the box is unchecked", async () => {
    const user = userEvent.setup();
    render(<DocumentSettings />);

    await user.click(shareCheckbox());
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.showShare).toBe(false);
  });

  it("removes showShare when re-enabled (default true is implicit)", async () => {
    mockConfig.showShare = false;
    const user = userEvent.setup();
    render(<DocumentSettings />);

    await user.click(shareCheckbox()); // was unchecked; re-check it
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    // Seed the draft with the existing false so the delete is observable.
    const mockDraft = applyLastUpdater({ showShare: false });
    expect(mockDraft.config.showShare).toBeUndefined();
  });
});
