import { applyPatch, applySnapshot, getSnapshot, IJsonPatch, onPatch, unprotect } from "mobx-state-tree";
import {
  defaultDataflowContent, DEFAULT_PROGRAM_ZOOM, DataflowContentModel, DataflowContentModelSnapshotIn,
  DataflowContentModelType, kDataflowTableTileType
} from "./dataflow-content";
import { newDataRate, newZoom } from "./dataflow-content-test-constants";
import dataflowThreeNode from "../test-docs/dataflow-1-three-node.json";
import { DEFAULT_DATA_RATE } from "./utilities/node";
import { IGeneratorNodeModel } from "../nodes/generator-node";
import { INumberNodeModel } from "../nodes/number-node";
import { IDemoOutputNodeModel } from "../nodes/demo-output-node";
import { DocumentContentModel, DocumentContentSnapshotType } from "../../../models/document/document-content";
import { IDocumentImportSnapshot } from "../../../models/document/document-content-import-types";
import { SharedModelDocumentManager } from "../../../models/document/shared-model-document-manager";
import { ITileEnvironment } from "../../../models/tiles/tile-content";
import { registerTileTypes } from "../../../register-tile-types";
import { recordCase } from "./utilities/recording-utilities";
import { addAttributeToDataSet } from "../../../models/data/data-set";
import { uniqueId } from "../../../utilities/js-utils";

registerTileTypes(["Dataflow", "Table", "Graph"]);

describe("DataflowContentModel", () => {
  it("should have correct defaults", () => {
    const dcm = defaultDataflowContent();
    expect(dcm.isUserResizable).toBe(true);
    expect(dcm.programDataRate).toBe(DEFAULT_DATA_RATE);
    expect(dcm.liveProgramZoom.dx).toBe(DEFAULT_PROGRAM_ZOOM.dx);
    expect(dcm.liveProgramZoom.dy).toBe(DEFAULT_PROGRAM_ZOOM.dy);
    expect(dcm.liveProgramZoom.scale).toBe(DEFAULT_PROGRAM_ZOOM.scale);
    expect(Object.values(getSnapshot(dcm.program.nodes)).length).toBe(0);
  });

  // `programZoom` is deprecated and unread, but must stay a persisted property: documents saved
  // before the fit-on-load change recorded history patches against nested paths under it, and if
  // the property is removed those paths no longer resolve, so TreeManager halts playback there.
  // This fails if someone removes the property as dead code.
  it("keeps programZoom resolvable so legacy history patches still replay", () => {
    const dcm = defaultDataflowContent();
    expect(() => applyPatch(dcm, { op: "replace", path: "/programZoom/dx", value: -10 })).not.toThrow();
  });

  // settings.dataflow.defaultSamplingRate seeds a new tile's rate; only known rate values apply. The
  // stub honors the "dataflow" group so a dropped/typo'd group reads undefined and the test fails.
  const appConfigWith = (settings: Record<string, any>) =>
    ({ getSetting: (key: string, group?: string) => group === "dataflow" ? settings[key] : undefined }) as any;

  it("seeds programDataRate from settings.dataflow.defaultSamplingRate", () => {
    const dcm = defaultDataflowContent({ appConfig: appConfigWith({ defaultSamplingRate: 10000 }) });
    expect(dcm.programDataRate).toBe(10000);
  });

  it("falls back to the default rate for an unknown/absent defaultSamplingRate", () => {
    expect(defaultDataflowContent().programDataRate).toBe(DEFAULT_DATA_RATE);
    expect(defaultDataflowContent({ appConfig: appConfigWith({ defaultSamplingRate: 1234 }) })
      .programDataRate).toBe(DEFAULT_DATA_RATE);
  });

  it("should handle basic changes", () => {
    const dcm = defaultDataflowContent();
    dcm.setProgramDataRate(newDataRate);
    dcm.setLiveProgramZoom(newZoom);
    expect(dcm.programDataRate).toBe(newDataRate);
    expect(dcm.liveProgramZoom.dx).toBe(newZoom.x);
    expect(dcm.liveProgramZoom.dy).toBe(newZoom.y);
    expect(dcm.liveProgramZoom.scale).toBe(newZoom.k);
  });

  describe("pan palette state (CLUE-573)", () => {
    it("defaults closed, toggles via its action, and never appears in snapshots", () => {
      const dcm = defaultDataflowContent();
      expect(dcm.panPaletteOpen).toBe(false);
      const before = JSON.stringify(getSnapshot(dcm));
      dcm.setPanPaletteOpen(true);
      expect(dcm.panPaletteOpen).toBe(true);
      expect(JSON.stringify(getSnapshot(dcm))).toBe(before);
      dcm.setPanPaletteOpen(false);
      expect(dcm.panPaletteOpen).toBe(false);
    });

    it("last pan direction defaults right, changes via its action, and never appears in snapshots", () => {
      const dcm = defaultDataflowContent();
      expect(dcm.lastPanDirection).toBe("right");
      const before = JSON.stringify(getSnapshot(dcm));
      dcm.setLastPanDirection("up");
      expect(dcm.lastPanDirection).toBe("up");
      expect(JSON.stringify(getSnapshot(dcm))).toBe(before);  // volatile: not persisted
    });
  });

  it("should be to load a program", () => {
    const content = dataflowThreeNode.tileMap["2cLNVyjzmhF5Mij-"].content;
    // We have to use `as DataflowContentModelSnapshotIn` because the json
    // gets imported with types that aren't strict enough for DataflowContentModel
    // See https://github.com/microsoft/TypeScript/issues/32063 which
    // would make this better.
    const dcm = DataflowContentModel.create(content as DataflowContentModelSnapshotIn);
    const { program } = dcm;
    const nodes = [...program.nodes.values()];
    expect(nodes.length).toBe(3);
    const generatorNode = nodes[0];
    expect(generatorNode.x).toBe(40);
    expect(generatorNode.y).toBe(5);
    const generatorData = generatorNode.data as IGeneratorNodeModel;
    expect(generatorData.type).toBe("Generator");
    expect(generatorData.generatorType).toBe("Sine");

    const numberNode = nodes[1];
    const numberData = numberNode.data as INumberNodeModel;
    expect(numberData.type).toBe("Number");
    expect(numberData.value).toBe(0);

    const demoOutputNode = nodes[2];
    const demoOutputData = demoOutputNode.data as IDemoOutputNodeModel;
    expect(demoOutputData.outputType).toBe("Advanced Grabber");
    expect(demoOutputData.plot).toBe(true);

    const connections = [...program.connections.values()];
    expect(connections.length).toBe(2);
    // The connections are just simple string properties so there isn't
    // much to test here
  });

  it("should be able to export proper json", () => {
    const content = dataflowThreeNode.tileMap["2cLNVyjzmhF5Mij-"].content;
    // We have to use `as DataflowContentModelSnapshotIn` because the json
    // gets imported with types that aren't strict enough for DataflowContentModel
    // See https://github.com/microsoft/TypeScript/issues/32063 which
    // would make this better.
    const dcm = DataflowContentModel.create(content as DataflowContentModelSnapshotIn);
    const jsonString = dcm.exportJson();
    const exportedJson = JSON.parse(jsonString);

    // Do some sanity checking
    expect(exportedJson.programDataRate).toBe(1000);

    const { nodes, connections } = exportedJson.program;
    expect(Object.values(nodes).length).toBe(3);
    expect(Object.values(connections).length).toBe(2);
  });

  it("does not export outputConfig (it mirrors unit config only for the runtime AI summarizer)", () => {
    const dcm = defaultDataflowContent();
    dcm.setOutputConfig({ servoInputMode: "proportion", allowedOutputTypes: ["Servo"] });
    expect(dcm.outputConfig).toBeDefined();
    const exportedJson = JSON.parse(dcm.exportJson());
    expect(exportedJson.outputConfig).toBeUndefined();
  });

  describe("getObjectsForVariable", () => {
    // A DataflowContentModel with no shared model attached: sharedVariables is undefined, so the
    // variable lookup fails and the scan must not run.
    it("returns [] when the tile has no shared variables", () => {
      const dcm = defaultDataflowContent();
      expect(dcm.getObjectsForVariable("anyId")).toEqual([]);
    });

    // Stub the sharedVariables view so this test exercises the matching logic without standing up
    // a whole document + SharedModelDocumentManager. The real shared-model wiring is covered
    // end to end by cypress/e2e/functional/tile_tests/highlight_references_spec.js.
    const withStubbedVariables = (dcm: any, variable: any) => {
      unprotect(dcm);
      Object.defineProperty(dcm, "sharedVariables", {
        configurable: true,
        get: () => ({ getVariableById: (id: string) => (id === variable.id ? variable : undefined) })
      });
      return dcm;
    };

    const emgVariable = {
      id: "var-emg",
      name: "emg_key",
      displayName: "EMG",
      getType: () => undefined,
      computedUnit: "",
      computedValue: 0
    };

    it("matches a Sensor node bound to the variable's simulated channel", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "sensor-1", name: "Sensor", x: 0, y: 0,
        data: { type: "Sensor", sensor: "SIMemg_key" }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("var-emg"))
        .toEqual([{ objectId: "sensor-1", objectType: "Node" }]);
    });

    it("matches a Live Output node bound to the variable's simulated hub", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "output-1", name: "Live Output", x: 0, y: 0,
        data: { type: "Live Output", liveOutputType: "Grabber", hubSelect: "Simulated EMG" }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("var-emg"))
        .toEqual([{ objectId: "output-1", objectType: "Node" }]);
    });

    it("excludes node types that cannot bind to a variable", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "number-1", name: "Number", x: 0, y: 0, data: { type: "Number", nodeValue: 5 }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("var-emg")).toEqual([]);
    });

    it("returns [] for an unknown variable id", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "sensor-1", name: "Sensor", x: 0, y: 0,
        data: { type: "Sensor", sensor: "SIMemg_key" }
      } as any);
      withStubbedVariables(dcm, emgVariable);
      expect(dcm.getObjectsForVariable("no-such-variable")).toEqual([]);
    });

    // Documents the known pre-existing fragility rather than hiding it: because the binding is a
    // derived string rather than an id, renaming a variable silently orphans its nodes. If this
    // test starts failing, someone has changed the binding to be id-based — update the spec's
    // "variable<->node binding" section before changing this test.
    it("misses a renamed variable, because binding is by derived string", () => {
      const dcm = defaultDataflowContent();
      dcm.program.addNodeSnapshot({
        id: "sensor-1", name: "Sensor", x: 0, y: 0,
        data: { type: "Sensor", sensor: "SIMemg_key" }
      } as any);
      withStubbedVariables(dcm, { ...emgVariable, name: "renamed_key" });
      expect(dcm.getObjectsForVariable("var-emg")).toEqual([]);
    });
  });

});

// A real document with a SharedModelDocumentManager, because linkedTableTileId walks the manager's
// tile list — stubbing it would test the stub. Follows dataflow-node-highlight.test.ts.
function createDocument(snapshot: IDocumentImportSnapshot) {
  const sharedModelManager = new SharedModelDocumentManager();
  const environment: ITileEnvironment = { sharedModelManager };
  const content = DocumentContentModel.create(snapshot as DocumentContentSnapshotType, environment);
  sharedModelManager.setDocument(content);
  return { content, sharedModelManager };
}

function dataflowContentFrom(doc: any, tileId = "df1") {
  return doc.getTile(tileId)!.content as DataflowContentModelType;
}

/** A Dataflow tile alone. Its afterAttach creates the SharedDataSet, so one already exists. */
function setupContentWithSharedModel() {
  const { content: doc } = createDocument({ tiles: [{ id: "df1", content: { type: "Dataflow" } as any }] });
  return dataflowContentFrom(doc);
}

/** A Dataflow tile plus another tile sharing its dataset. */
function setupContentWithLinkedTile(otherType: string, otherTileId: string) {
  const { content: doc, sharedModelManager } = createDocument({
    tiles: [
      { id: "df1", content: { type: "Dataflow" } as any },
      { id: otherTileId, content: { type: otherType } as any }
    ]
  });
  const content = dataflowContentFrom(doc);
  const otherContent = doc.getTile(otherTileId)!.content;
  sharedModelManager.addTileSharedModel(otherContent, content.sharedModel!);
  return { doc, content, otherContent, sharedModelManager };
}

const setupContentWithLinkedTable = () => {
  const r = setupContentWithLinkedTile(kDataflowTableTileType, "table1");
  return { ...r, tableTileId: "table1", tableContent: r.otherContent };
};
const setupContentWithLinkedGraph = () => setupContentWithLinkedTile("Graph", "graph1");

describe("linkedTableTileId", () => {
  it("is undefined when no tile shares the program's dataset", () => {
    expect(setupContentWithSharedModel().linkedTableTileId).toBeUndefined();
  });

  it("returns the id of a Table tile sharing the program's dataset", () => {
    const { content, tableTileId } = setupContentWithLinkedTable();
    expect(content.linkedTableTileId).toBe(tableTileId);
  });

  it("ignores a non-Table tile sharing the dataset", () => {
    const { content } = setupContentWithLinkedGraph();
    expect(content.linkedTableTileId).toBeUndefined();
  });
});

/** A Dataflow tile whose program holds two named nodes, as a capture's columns come from them. */
function setupContentWithTwoNamedNodes(...names: string[]) {
  const content = setupContentWithSharedModel();
  names.forEach((name, i) => {
    content.program.addNodeSnapshot({
      id: `node-${i}`, name: "Number", x: 0, y: 0,
      data: { type: "Number", orderedDisplayName: name }
    } as any);
  });
  // nodeValue reads from the node's entry for the program's current tick, so a value only exists
  // once a tick is open and the node has written into it.
  content.program.addNewTick(uniqueId());
  names.forEach((_name, i) => {
    content.program.nodes.get(`node-${i}`)?.data.setNodeValue(400 + i);
  });
  return content;
}

describe("prepareCapture", () => {
  it("builds a point column followed by one column per named node", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });

  it("appends the capture's start time to the program's own name", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.setContentTitle("Program 1");
    content.prepareCapture(new Date(2026, 9, 29, 14, 32, 7));
    expect(content.dataSet.name).toBe("Program 1 14:32:07");
  });

  // Otherwise a program recorded three times ends up called "Program 1 14:32:07 15:01:02 ...".
  it("replaces an earlier capture's time rather than appending a second", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.setContentTitle("Program 1");
    content.prepareCapture(new Date(2026, 9, 29, 14, 32, 7));
    content.prepareCapture(new Date(2026, 9, 29, 15, 1, 2));
    expect(content.dataSet.name).toBe("Program 1 15:01:02");
  });

  // Table It prepares the capture and so does the start of a recording. The second preparation
  // must not mint new attribute ids: the linked table holds the old ones and would go blank.
  it("keeps the same columns when a prepared capture is prepared again", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    const ids = content.dataSet.attributes.map(a => a.id);
    content.prepareCapture();
    expect(content.dataSet.attributes.map(a => a.id)).toEqual(ids);
  });

  it("rebuilds the columns when the program has changed under them", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    content.program.addNodeSnapshot({
      id: "node-2", name: "Number", x: 0, y: 0, data: { type: "Number", orderedDisplayName: "Extra" }
    } as any);
    content.prepareCapture();
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo", "Extra"]);
  });
});

describe("startRecording", () => {
  it("prepares the capture when the dataset is empty", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.startRecording(jest.fn());
    expect(content.isRecording).toBe(true);
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });

  // Point numbering continues rather than restarting. (prepareCapture's own idempotency is what
  // protects the columns here; the empty-table guard is pinned by the name test below.)
  it("leaves existing points alone and appends to them", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    const pointId = content.dataSet.attributes[0].id;

    content.startRecording(jest.fn());
    recordCase(content);

    expect(content.dataSet.cases).toHaveLength(2);
    expect(content.dataSet.getValueAtIndex(1, pointId)).toBe(2);
  });

  // Appending must not restamp the name: the capture's time is when collection began, and
  // prepareCapture would overwrite it with the time Record was pressed again.
  it("keeps the original capture time when it appends", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.setContentTitle("Program 1");
    content.prepareCapture(new Date(2026, 9, 30, 14, 32, 7));
    recordCase(content);

    content.startRecording(jest.fn());

    expect(content.dataSet.name).toBe("Program 1 14:32:07");
  });

  it("stops recording", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.startRecording(jest.fn());
    content.stopRecording();
    expect(content.isRecording).toBe(false);
  });
});

describe("recordCase", () => {
  it("writes a 1-based point number in the first column", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    recordCase(content);
    const pointId = content.dataSet.attributes[0].id;
    expect(content.dataSet.getValueAtIndex(0, pointId)).toBe(1);
    expect(content.dataSet.getValueAtIndex(1, pointId)).toBe(2);
  });

  // The point column must stay numeric, or the Graph tile infers a categorical x-axis and
  // getTimeAtRecordedIndex returns 0.
  it("leaves the point column numeric", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    recordCase(content);
    expect(content.dataSet.attributes[0].type).toBe("numeric");
  });

  // The number comes from the row's position, so a run that starts after single samples continues
  // from them rather than writing a second point 1.
  it("numbers from the rows already present", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    recordCase(content);
    recordCase(content);
    const pointId = content.dataSet.attributes[0].id;
    expect(content.dataSet.getValueAtIndex(2, pointId)).toBe(3);
  });

  it("writes each node's current value into its own column", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    const [, sensor, servo] = content.dataSet.attributes;
    expect(content.dataSet.getValueAtIndex(0, sensor.id)).toBe(400);
    expect(content.dataSet.getValueAtIndex(0, servo.id)).toBe(401);
  });
});

describe("getTimeAtRecordedIndex", () => {
  it("derives elapsed seconds from the index and the data rate", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.setProgramDataRate(100);
    content.prepareCapture();
    recordCase(content);
    recordCase(content);
    recordCase(content);
    expect(content.getTimeAtRecordedIndex(0)).toBe(0);
    expect(content.getTimeAtRecordedIndex(2)).toBeCloseTo(0.2);
    expect(content.durationOfRecording).toBeCloseTo(0.2);
  });

  it("returns 0 for an out-of-range index", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    expect(content.getTimeAtRecordedIndex(5)).toBe(0);
  });
});

// One name shared by a node and its column, in both directions. A rename deliberately does not
// detach -- the columns still describe the program -- so without this the headers go stale.
//
// These tests have no history framework, which is what calls updateAfterSharedModelChanges after a
// dataset change, so they call it themselves. dataflow-detach-undo.test.ts covers the real wiring.
describe("node and column name sync", () => {
  const columnNames = (content: DataflowContentModelType) =>
    content.dataSet.attributes.map(a => a.name);

  it("renames the column when the node is renamed", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();

    content.renameNode("node-0", "Thermometer");

    expect(columnNames(content)).toEqual(["Point", "Thermometer", "Servo"]);
    expect(content.program.nodes.get("node-0")!.data.orderedDisplayName).toBe("Thermometer");
  });

  it("renames the node when the column is renamed", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    const servoAttr = content.dataSet.attributes[2];

    content.dataSet.setAttributeName(servoAttr.id, "Gripper");
    content.updateAfterSharedModelChanges(content.sharedModel);

    expect(content.program.nodes.get("node-1")!.data.orderedDisplayName).toBe("Gripper");
  });

  // renameNode's column rename is itself a dataset change, so the framework calls
  // updateAfterSharedModelChanges next. That call must find the names equal and write nothing.
  it("writes nothing on the update that follows a node rename", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    content.renameNode("node-0", "Thermometer");

    const patches: IJsonPatch[] = [];
    const dispose = onPatch(content, patch => patches.push(patch));
    content.updateAfterSharedModelChanges(content.sharedModel);
    dispose();

    expect(patches).toEqual([]);
  });

  // The point column carries no node id, and nothing should try to trace it to one.
  it("leaves the point column alone", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();

    content.renameNode("node-0", "Thermometer");

    expect(content.dataSet.attributes[0].name).toBe("Point");
  });

  // A fresh tile, and a program whose capture has been detached, both hold the default x | y pair.
  // With a single node the counts match, so the point-column check is the only thing stopping the
  // sync renaming that node to "y".
  it("does not rename a node from the default x | y columns", () => {
    const content = setupContentWithTwoNamedNodes("Sensor");
    expect(columnNames(content)).toEqual(["x", "y"]);

    content.updateAfterSharedModelChanges(content.sharedModel);

    expect(content.program.nodes.get("node-0")?.data.orderedDisplayName).toBe("Sensor");
  });

  // A capture the program no longer holds describes the old program, so renames must not reach it.
  it("does not touch a dataset the program has detached", () => {
    const { content, doc, sharedModelManager } = setupContentWithLinkedTable();
    const tableContent = doc.getTile("table1")!.content as any;

    // Real nodes, and the production linking path, so the table genuinely shares the capture --
    // without both, this test renames nothing and asserts against a default x|y dataset.
    ["Sensor", "Servo"].forEach((displayName, i) => {
      content.program.addNodeSnapshot({
        id: `node-${i}`, name: "Number", x: 0, y: 0,
        data: { type: "Number", orderedDisplayName: displayName }
      } as any);
    });
    sharedModelManager.removeTileSharedModel(tableContent, content.sharedModel!);
    content.addLinkedTile("table1");
    content.prepareCapture();
    recordCase(content);
    expect(tableContent.dataSet.attributes.map((a: any) => a.name)).toEqual(["Point", "Sensor", "Servo"]);

    content.detachLinkedTables();
    content.renameNode("node-0", "Thermometer");

    expect(tableContent.dataSet.attributes.map((a: any) => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });
});


// Outside production the content model reports an action that changes the program's nodes or
// connections without calling notifyStructureChange, so a new action that forgets it is noticed.
describe("the check that structural changes notify", () => {
  it("reports a change made without notifying", async () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    await jestSpyConsole("error", spy => {
      // applySnapshot is an action on the program that replaces its nodes and never notifies.
      applySnapshot(content.program, { ...getSnapshot(content.program), nodes: {} });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toContain("notifyStructureChange");
    });
  });

  it("stays quiet for the program's own structural actions", async () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    await jestSpyConsole("error", spy => {
      content.program.addConnection({
        id: "c1", source: "node-0", sourceOutput: "value", target: "node-1", targetInput: "nodeValueA"
      } as any);
      content.program.removeNodeAndConnections("node-0");
      content.setProgram({ ...getSnapshot(content.program), nodes: {} });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it("stays quiet for actions that change no structure", async () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    await jestSpyConsole("error", spy => {
      content.renameNode("node-0", "Thermometer");
      content.prepareCapture();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

describe("a capture whose last table has been deleted", () => {
  // recordCase writes by position, so reusing columns built for the old program silently shifts
  // every value when a node has gone -- Servo's reading under Sensor's header.
  it("is cleared on a structural change, so the next capture rebuilds its columns", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    expect(content.dataSet.cases).toHaveLength(1);

    // No table follows it -- the student deleted theirs.
    content.program.removeNode("node-0");

    expect(content.dataSet.cases).toHaveLength(0);
  });
});

// Copying a tile remaps every attribute id (getUpdatedSharedDataSetIds), which is how CLUE works.
// Pairing columns to nodes by position rather than by an id embedded in the attribute is what
// keeps the name sync working afterwards.
describe("name sync after a copy has remapped the attribute ids", () => {
  it("still renames the column when the node is renamed", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();

    // Stand in for the copy: ids with no node reference, same order and names.
    const originals = content.dataSet.attributes.map(a => ({ name: a.name }));
    content.clearAttributes();
    originals.forEach(({ name }) => addAttributeToDataSet(content.dataSet, { name }));
    expect(content.dataSet.attributes.every(a => !a.id.includes("*"))).toBe(true);

    content.renameNode("node-0", "Thermometer");

    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Thermometer", "Servo"]);
  });
});
