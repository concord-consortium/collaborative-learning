import { applyPatch, getSnapshot, unprotect } from "mobx-state-tree";
import {
  defaultDataflowContent, DEFAULT_PROGRAM_ZOOM, DataflowContentModel, DataflowContentModelSnapshotIn,
  DataflowContentModelType
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
import { addAttributeToDataSet, addCanonicalCasesToDataSet } from "../../../models/data/data-set";
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
  const r = setupContentWithLinkedTile("Table", "table1");
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

  it("names the dataset with the capture's start time", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture(new Date(2026, 9, 29, 14, 32, 7));
    expect(content.dataSet.name).toBe("Program data 14:32:07");
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

// A single sample puts rows in the table without being a recording. Deriving the program's mode
// from "the dataset has cases" made one sample flip the tile into Done -- playback shown, program
// read-only, the record button offering Clear -- which made single-sample capture unusable.
describe("hasRecordedRun", () => {
  it("stays false after single samples, so the program keeps running", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    recordCase(content);
    recordCase(content);
    expect(content.dataSet.cases).toHaveLength(2);
    expect(content.hasRecordedRun).toBe(false);
  });

  it("is true once a recording has been started", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    content.setRecordedRun(true);
    expect(content.hasRecordedRun).toBe(true);
  });

  it("goes back to false when the recording is reset", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.setRecordedRun(true);
    content.resetRecording();
    expect(content.hasRecordedRun).toBe(false);
  });

  // A document saved before the flag existed has no value for it, and its recording must still
  // open in Done rather than looking like a fresh program.
  it("falls back to the row count for a document saved before the flag existed", () => {
    const legacy = defaultDataflowContent();
    expect(legacy.recordedRun).toBeUndefined();
    expect(legacy.hasRecordedRun).toBe(false);

    // Rows with no flag is what a pre-flag saved recording looks like.
    addAttributeToDataSet(legacy.dataSet, { name: "Time (sec)" });
    addCanonicalCasesToDataSet(legacy.dataSet, [{ [legacy.dataSet.attributes[0].id]: 0 }]);
    expect(legacy.recordedRun).toBeUndefined();
    expect(legacy.hasRecordedRun).toBe(true);
  });
});

// One name shared by a node and its column, in both directions. A rename deliberately does not
// detach -- the columns still describe the program -- so without this the headers go stale.
describe("node and column name sync", () => {
  const columnNames = (content: DataflowContentModelType) =>
    content.dataSet.attributes.map(a => a.name);

  it("renames the column when the node is renamed", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();

    content.program.nodes.get("node-0")!.data.setOrderedDisplayName("Thermometer");

    expect(columnNames(content)).toEqual(["Point", "Thermometer", "Servo"]);
  });

  it("renames the node when the column is renamed", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();
    const servoAttr = content.dataSet.attributes[2];

    content.dataSet.setAttributeName(servoAttr.id, "Gripper");

    expect(content.program.nodes.get("node-1")!.data.orderedDisplayName).toBe("Gripper");
  });

  // Each direction writes only when the two differ, so the pair settles rather than ping-ponging.
  it("settles instead of looping when a name changes", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();

    content.program.nodes.get("node-0")!.data.setOrderedDisplayName("Thermometer");

    expect(columnNames(content)).toEqual(["Point", "Thermometer", "Servo"]);
    expect(content.program.nodes.get("node-0")!.data.orderedDisplayName).toBe("Thermometer");
  });

  // The point column carries no node id, and nothing should try to trace it to one.
  it("leaves the point column alone", () => {
    const content = setupContentWithTwoNamedNodes("Sensor", "Servo");
    content.prepareCapture();

    content.program.nodes.get("node-0")!.data.setOrderedDisplayName("Thermometer");

    expect(content.dataSet.attributes[0].name).toBe("Point");
  });

  // A capture the program no longer holds describes the old program, so renames must not reach it.
  it("does not touch a dataset the program has detached", () => {
    const { content, tableContent } = setupContentWithLinkedTable();
    const detachedTable = tableContent as any;
    content.prepareCapture();
    recordCase(content);
    const detachedNames = detachedTable.dataSet.attributes.map((a: any) => a.name);

    content.detachLinkedTables();
    content.program.nodes.get("node-0")?.data.setOrderedDisplayName("Thermometer");

    expect(detachedTable.dataSet.attributes.map((a: any) => a.name)).toEqual(detachedNames);
  });
});
