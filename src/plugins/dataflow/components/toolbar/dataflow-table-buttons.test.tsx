import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
import { DataflowTableButton, RecordSingleSampleButton } from "./dataflow-table-buttons";

jest.mock("firebase/app", () => ({
  functions: () => ({ httpsCallable: () => jest.fn() })
}));

registerTileTypes(["Dataflow", "Table"]);

/** A real document, because both buttons key off linkedTableTileId, which walks the shared model
 * manager's tile list — a stubbed content model would test the stub. */
function setupDocument({ withTable }: { withTable: boolean }) {
  const tiles: any[] = [{ id: "df1", content: { type: "Dataflow" } }];
  if (withTable) tiles.push({ id: "table1", content: { type: "Table" } });

  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test", content: { tiles } as any
  });
  const docContent = docModel.content!;
  const tile = docContent.tileMap.get("df1")!;
  const content = tile.content as DataflowContentModelType;

  ["Sensor", "Servo"].forEach((displayName, i) => {
    content.program.addNodeSnapshot({
      id: `node-${i}`, name: "Number", x: 0, y: 0,
      data: { type: "Number", orderedDisplayName: displayName }
    } as any);
  });
  content.program.addNewTick(uniqueId());
  [0, 1].forEach(i => content.program.nodes.get(`node-${i}`)?.data.setNodeValue(400 + i));

  // addLinkedTile is the production path and severs the Table's own auto-created dataset first.
  if (withTable) content.addLinkedTile("table1");

  return { docContent, tile, content };
}

function renderButton(
  Component: typeof DataflowTableButton,
  { withTable, readOnly = false }: { withTable: boolean; readOnly?: boolean }
) {
  const { content, tile } = setupDocument({ withTable });
  const addTileAfter = jest.fn();
  const stores = specStores();
  render(
    <ModalProvider>
      <Provider stores={stores}>
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
  return { content, addTileAfter, stores, button: screen.getByRole("button") };
}

describe("DataflowTableButton", () => {
  it("creates a table and sets up the columns when none is linked", () => {
    const { button, addTileAfter, content } = renderButton(DataflowTableButton, { withTable: false });
    fireEvent.click(button);
    expect(addTileAfter).toHaveBeenCalledTimes(1);
    expect(addTileAfter.mock.calls[0][0]).toBe("Table");
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });

  // The whole point of Dataflow having its own button: a capture stays tied to one table.
  it("selects the existing table instead of adding a second", () => {
    const { button, addTileAfter, stores } = renderButton(DataflowTableButton, { withTable: true });
    fireEvent.click(button);
    expect(addTileAfter).not.toHaveBeenCalled();
    expect(stores.ui.selectedTileIds).toContain("table1");
  });

  it("is disabled in a read-only view", () => {
    const { button } = renderButton(DataflowTableButton, { withTable: true, readOnly: true });
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

});

describe("RecordSingleSampleButton", () => {
  it("appends one point carrying each node's current value", () => {
    const { button, content } = renderButton(RecordSingleSampleButton, { withTable: true });
    fireEvent.click(button);

    expect(content.dataSet.cases).toHaveLength(1);
    const [point, sensor, servo] = content.dataSet.attributes;
    expect(content.dataSet.getValueAtIndex(0, point.id)).toBe(1);
    expect(content.dataSet.getValueAtIndex(0, sensor.id)).toBe(400);
    expect(content.dataSet.getValueAtIndex(0, servo.id)).toBe(401);
  });

  it("numbers successive samples 1, 2, 3", () => {
    const { button, content } = renderButton(RecordSingleSampleButton, { withTable: true });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    const pointId = content.dataSet.attributes[0].id;
    expect(content.dataSet.cases).toHaveLength(3);
    expect(content.dataSet.getValueAtIndex(2, pointId)).toBe(3);
  });

  it("creates the table first when none is linked", () => {
    const { button, addTileAfter, content } = renderButton(RecordSingleSampleButton, { withTable: false });
    fireEvent.click(button);
    expect(addTileAfter).toHaveBeenCalledTimes(1);
    expect(content.dataSet.cases).toHaveLength(1);
  });

  it("is disabled in a read-only view", () => {
    const { button } = renderButton(RecordSingleSampleButton, { withTable: true, readOnly: true });
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });
});
