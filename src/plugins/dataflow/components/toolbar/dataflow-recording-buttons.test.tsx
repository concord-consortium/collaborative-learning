import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";

import { AddTilesContext, TileModelContext } from "../../../../components/tiles/tile-api";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { createDocumentModel } from "../../../../models/document/document";
import { ProblemDocument } from "../../../../models/document/document-types";
import { specStores } from "../../../../models/stores/spec-stores";
import { registerTileTypes } from "../../../../register-tile-types";
import { uniqueId } from "../../../../utilities/js-utils";
import { DataflowContentModelType } from "../../model/dataflow-content";
import { recordCase } from "../../model/utilities/recording-utilities";
import { ClearButton, RecordButton, StopButton } from "./dataflow-recording-buttons";

jest.mock("firebase/app", () => ({
  functions: () => ({ httpsCallable: () => jest.fn() })
}));

registerTileTypes(["Dataflow", "Table"]);

function setup(Component: typeof RecordButton, readOnly = false) {
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test",
    content: { tiles: [{ id: "df1", content: { type: "Dataflow" } }] } as any
  });
  const tile = docModel.content!.tileMap.get("df1")!;
  const content = tile.content as DataflowContentModelType;
  content.program.addNodeSnapshot({
    id: "node-0", name: "Number", x: 0, y: 0,
    data: { type: "Number", orderedDisplayName: "Sensor" }
  } as any);

  const addTileAfter = jest.fn();
  render(
    <ModalProvider>
      <Provider stores={specStores()}>
        <ReadOnlyContext.Provider value={readOnly}>
          <TileModelContext.Provider value={tile}>
            <AddTilesContext.Provider value={{ addTileAfter } as any}>
              <Component name="test-button" />
            </AddTilesContext.Provider>
          </TileModelContext.Provider>
        </ReadOnlyContext.Provider>
      </Provider>
    </ModalProvider>
  );
  return { content, addTileAfter, button: screen.getByRole("button") };
}

describe("RecordButton", () => {
  it("starts a recording and prepares the capture", () => {
    const { button, content } = setup(RecordButton);
    fireEvent.click(button);
    expect(content.isRecording).toBe(true);
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor"]);
  });

  // A recording whose points land nowhere visible looks like a program doing nothing.
  it("makes a table when the program has none", () => {
    const { button, addTileAfter } = setup(RecordButton);
    fireEvent.click(button);
    expect(addTileAfter).toHaveBeenCalledTimes(1);
    expect(addTileAfter.mock.calls[0][0]).toBe("Table");
  });

  it("is disabled while a recording is running", () => {
    const { button, content } = setup(RecordButton);
    act(() => content.startRecording());
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("is disabled in a read-only view", () => {
    const { button } = setup(RecordButton, true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("StopButton", () => {
  it("is disabled until a recording is running", () => {
    const { button } = setup(StopButton);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("ends the recording", () => {
    const { button, content } = setup(StopButton);
    act(() => content.startRecording());
    fireEvent.click(button);
    expect(content.isRecording).toBe(false);
  });
});

/** A real document with a Table tile, because Clear's behavior is about the link between them. */
function setupWithTable() {
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test",
    content: { tiles: [
      { id: "df1", content: { type: "Dataflow" } },
      { id: "table1", content: { type: "Table" } }
    ] } as any
  });
  const docContent = docModel.content!;
  const tile = docContent.tileMap.get("df1")!;
  const content = tile.content as DataflowContentModelType;
  content.program.addNodeSnapshot({
    id: "node-0", name: "Number", x: 0, y: 0,
    data: { type: "Number", orderedDisplayName: "Sensor" }
  } as any);
  content.program.addNewTick(uniqueId());
  content.program.nodes.get("node-0")?.data.setNodeValue(400);
  content.addLinkedTile("table1");
  content.prepareCapture();
  recordCase(content);

  const tableContent = docContent.tileMap.get("table1")!.content as any;
  render(
    <ModalProvider>
      <Provider stores={specStores()}>
        <ReadOnlyContext.Provider value={false}>
          <TileModelContext.Provider value={tile}>
            <AddTilesContext.Provider value={{ addTileAfter: jest.fn() } as any}>
              <ClearButton name="test-button" />
            </AddTilesContext.Provider>
          </TileModelContext.Provider>
        </ReadOnlyContext.Provider>
      </Provider>
    </ModalProvider>
  );
  return { content, tableContent, button: screen.getByRole("button") };
}

describe("ClearButton", () => {
  it("is disabled when nothing has been recorded", () => {
    const { button } = setup(ClearButton);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("is disabled while a recording is running", () => {
    const { content, button } = setupWithTable();
    act(() => content.startRecording());
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  // The table must visibly empty and stay linked. Detaching instead left every row on screen, so
  // the button looked broken -- which is what sent this back for a second pass.
  it("empties the linked table and keeps it linked", () => {
    const { content, tableContent, button } = setupWithTable();
    expect(content.linkedTableTileId).toBe("table1");

    fireEvent.click(button);

    expect(tableContent.dataSet.cases).toHaveLength(0);
    expect(content.dataSet.cases).toHaveLength(0);
    expect(content.linkedTableTileId).toBe("table1");
  });

  // A cleared table should still describe the program, exactly as Table It leaves it, rather than
  // reverting to a generic x | y pair.
  it("leaves the capture's columns in place, ready for the next run", () => {
    const { content, button } = setupWithTable();
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor"]);

    fireEvent.click(button);

    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor"]);
  });

  it("restamps the name, since the next run starts from here", () => {
    const { content, button } = setupWithTable();
    content.setContentTitle("Program 1");
    act(() => { content.prepareCapture(new Date(2026, 10, 2, 14, 32, 7)); });
    expect(content.dataSet.name).toBe("Program 1 14:32:07");

    fireEvent.click(button);

    expect(content.dataSet.name).toMatch(/^Program 1 \d{2}:\d{2}:\d{2}$/);
    expect(content.dataSet.name).not.toBe("Program 1 14:32:07");
  });

  it("disables itself once the recording is cleared", () => {
    const { button } = setupWithTable();
    fireEvent.click(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
});
