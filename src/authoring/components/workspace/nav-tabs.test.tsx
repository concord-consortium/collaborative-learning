import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import NavTabs from "./nav-tabs";

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

const applyLastUpdater = (seed: Record<string, any> = {}) => {
  const updaterFn = mockSetUnitConfig.mock.calls.at(-1)![0];
  const mockDraft: Record<string, any> =
    { config: { navTabs: { tabSpecs: [] }, ...seed }, sections: {} };
  updaterFn(mockDraft);
  return mockDraft;
};

const fixedStartCheckbox = () =>
  screen.getByRole("checkbox", { name: /Always start on a fixed tab/ });
const startTabSelect = () => screen.getByLabelText("Start tab") as HTMLSelectElement;
const startTabOptionLabels = () =>
  Array.from(startTabSelect().options).map(o => o.text).filter(text => text !== "(choose a tab)");
// The tab table's checkboxes have no accessible names of their own, so reach them through their row.
const tabRowCheckbox = (rowName: RegExp, column: "teacherOnly" | "show") =>
  within(screen.getByRole("row", { name: rowName })).getAllByRole("checkbox")[column === "show" ? 1 : 0];

describe("NavTabs fixed start view", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    for (const key of Object.keys(mockConfig)) delete mockConfig[key];
    mockConfig.navTabs = { tabSpecs: [
      { tab: "my-work", label: "My Work" },
      { tab: "class-work", label: "Published Work" },
      { tab: "sort-work", label: "Sort Work", hidden: true }
    ]};
    mockCurriculumValue.saveState = undefined;
    // Restored here as well as in the test that clears it, so a failure there cannot cascade.
    mockCurriculumValue.unitConfig = { config: mockConfig };
  });

  it("saves the tab the author can already see when they turn the switch on", async () => {
    // The switch is off but a tab was chosen before, which is what turning the switch off leaves
    // behind. The form has to be seeded from the config rather than from the DOM, or this save fails
    // validation with the choice visible on screen.
    mockConfig.fixedStartTab = "class-work";
    const user = userEvent.setup();
    render(<NavTabs />);

    expect(fixedStartCheckbox()).not.toBeChecked();
    expect(startTabSelect().value).toBe("class-work");

    await user.click(fixedStartCheckbox());
    expect(startTabSelect()).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.fixedStartView).toBe(true);
    expect(mockDraft.config.fixedStartTab).toBe("class-work");
  });

  it("keeps the tab choice but drops the switch when it is turned off", async () => {
    mockConfig.fixedStartView = true;
    mockConfig.fixedStartTab = "class-work";
    const user = userEvent.setup();
    render(<NavTabs />);

    expect(fixedStartCheckbox()).toBeChecked();
    await user.click(fixedStartCheckbox());
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    // Seeded with neither, so the assertion below can only pass if the submit handler writes the tab
    // back rather than merely leaving an existing value alone.
    const mockDraft = applyLastUpdater();
    expect(mockDraft.config.fixedStartView).toBeUndefined();
    expect(mockDraft.config.fixedStartTab).toBe("class-work");
    // The tab table is seeded from the same values, so an untouched save round-trips it unchanged.
    expect(mockDraft.config.navTabs.tabSpecs).toEqual(expect.arrayContaining([
      expect.objectContaining({ tab: "class-work", label: "Published Work", hidden: false,
                                teacherOnly: false }),
      expect.objectContaining({ tab: "sort-work", label: "Sort Work", hidden: true,
                                teacherOnly: false })
    ]));
  });

  it("lets the author clear a stored start tab once the switch is off", async () => {
    // Otherwise a wrong choice is stored forever: the select cannot be changed while it is disabled,
    // and the switch being on makes "(choose a tab)" fail validation.
    mockConfig.fixedStartTab = "class-work";
    const user = userEvent.setup();
    render(<NavTabs />);

    expect(fixedStartCheckbox()).not.toBeChecked();
    expect(startTabSelect()).toBeEnabled();
    await user.selectOptions(startTabSelect(), "");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    // Seeded with both, so this can only pass if the submit handler deletes them.
    const mockDraft = applyLastUpdater({ fixedStartView: true, fixedStartTab: "class-work" });
    expect(mockDraft.config.fixedStartView).toBeUndefined();
    expect(mockDraft.config.fixedStartTab).toBeUndefined();
  });

  it("enables the start tab select only once a tab is stored", () => {
    // Both halves in one test, so it distinguishes the stored-tab rule from the old switch-only rule.
    const { unmount } = render(<NavTabs />);
    expect(startTabSelect()).toBeDisabled();
    unmount();

    mockConfig.fixedStartTab = "class-work";
    render(<NavTabs />);
    expect(startTabSelect()).toBeEnabled();
  });

  it("offers only tabs that are shown, under the unit's own labels", () => {
    render(<NavTabs />);
    // "Published Work" is this unit's label for class-work; sort-work is hidden, so it is not offered
    // (resolveStartView would ignore it at runtime).
    expect(startTabOptionLabels()).toEqual(["My Work", "Published Work"]);
  });

  it("never offers Student Work, which the fixed start view cannot force", async () => {
    mockConfig.navTabs.tabSpecs.push({ tab: "student-work", label: "Student Work", teacherOnly: true });
    const user = userEvent.setup();
    render(<NavTabs />);
    expect(startTabOptionLabels()).not.toContain("Student Work");
    // Not even after the author unticks Teacher Only for it.
    await user.click(tabRowCheckbox(/Student Work/, "teacherOnly"));
    expect(startTabOptionLabels()).not.toContain("Student Work");
  });

  it("offers a tab the author has just shown, before they save", async () => {
    const user = userEvent.setup();
    render(<NavTabs />);
    await user.click(tabRowCheckbox(/Sort Work/, "show"));
    expect(startTabOptionLabels()).toEqual(["My Work", "Published Work", "Sort Work"]);
  });

  it("picks up a configuration that arrives after the first render", () => {
    // The form can mount before useCurriculum has loaded the unit, so the fields are seeded from the
    // config on every render rather than read out of the DOM once, when the refs attach.
    mockCurriculumValue.unitConfig = undefined as any;
    const { rerender } = render(<NavTabs />);
    expect(startTabOptionLabels()).toEqual([]);

    // The unit arrives on the second render.
    mockCurriculumValue.unitConfig = { config: mockConfig };
    mockConfig.fixedStartView = true;
    mockConfig.fixedStartTab = "class-work";
    rerender(<NavTabs />);

    expect(fixedStartCheckbox()).toBeChecked();
    expect(startTabSelect().value).toBe("class-work");
  });

  it("refuses to save a start tab that is no longer shown", async () => {
    // The author picked Sort Work, then hid it. The select has no option for it, so it would render
    // blank and save a tab that resolveStartView can only warn about at runtime.
    mockConfig.fixedStartView = true;
    mockConfig.fixedStartTab = "sort-work";
    render(<NavTabs />);

    // The stored value is still visible, marked as not shown, rather than the select going blank.
    expect(startTabSelect().value).toBe("sort-work");
    expect(screen.getByRole("option", { name: /Sort Work \(not shown\)/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(mockSetUnitConfig).not.toHaveBeenCalled();
    // The message is reachable from the control itself, not just visible on screen.
    expect(startTabSelect()).toHaveAttribute("aria-invalid", "true");
    expect(startTabSelect().getAttribute("aria-describedby"))
      .toContain(screen.getByRole("alert").id);
  });

  it("warns when the panel layout hides the tab it would start on", async () => {
    mockConfig.fixedStartView = true;
    mockConfig.fixedStartTab = "class-work";
    mockConfig.defaultPanelLayout = "workspace-only";
    render(<NavTabs />);
    const warning = await screen.findByText(/collapses the resources panel/);
    expect(warning).toBeInTheDocument();
    expect(startTabSelect().getAttribute("aria-describedby")).toContain(warning.id);
  });
});
