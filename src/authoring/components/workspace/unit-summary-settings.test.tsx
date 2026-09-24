import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import UnitSummarySettings from "./unit-summary-settings";
import { IUnitSummary, UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION } from "../../../../shared/unit-summary-types";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockApi = { get: mockGet, post: mockPost };
const mockSetUnitConfig = jest.fn();

const mockCurriculumValue: {
  unitConfig: { config: { aiUnitSummary?: IUnitSummary } } | undefined;
  unitConfigLoading: boolean;
  setUnitConfig: jest.Mock;
  saveState: string | undefined;
  branch: string | undefined;
  unit: string | undefined;
} = {
  unitConfig: { config: {} },
  unitConfigLoading: false,
  setUnitConfig: mockSetUnitConfig,
  saveState: undefined,
  branch: "main",
  unit: "test-unit",
};

jest.mock("../../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));
jest.mock("../../hooks/use-authoring-api", () => ({
  useAuthoringApi: () => mockApi
}));

function buildSummary(overrides: Partial<IUnitSummary> = {}): IUnitSummary {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    sourceHash: "hash-a",
    sourceManifest: [
      { ordinal: "1.1", title: "First", problemHash: "p1-hash" },
      { ordinal: "1.2", title: "Second", problemHash: "p2-hash" },
    ],
    overview: "This unit is about testing.",
    entries: [
      { ordinal: "1.1", priorKnowledge: "", problemDigest: "Digest one" },
      { ordinal: "1.2", priorKnowledge: "Knows one.", problemDigest: "Digest two" },
    ],
    ...overrides,
  };
}

function buildStatus(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    sourceHash: "hash-a",
    sourceManifest: [
      { ordinal: "1.1", title: "First", problemHash: "p1-hash" },
      { ordinal: "1.2", title: "Second", problemHash: "p2-hash" },
    ],
    problemSizes: [{ ordinal: "1.1", markdownLength: 100 }, { ordinal: "1.2", markdownLength: 100 }],
    ...overrides,
  };
}

function flush() {
  return act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function lastSetUnitConfigDraft(config: { aiUnitSummary?: IUnitSummary } = {}) {
  const updater = mockSetUnitConfig.mock.calls[mockSetUnitConfig.mock.calls.length - 1][0];
  const draft = { config };
  updater(draft);
  return draft;
}

describe("UnitSummarySettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurriculumValue.unitConfig = { config: {} };
    mockCurriculumValue.unitConfigLoading = false;
    mockCurriculumValue.saveState = undefined;
    mockCurriculumValue.branch = "main";
    mockCurriculumValue.unit = "test-unit";
    mockGet.mockResolvedValue(buildStatus());
  });

  it("shows a prompt to generate when there is no saved summary", async () => {
    render(<UnitSummarySettings />);
    await flush();
    expect(screen.getByText(/No summary yet/)).toBeInTheDocument();
  });

  it("loads a saved summary into the form", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    render(<UnitSummarySettings />);
    await flush();
    expect(screen.getByLabelText("Overview")).toHaveValue("This unit is about testing.");
    expect(screen.getByLabelText("Digest for problem 1.1")).toHaveValue("Digest one");
  });

  it("shows an 'author should fill it in' note for an empty entry-0 priorKnowledge", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    render(<UnitSummarySettings />);
    await flush();
    expect(screen.getByText(/author should fill it in/)).toBeInTheDocument();
  });

  it("edits a field in local state", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    const user = userEvent.setup();
    render(<UnitSummarySettings />);
    await flush();

    const overview = screen.getByLabelText("Overview");
    await user.clear(overview);
    await user.type(overview, "Updated overview.");
    expect(overview).toHaveValue("Updated overview.");
    // Not persisted merely by editing.
    expect(mockSetUnitConfig).not.toHaveBeenCalled();
  });

  it("does not persist a generated result until Save is clicked", async () => {
    mockPost.mockResolvedValue({ success: true, summary: buildSummary({ overview: "Generated overview." }) });
    render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    await waitFor(() => expect(screen.getByLabelText("Overview")).toHaveValue("Generated overview."));

    expect(mockSetUnitConfig).not.toHaveBeenCalled();
  });

  it("saves the current form state via setUnitConfig", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockSetUnitConfig).toHaveBeenCalledTimes(1);
    const draft = lastSetUnitConfigDraft();
    expect(draft.config.aiUnitSummary?.overview).toBe("This unit is about testing.");
    expect(draft.config.aiUnitSummary?.entries[0].problemDigest).toBe("Digest one");
  });

  it("saves edits made after loading", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    const user = userEvent.setup();
    render(<UnitSummarySettings />);
    await flush();

    const overview = screen.getByLabelText("Overview");
    await user.clear(overview);
    await user.type(overview, "Edited overview.");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const draft = lastSetUnitConfigDraft();
    expect(draft.config.aiUnitSummary?.overview).toBe("Edited overview.");
  });

  it("refuses to save (and shows why) when the live problem list disagrees with the manifest", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    mockGet.mockResolvedValue(buildStatus({
      sourceManifest: [{ ordinal: "1.1", title: "First", problemHash: "p1-hash" }],
    }));
    render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(mockSetUnitConfig).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be saved/)).toBeInTheDocument();
  });

  it("shows a generation failure and leaves the existing summary untouched", async () => {
    const existing = buildSummary({ overview: "Existing overview." });
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: existing } };
    mockPost.mockResolvedValue({ success: false, error: "openai 500" });
    render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    await waitFor(() => expect(screen.getByText(/openai 500/)).toBeInTheDocument());

    expect(screen.getByLabelText("Overview")).toHaveValue("Existing overview.");
  });

  it("shows a generation failure when the request itself rejects (e.g. a timeout)", async () => {
    const existing = buildSummary({ overview: "Existing overview." });
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: existing } };
    mockPost.mockRejectedValue(new Error("network timeout"));
    render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    await waitFor(() => expect(screen.getByText(/network timeout/)).toBeInTheDocument());

    expect(screen.getByLabelText("Overview")).toHaveValue("Existing overview.");
  });

  it("disables the Generate button while a generation is running", async () => {
    let resolvePost: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise(resolve => { resolvePost = resolve; }));
    render(<UnitSummarySettings />);
    await flush();

    const button = screen.getByRole("button", { name: "Generate Summary" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: /Generating/ })).toBeDisabled());

    resolvePost({ success: true, summary: buildSummary() });
    await flush();
    expect(screen.getByRole("button", { name: "Generate Summary" })).not.toBeDisabled();
  });

  it("disables the Generate button while the current unit's config is still loading", async () => {
    mockCurriculumValue.unitConfigLoading = true;
    render(<UnitSummarySettings />);
    await flush();

    expect(screen.getByRole("button", { name: "Generate Summary" })).toBeDisabled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("confirms before generating over unsaved edits, and does nothing if declined", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<UnitSummarySettings />);
    await flush();

    const overview = screen.getByLabelText("Overview");
    await user.type(overview, " edited");
    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("generates over unsaved edits once confirmed", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    mockPost.mockResolvedValue({ success: true, summary: buildSummary({ overview: "New overview." }) });
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    render(<UnitSummarySettings />);
    await flush();

    const overview = screen.getByLabelText("Overview");
    await user.type(overview, " edited");
    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));

    await waitFor(() => expect(screen.getByLabelText("Overview")).toHaveValue("New overview."));
    confirmSpy.mockRestore();
  });

  it("confirms again if the form was edited while a generation was already in flight", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    let resolvePost: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise(resolve => { resolvePost = resolve; }));
    const user = userEvent.setup();
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false);
    render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    confirmSpy.mockClear();

    // Fields stay enabled while the button is disabled -- edit during the in-flight request.
    const digest = screen.getByLabelText("Digest for problem 1.1");
    await user.type(digest, " more");

    resolvePost({ success: true, summary: buildSummary({ overview: "New overview." }) });
    await flush();

    expect(confirmSpy).toHaveBeenCalled();
    // Declined: the in-flight edit is kept, not replaced by the new result.
    expect(screen.getByLabelText("Overview")).toHaveValue("This unit is about testing.");
    confirmSpy.mockRestore();
  });

  it("discards a generation result if the unit/branch changed while it was in flight", async () => {
    let resolvePost: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise(resolve => { resolvePost = resolve; }));
    const { rerender } = render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());

    mockCurriculumValue.branch = "other-branch";
    mockCurriculumValue.unit = "other-unit";
    rerender(<UnitSummarySettings />);

    resolvePost({ success: true, summary: buildSummary({ overview: "SHOULD NOT APPEAR" }) });
    await flush();

    expect(screen.queryByText("SHOULD NOT APPEAR")).not.toBeInTheDocument();
  });

  it("shows the new unit's own summary once its config arrives, not the previous unit's", async () => {
    // useCurriculum keeps the previous unit's config in place while the new one is still loading
    // (see use-curriculum.tsx), so branch/unit update before unitConfig does.
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary({ overview: "Unit A overview." }) } };
    const { rerender } = render(<UnitSummarySettings />);
    await flush();
    expect(screen.getByLabelText("Overview")).toHaveValue("Unit A overview.");

    mockCurriculumValue.branch = "other-branch";
    mockCurriculumValue.unit = "other-unit";
    rerender(<UnitSummarySettings />);
    await flush();
    // The new unit's config hasn't arrived yet. The form is cleared, not left showing unit A's data
    // (which would otherwise stay on screen, and stay savable into unit B, indefinitely) -- see
    // "does not carry a generated-but-unsaved summary..." below for why this can't wait for
    // savedSummary to change instead.
    expect(screen.queryByLabelText("Overview")).not.toBeInTheDocument();
    expect(screen.getByText(/No summary yet/)).toBeInTheDocument();

    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary({ overview: "Unit B overview." }) } };
    rerender(<UnitSummarySettings />);
    await flush();
    expect(screen.getByLabelText("Overview")).toHaveValue("Unit B overview.");

    // Save now persists unit B's own summary -- not unit A's, which the form displayed moments ago.
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const draft = lastSetUnitConfigDraft();
    expect(draft.config.aiUnitSummary?.overview).toBe("Unit B overview.");
  });

  it("does not carry a generated-but-unsaved summary into another unit with no saved summary", async () => {
    // Neither unit has a saved summary, so savedSummary is undefined before AND after navigation --
    // an effect keyed only on savedSummary would never re-fire, since undefined to undefined is not
    // a change React would notice.
    mockCurriculumValue.unitConfig = { config: {} };
    mockPost.mockResolvedValue({ success: true, summary: buildSummary({ overview: "Unit A generated overview." }) });
    const { rerender } = render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    await waitFor(() => expect(screen.getByLabelText("Overview")).toHaveValue("Unit A generated overview."));

    mockCurriculumValue.branch = "other-branch";
    mockCurriculumValue.unit = "other-unit";
    rerender(<UnitSummarySettings />);
    await flush();

    expect(screen.queryByText("Unit A generated overview.")).not.toBeInTheDocument();
    expect(screen.getByText(/No summary yet/)).toBeInTheDocument();
  });

  it("does not enable Save for the new unit before its own config has loaded", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary({ overview: "Unit A overview." }) } };
    const { rerender } = render(<UnitSummarySettings />);
    await flush();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    // Navigate: branch/unit change and the new unit's live status can arrive (fetchStatus is an
    // independent, often-faster request) before useCurriculum's own config fetch does -- unitConfig
    // here is left pointing at unit A throughout.
    mockCurriculumValue.branch = "other-branch";
    mockCurriculumValue.unit = "other-unit";
    rerender(<UnitSummarySettings />);
    await flush();

    // The new unit's live status has arrived (fetchStatus resolved), but its config hasn't -- Save
    // must not be clickable against a form that still belongs to unit A.
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("does not restore the previous unit's summary when mounting already pointed at the new unit", async () => {
    // Simulates switching from another settings panel in unit A straight to this one for unit B:
    // this mounts already seeing branch/unit for B, while unitConfig hasn't caught up yet.
    mockCurriculumValue.branch = "other-branch";
    mockCurriculumValue.unit = "other-unit";
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary({ overview: "Unit A overview." }) } };
    mockCurriculumValue.unitConfigLoading = true;
    const { rerender } = render(<UnitSummarySettings />);
    await flush();

    expect(screen.queryByLabelText("Overview")).not.toBeInTheDocument();
    expect(screen.getByText(/No summary yet/)).toBeInTheDocument();

    // Unit B's own config arrives.
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary({ overview: "Unit B overview." }) } };
    mockCurriculumValue.unitConfigLoading = false;
    rerender(<UnitSummarySettings />);
    await flush();

    expect(screen.getByLabelText("Overview")).toHaveValue("Unit B overview.");
  });

  it("names the changed problem when a problem's content hash differs (content changed)", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    mockGet.mockResolvedValue(buildStatus({
      sourceHash: "hash-b",
      sourceManifest: [
        { ordinal: "1.1", title: "First", problemHash: "CHANGED-HASH" },
        { ordinal: "1.2", title: "Second", problemHash: "p2-hash" },
      ],
    }));
    render(<UnitSummarySettings />);
    await flush();

    expect(screen.getByText(/Possibly stale/)).toBeInTheDocument();
    expect(screen.getByText(/Problem 1.1: content changed/)).toBeInTheDocument();
  });

  it("lights the badge after renumbering with no text change (manifest differs, sourceHash same)", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    mockGet.mockResolvedValue(buildStatus({
      sourceHash: "hash-a", // unchanged: renumbering alone doesn't touch the Markdown or its order
      sourceManifest: [
        { ordinal: "1.2", title: "First", problemHash: "p1-hash" }, // ordinal changed at this position
        { ordinal: "1.1", title: "Second", problemHash: "p2-hash" },
      ],
    }));
    render(<UnitSummarySettings />);
    await flush();

    expect(screen.getByText(/Possibly stale/)).toBeInTheDocument();
    // Both positions are flagged: a full swap changes the ordinal seen at both index 0 and index 1.
    expect(screen.getAllByText(/moved or was renamed/)).toHaveLength(2);
  });

  it("lights the badge after retitling", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    mockGet.mockResolvedValue(buildStatus({
      sourceManifest: [
        { ordinal: "1.1", title: "Renamed First", problemHash: "p1-hash" },
        { ordinal: "1.2", title: "Second", problemHash: "p2-hash" },
      ],
    }));
    render(<UnitSummarySettings />);
    await flush();

    expect(screen.getByText(/Possibly stale/)).toBeInTheDocument();
    expect(screen.getByText(/moved or was renamed/)).toBeInTheDocument();
  });

  it("lights the badge after a problem is inserted or removed", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    mockGet.mockResolvedValue(buildStatus({
      sourceManifest: [
        { ordinal: "1.1", title: "First", problemHash: "p1-hash" },
        { ordinal: "1.2", title: "Second", problemHash: "p2-hash" },
        { ordinal: "1.3", title: "Third", problemHash: "p3-hash" },
      ],
    }));
    render(<UnitSummarySettings />);
    await flush();

    expect(screen.getByText(/Possibly stale/)).toBeInTheDocument();
    expect(screen.getByText(/now has 3 problems/)).toBeInTheDocument();
  });

  it("does not show the badge when nothing has changed", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    render(<UnitSummarySettings />);
    await flush();
    expect(screen.queryByText(/Possibly stale/)).not.toBeInTheDocument();
  });

  it("shows the badge already lit if the source changed during a successful generation", async () => {
    mockPost.mockResolvedValue({ success: true, summary: buildSummary() });
    // After generation, the panel re-checks status; simulate the source having changed by then.
    mockGet
      .mockResolvedValueOnce(buildStatus())
      .mockResolvedValueOnce(buildStatus({ sourceHash: "hash-changed" }));
    render(<UnitSummarySettings />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Generate Summary" }));
    await waitFor(() => expect(screen.getByLabelText("Overview")).toHaveValue("This unit is about testing."));
    await flush();

    expect(screen.getByText(/Possibly stale/)).toBeInTheDocument();
  });

  it("includes the full summary and the look-ahead instruction text in the export view", async () => {
    mockCurriculumValue.unitConfig = { config: { aiUnitSummary: buildSummary() } };
    const { container } = render(<UnitSummarySettings />);
    await flush();

    const exportText = container.querySelector(".export-view pre")?.textContent ?? "";
    expect(exportText).toContain("This unit is about testing.");
    expect(exportText).toContain("Digest one");
    expect(exportText).toContain("Digest two");
    expect(exportText).toContain("Knows one.");
    expect(exportText).toContain(UNIT_SUMMARY_LOOKAHEAD_INSTRUCTION);
    expect(screen.getByText(/manual step outside this tool/)).toBeInTheDocument();
  });
});
