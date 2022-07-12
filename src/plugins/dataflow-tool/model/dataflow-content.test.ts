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

  it("should handle run time changes", () => {
    const dcm = defaultDataflowContent();
    const [runId, startTime1, endTime1, startTime2, endTime2] = ['testid', 10, 30, 25, 50];
    dcm.setProgramRunId(runId);
    expect(dcm.programRunId).toBe(runId);
    dcm.setProgramStartTime(startTime1);
    expect(dcm.programStartTime).toBe(startTime1);
    dcm.setProgramEndTime(endTime1);
    expect(dcm.programEndTime).toBe(endTime1);
    dcm.setProgramStartEndTime(startTime2, endTime2);
    expect(dcm.programStartTime).toBe(startTime2);
    expect(dcm.programEndTime).toBe(endTime2);
    const later = Date.now() + 10000;
    dcm.setRunningStatus(later);
    expect(dcm.programIsRunning).toBe("true");
    const past = Date.now() - 1000;
    dcm.setRunningStatus(past);
    expect(dcm.programIsRunning).toBe("");
  });

  it("should be able to import rete programs", () => {
    const dcm = defaultDataflowContent();
    expect(Object.values(getSnapshot(dcm.program.nodes)).length).toBe(0);
    dcm.setProgram(JSON.parse(exampleProgram));
    const { nodes } = dcm.program.snapshotForRete;
    expect(Object.values(nodes).length).toBe(4);
    expect(nodes["1"].data.generatorType).toBe("Sine");
    expect(nodes["1"].position[0]).toBe(40);
    expect(nodes["5"].data.recentValues.length).toBe(17);
    expect(Object.values(nodes["14"].inputs).filter((socket: any) => socket.connections.length > 0).length).toBe(2);
  });
});
