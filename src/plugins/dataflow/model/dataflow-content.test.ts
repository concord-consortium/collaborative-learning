import { applyPatch, getSnapshot, unprotect } from "mobx-state-tree";
import {
  defaultDataflowContent, DEFAULT_PROGRAM_ZOOM, DataflowContentModel, DataflowContentModelSnapshotIn
} from "./dataflow-content";
import { newDataRate, newZoom } from "./dataflow-content-test-constants";
import dataflowThreeNode from "../test-docs/dataflow-1-three-node.json";
import { DEFAULT_DATA_RATE } from "./utilities/node";
import { IGeneratorNodeModel } from "../nodes/generator-node";
import { INumberNodeModel } from "../nodes/number-node";
import { IDemoOutputNodeModel } from "../nodes/demo-output-node";

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
    // a whole document + SharedModelDocumentManager. The real wiring is covered by the Cypress
    // spec in Task 7.
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
