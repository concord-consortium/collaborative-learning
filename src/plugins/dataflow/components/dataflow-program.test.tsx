import React from "react";
import { act, render } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { SerialDevice } from "../../../models/stores/serial";
import { specStores } from "../../../models/stores/spec-stores";
import { DataflowContentModel, DataflowContentModelType } from "../model/dataflow-content";
import { DataflowNodeModel } from "../model/dataflow-program-model";
import { fsrSensorChannel } from "../model/utilities/channel";
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

// A real ReteManager needs a live rete area, so stub the class.
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

function renderProgram(content: DataflowContentModelType, options: { readOnly?: boolean } = {}) {
  const onReteManagerRef = jest.fn();
  const stores = specStores();
  const result = render(
    <ModalProvider>
      <Provider stores={stores}>
        <DndContext>
          <DataflowProgram
            tileId="tile1"
            readOnly={options.readOnly}
            program={content.program}
            programDataRate={kDataRate}
            tileContent={content}
            tileElt={null}
            onRegisterTileApi={jest.fn()}
            onReteManagerRef={onReteManagerRef}
          />
        </DndContext>
      </Provider>
    </ModalProvider>
  );
  return { ...result, onReteManagerRef, stores };
}

// The instance the nth `new ReteManager(...)` returned.
function managerInstance(index: number): ManagerStub {
  return MockedReteManager.mock.results[index].value;
}

function lastReportedManager(onReteManagerRef: jest.Mock) {
  const { calls } = onReteManagerRef.mock;
  return calls[calls.length - 1][0];
}

describe("DataflowProgram rete manager routing", () => {
  beforeEach(() => {
    MockedReteManager.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reports the editor manager once on mount", () => {
    const { onReteManagerRef } = renderProgram(createContent());
    expect(MockedReteManager).toHaveBeenCalledTimes(1);
    expect(onReteManagerRef).toHaveBeenCalledTimes(1);
    expect(lastReportedManager(onReteManagerRef)).toBe(managerInstance(0));
  });

  it("reports undefined on unmount", () => {
    const { onReteManagerRef, unmount } = renderProgram(createContent());
    unmount();
    expect(onReteManagerRef).toHaveBeenCalledTimes(2);
    expect(lastReportedManager(onReteManagerRef)).toBeUndefined();
  });
});

describe("DataflowProgram recording lifecycle", () => {
  it("stops a recording left running when the component unmounts", () => {
    const content = createContent();
    const { unmount } = renderProgram(content);
    act(() => content.startRecording());
    expect(content.isRecording).toBe(true);
    unmount();
    expect(content.isRecording).toBe(false);
  });

  it("does not stop recording on unmount of a read-only view", () => {
    const content = createContent();
    const { unmount } = renderProgram(content, { readOnly: true });
    act(() => content.startRecording());
    expect(content.isRecording).toBe(true);
    unmount();
    expect(content.isRecording).toBe(true);
  });
});

describe("DataflowProgram channel source", () => {
  it("registers the tile's channels with the serial device only while mounted and editable", () => {
    const content = createContent();
    const disposer = jest.fn();
    const spy = jest.spyOn(SerialDevice.prototype, "registerChannelSource").mockReturnValue(disposer);
    try {
      const { unmount } = renderProgram(content);
      expect(spy).toHaveBeenCalledTimes(1);
      // The source reads the tile's channels each time it is called, so it sees later changes.
      const getChannels = spy.mock.calls[0][0];
      const initialChannels = content.channels;
      content.setChannels([fsrSensorChannel]);
      expect(content.channels).not.toBe(initialChannels);
      expect(getChannels()).toBe(content.channels);
      expect(getChannels()).toEqual([fsrSensorChannel]);
      expect(disposer).not.toHaveBeenCalled();
      unmount();
      expect(disposer).toHaveBeenCalledTimes(1);

      spy.mockClear();
      renderProgram(createContent(), { readOnly: true });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
