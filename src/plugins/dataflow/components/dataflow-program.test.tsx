import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { specStores } from "../../../models/stores/spec-stores";
import { DataflowContentModel, DataflowContentModelType } from "../model/dataflow-content";
import { DataflowNodeModel } from "../model/dataflow-program-model";
import { ReteManager } from "../rete/rete-manager";
import { DataflowProgram } from "./dataflow-program";

import "../dataflow-registration";

const kDataRate = 50;

// The members the program component and its children touch. `area` and `editor` are rete plugin
// instances, so they are narrowed to what is read; the rest are checked against the real class.
type ManagerStub =
  Pick<ReteManager, "mstContent" | "setupComplete" | "announcement" | "groups" | "nodes"
    | "dispose" | "fitContent" | "tickAndProcessNodes" | "updateSharedProgramData">
  & { area: Pick<ReteManager["area"], "nodeViews">; editor: Pick<ReteManager["editor"], "clear"> };

// A real ReteManager needs a live rete area, so stub the class. The instances are identity-compared
// to tell the editor manager (created first) from the playback manager (created on entering Done).
jest.mock("../rete/rete-manager", () => {
  const actual = jest.requireActual("../rete/rete-manager");
  return {
    ...actual,
    ReteManager: jest.fn().mockImplementation(
      (...args: ConstructorParameters<typeof ReteManager>): ManagerStub => {
        const content = args[3];
        return {
          mstContent: content,
          setupComplete: Promise.resolve(),
          announcement: { value: "" },
          groups: content.program.groups,
          nodes: content.program.nodes,
          area: { nodeViews: new Map() },
          editor: { clear: jest.fn() },
          dispose: jest.fn(),
          fitContent: jest.fn(),
          tickAndProcessNodes: jest.fn(),
          updateSharedProgramData: jest.fn()
        };
      })
  };
});

const MockedReteManager = ReteManager as unknown as jest.Mock;

function createContent() {
  const content = DataflowContentModel.create();
  content.program.addNode(
    DataflowNodeModel.create({ id: "n1", name: "Number", x: 0, y: 0, data: { type: "Number", value: 1 } })
  );
  return content;
}

function renderProgram(content: DataflowContentModelType) {
  const onActiveReteManagerChanged = jest.fn();
  const result = render(
    <ModalProvider>
      <Provider stores={specStores()}>
        <DndContext>
          <DataflowProgram
            tileId="tile1"
            program={content.program}
            programDataRate={kDataRate}
            tileContent={content}
            tileElt={null}
            onRegisterTileApi={jest.fn()}
            onActiveReteManagerChanged={onActiveReteManagerChanged}
          />
        </DndContext>
      </Provider>
    </ModalProvider>
  );
  return { ...result, onActiveReteManagerChanged };
}

// The instance the nth `new ReteManager(...)` returned.
function managerInstance(index: number): ManagerStub {
  return MockedReteManager.mock.results[index].value;
}

function lastReportedManager(onActiveReteManagerChanged: jest.Mock) {
  const { calls } = onActiveReteManagerChanged.mock;
  return calls[calls.length - 1][0];
}

// Record a tick's worth of data and stop, which is what puts the tile in Done mode.
function recordAndStop() {
  fireEvent.click(screen.getByTestId("record-data-button"));
  act(() => { jest.advanceTimersByTime(kDataRate + 10); });
  fireEvent.click(screen.getByTestId("record-data-button"));
}

describe("DataflowProgram rete manager routing (CLUE-573)", () => {
  beforeEach(() => {
    MockedReteManager.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reports the editor manager once on mount", () => {
    const { onActiveReteManagerChanged } = renderProgram(createContent());
    expect(MockedReteManager).toHaveBeenCalledTimes(1);
    expect(onActiveReteManagerChanged).toHaveBeenCalledTimes(1);
    expect(lastReportedManager(onActiveReteManagerChanged)).toBe(managerInstance(0));
  });

  it("reports the playback manager once recording finishes, and the editor manager again on clear", () => {
    const content = createContent();
    const { onActiveReteManagerChanged } = renderProgram(content);
    const editorManager = managerInstance(0);

    recordAndStop();

    // Entering Done creates the playback manager over a copy of the content; it owns the visible
    // canvas, so it is what the toolbar must act on. One report per transition, no re-render churn.
    expect(MockedReteManager).toHaveBeenCalledTimes(2);
    const playbackManager = managerInstance(1);
    expect(playbackManager).not.toBe(editorManager);
    expect(onActiveReteManagerChanged).toHaveBeenCalledTimes(2);
    expect(lastReportedManager(onActiveReteManagerChanged)).toBe(playbackManager);

    // Clearing the recorded data goes through a confirmation alert; in Done mode the record button
    // is labeled "Clear" too, so scope the lookup to the dialog.
    fireEvent.click(screen.getByTestId("record-data-button"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));

    expect(playbackManager.dispose).toHaveBeenCalled();
    expect(content.isDataSetEmptyCases).toBe(true);
    expect(onActiveReteManagerChanged).toHaveBeenCalledTimes(3);
    expect(lastReportedManager(onActiveReteManagerChanged)).toBe(editorManager);
  });

  it("reports undefined on unmount", () => {
    const { onActiveReteManagerChanged, unmount } = renderProgram(createContent());
    unmount();
    expect(onActiveReteManagerChanged).toHaveBeenCalledTimes(2);
    expect(lastReportedManager(onActiveReteManagerChanged)).toBeUndefined();
  });
});
