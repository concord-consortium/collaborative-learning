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

const fourUpCheckbox = () =>
  screen.getByRole("checkbox", { name: "Show the 4-up view button" });

const defaultDocumentTypeSelect = () =>
  screen.getByRole("combobox");

const groupDocumentsCheckbox = () =>
  screen.getByRole("checkbox", { name: "Enable group documents" });

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

describe("DocumentSettings — 4-up View", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    for (const key of Object.keys(mockConfig)) delete mockConfig[key];
    mockCurriculumValue.saveState = undefined;
  });

  it("defaults the 4-up checkbox to checked when the config is unset", () => {
    render(<DocumentSettings />);
    expect(fourUpCheckbox()).toBeChecked();
  });

  it("loads hide4up:true as unchecked", () => {
    mockConfig.hide4up = true;
    render(<DocumentSettings />);
    expect(fourUpCheckbox()).not.toBeChecked();
  });

  it("stores hide4up:true when the box is unchecked", async () => {
    const user = userEvent.setup();
    render(<DocumentSettings />);

    await user.click(fourUpCheckbox());
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.hide4up).toBe(true);
  });

  it("removes hide4up when re-enabled (default shown is implicit)", async () => {
    mockConfig.hide4up = true;
    const user = userEvent.setup();
    render(<DocumentSettings />);

    await user.click(fourUpCheckbox()); // was unchecked; re-check it
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater({ hide4up: true });
    expect(mockDraft.config.hide4up).toBeUndefined();
  });
});

describe("DocumentSettings — Starting Document", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    for (const key of Object.keys(mockConfig)) delete mockConfig[key];
    mockCurriculumValue.saveState = undefined;
  });

  it("disables the group-documents checkbox when Group doc is selected", async () => {
    const user = userEvent.setup();
    render(<DocumentSettings />);

    expect(groupDocumentsCheckbox()).not.toBeDisabled();
    await user.selectOptions(defaultDocumentTypeSelect(), "group");
    expect(groupDocumentsCheckbox()).toBeDisabled();
  });

  it("loads defaultDocumentType:\"group\" with the checkbox checked and disabled (implied, no explicit flag)", () => {
    mockConfig.defaultDocumentType = "group";
    render(<DocumentSettings />);

    expect(groupDocumentsCheckbox()).toBeChecked();
    expect(groupDocumentsCheckbox()).toBeDisabled();
  });

  it("writes defaultDocumentType: \"group\" and groupDocumentsEnabled: true when Group doc is selected", async () => {
    const user = userEvent.setup();
    render(<DocumentSettings />);

    await user.selectOptions(defaultDocumentTypeSelect(), "group");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.defaultDocumentType).toBe("group");
    expect(mockDraft.config.groupDocumentsEnabled).toBe(true);
  });

  it("writes groupDocumentsEnabled truthy and omits defaultDocumentType for Problem doc, box checked", async () => {
    const user = userEvent.setup();
    render(<DocumentSettings />);

    await user.click(groupDocumentsCheckbox());
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    // Seed the draft with pre-existing values so the deletes/writes are observable.
    const mockDraft = applyLastUpdater({ defaultDocumentType: "personal" });
    expect(mockDraft.config.defaultDocumentType).toBeUndefined();
    expect(mockDraft.config.groupDocumentsEnabled).toBeTruthy();
  });
});
