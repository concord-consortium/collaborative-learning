import { getSnapshot } from "mobx-state-tree";
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
});
