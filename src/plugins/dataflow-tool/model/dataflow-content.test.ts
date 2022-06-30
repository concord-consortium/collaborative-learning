import { getSnapshot } from "mobx-state-tree";
import { DataflowContentModel, DEFAULT_PROGRAM_ZOOM } from "./dataflow-content";
import { exampleProgram, newDataRate, newZoom } from "./dataflow-content-test-constants";
import { DEFAULT_DATA_RATE } from "./utilities/node";

describe("DataflowContentModel", () => {
  it("should have correct defaults", () => {
    const dcm = DataflowContentModel.create();
    expect(dcm.isUserResizable).toBe(true);
    expect(dcm.programDataRate).toBe(DEFAULT_DATA_RATE);
    expect(dcm.programZoom.dx).toBe(DEFAULT_PROGRAM_ZOOM.dx);
    expect(dcm.programZoom.dy).toBe(DEFAULT_PROGRAM_ZOOM.dy);
    expect(dcm.programZoom.scale).toBe(DEFAULT_PROGRAM_ZOOM.scale);
    expect(Object.values(getSnapshot(dcm.program.nodes)).length).toBe(0);
  });

  it("should handle basic changes", () => {
    const dcm = DataflowContentModel.create();
    dcm.setProgramDataRate(newDataRate);
    dcm.setProgramZoom(newZoom.dx, newZoom.dy, newZoom.scale);
    expect(dcm.programDataRate).toBe(newDataRate);
    expect(dcm.programZoom.dx).toBe(newZoom.dx);
    expect(dcm.programZoom.dy).toBe(newZoom.dy);
    expect(dcm.programZoom.scale).toBe(newZoom.scale);
  });

  it("should be able to import rete programs", () => {
    const dcm = DataflowContentModel.create();
    expect(Object.values(getSnapshot(dcm.program.nodes)).length).toBe(0);
    dcm.setProgram(JSON.parse(exampleProgram));
    const nodes = getSnapshot(dcm.program.nodes);
    expect(Object.values(nodes).length).toBe(4);
    expect(nodes["1"].data.generatorType).toBe("Sine");
    expect(nodes["1"].position[0]).toBe(40);
    expect(nodes["5"].data.recentValues.length).toBe(17);
    expect(Object.values(nodes["14"].inputs).filter((socket: any) => socket.connections.length > 0).length).toBe(2);
  });
});
