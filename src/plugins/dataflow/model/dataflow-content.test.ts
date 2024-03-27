import { getSnapshot } from "mobx-state-tree";
import { defaultDataflowContent, DEFAULT_PROGRAM_ZOOM } from "./dataflow-content";
import { exampleProgram, newDataRate, newZoom } from "./dataflow-content-test-constants";
import { DEFAULT_DATA_RATE } from "./utilities/node";

describe("DataflowContentModel", () => {
  it("should have correct defaults", () => {
    const dcm = defaultDataflowContent();
    expect(dcm.isUserResizable).toBe(true);
    expect(dcm.programDataRate).toBe(DEFAULT_DATA_RATE);
    expect(dcm.programZoom.dx).toBe(DEFAULT_PROGRAM_ZOOM.dx);
    expect(dcm.programZoom.dy).toBe(DEFAULT_PROGRAM_ZOOM.dy);
    expect(dcm.programZoom.scale).toBe(DEFAULT_PROGRAM_ZOOM.scale);
    expect(Object.values(getSnapshot(dcm.program.nodes)).length).toBe(0);
  });

  it("should handle basic changes", () => {
    const dcm = defaultDataflowContent();
    dcm.setProgramDataRate(newDataRate);
    dcm.setProgramZoom(newZoom.dx, newZoom.dy, newZoom.scale);
    expect(dcm.programDataRate).toBe(newDataRate);
    expect(dcm.programZoom.dx).toBe(newZoom.dx);
    expect(dcm.programZoom.dy).toBe(newZoom.dy);
    expect(dcm.programZoom.scale).toBe(newZoom.scale);
  });

  it("should be able to export proper json", () => {
    const dcm = defaultDataflowContent();
    dcm.setProgram(JSON.parse(exampleProgram));
    const jsonString = dcm.exportJson();
    const exportedJson = JSON.parse(jsonString);
    expect(exportedJson.programDataRate).toBe(1000);
    expect(exportedJson.programZoom.dx).toBe(0);
    const { nodes, values } = exportedJson.program;
    expect(Object.values(nodes).length).toBe(4);
    expect(nodes["114"].data.generatorType).toBe("Sine");
    expect(nodes["114"].x).toBe(40);
    expect(values["121"].recentValues).toBeUndefined();
    expect(Object.values(nodes["135"].inputs).filter(
      (socket: any) => Object.keys(socket.connections).length > 0).length).toBe(3);
  });
});
