import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ContainerConfig } from "./container-config";
import { IClassSummaryPrompts } from "../../../../../shared/class-summary-prompts";
import { IUnit } from "../../../types";

const kPath = "investigations/investigation-0/problem-0/containerConfig";

const mockSetUnitConfig = jest.fn();

function makeUnit(classSummaryPrompts?: IClassSummaryPrompts): IUnit {
  return {
    code: "test", abbrevTitle: "T", title: "Test Unit", subtitle: "",
    config: {} as IUnit["config"],
    sections: {},
    planningDocument: {} as IUnit["planningDocument"],
    investigations: [{
      description: "", ordinal: 1, title: "Investigation 1",
      problems: [{
        description: "", ordinal: 1, title: "Problem 1.1", subtitle: "", sections: [],
        config: classSummaryPrompts ? { classSummaryPrompts } : undefined
      }]
    }]
  } as IUnit;
}

const mockCurriculumValue = {
  unitConfig: makeUnit(),
  setUnitConfig: mockSetUnitConfig,
  teacherGuideConfig: undefined,
  setTeacherGuideConfig: jest.fn(),
  files: {},
  saveContent: jest.fn(),
  saveState: undefined as string | undefined
};

jest.mock("../../../hooks/use-curriculum", () => ({
  useCurriculum: () => mockCurriculumValue
}));

// Runs the updater the form passed to setUnitConfig against a fresh unit draft and returns the
// problem's config, which is what the runtime reads.
function applyLastUpdater(existing?: IClassSummaryPrompts) {
  const draft = makeUnit(existing);
  mockSetUnitConfig.mock.calls[0][0](draft);
  return draft.investigations[0].problems[0].config;
}

const replaceLabel = "Replace built-in summary prompt";
const appendLabel = "Additional summary prompt (appended)";

describe("ContainerConfig class summary prompts", () => {
  beforeEach(() => {
    mockSetUnitConfig.mockClear();
    mockCurriculumValue.unitConfig = makeUnit();
  });

  it("loads a problem's authored prompts into the form", () => {
    mockCurriculumValue.unitConfig = makeUnit({
      replaceStudentPrompt: "List the strategies.", appendToStudentPrompt: "Be brief."
    });
    render(<ContainerConfig path={kPath} />);
    expect((screen.getByLabelText(replaceLabel) as HTMLTextAreaElement).value).toBe("List the strategies.");
    expect((screen.getByLabelText(appendLabel) as HTMLTextAreaElement).value).toBe("Be brief.");
  });

  it("saves trimmed values, omitting empty fields", async () => {
    const user = userEvent.setup();
    render(<ContainerConfig path={kPath} />);

    await user.type(screen.getByLabelText(appendLabel), "  Name any misconception.  ");
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    expect(applyLastUpdater()?.classSummaryPrompts)
      .toEqual({ appendToStudentPrompt: "Name any misconception." });
  });

  it("removes the block when both fields are cleared, so the unit's prompt applies again", async () => {
    const authored = { replaceStudentPrompt: "List the strategies." };
    mockCurriculumValue.unitConfig = makeUnit(authored);
    const user = userEvent.setup();
    render(<ContainerConfig path={kPath} />);

    await user.clear(screen.getByLabelText(replaceLabel));
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(mockSetUnitConfig).toHaveBeenCalled());
    expect(applyLastUpdater(authored)?.classSummaryPrompts).toBeUndefined();
  });
});
