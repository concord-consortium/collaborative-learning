import { buildCapabilityContext } from "./capability-context";
import { readCapabilityContext } from "../../../shared/fl-packet/capability-context";
import { projectDataflowTile } from "../../../shared/fl-packet/dataflow-tile";
import { NodeTypes } from "../../../shared/dataflow-node-types";
import { NodeLiveOutputTypes } from "../../plugins/dataflow/model/utilities/node";

const config = (settings: Record<string, unknown> = {}, toolbar = [{ id: "Dataflow" }]) => ({
  toolbar, getSetting: (key: string) => settings[key],
});

it("reports actual palette and Demo Servo before any tile exists; hidden Timer is not offered", () => {
  const value = buildCapabilityContext(config())!;
  expect(value.dataflow.node_palette).toEqual(NodeTypes.map(n => n.displayName));
  expect(value.dataflow.node_palette).not.toContain("Timer");
  expect(value.dataflow.demo_device_options).toContain("Servo");
  expect(value.dataflow.outputConfig).toEqual({ servoInputMode: "degrees",
    allowedOutputTypes: NodeLiveOutputTypes.map(n => n.name) });
  expect(value.dataflow.creation_tool_configured).toBe(true);
});

it("resolves proportion and restricted output choices using the product resolver", () => {
  expect(buildCapabilityContext(config({ servoInputMode: "proportion",
    liveOutputTypes: ["Servo", "missing", "Fan", "Servo"] }))!.dataflow.outputConfig)
    .toEqual({ servoInputMode: "proportion", allowedOutputTypes: ["Servo", "Fan"] });
});

it.each([undefined, [], ["missing"], "Servo", NodeLiveOutputTypes.map(n => n.name)])(
  "matches product fallback for live output configuration %j", liveOutputTypes => {
    expect(buildCapabilityContext(config({ liveOutputTypes, servoInputMode: "typo" }))!.dataflow.outputConfig)
      .toEqual(buildCapabilityContext(config())!.dataflow.outputConfig);
  });

it("distinguishes unloaded configuration from a known toolbar without Dataflow", () => {
  expect(buildCapabilityContext(undefined)).toBeUndefined();
  expect(buildCapabilityContext(config({}, []))!.dataflow.creation_tool_configured).toBe(false);
});

it("takes a detached snapshot and rejects malformed or policy-bearing capabilities", () => {
  const value = buildCapabilityContext(config())!;
  const copy = readCapabilityContext(value)!;
  value.dataflow.node_palette.pop();
  expect(copy.dataflow.node_palette).toHaveLength(NodeTypes.length);
  expect(readCapabilityContext({ ...value, answer_protection: {} })).toBeUndefined();
  expect(readCapabilityContext({ ...value, schema_version: "unknown" })).toBeUndefined();
  expect(readCapabilityContext({ ...value, dataflow: { ...value.dataflow, node_palette: [42] } })).toBeUndefined();
  expect(readCapabilityContext({ ...value, dataflow: { ...value.dataflow,
    outputConfig: { ...value.dataflow.outputConfig, servoInputMode: { toString: "bad" } } } })).toBeUndefined();
});

it("preserves a saved Timer and output mirror without turning either into palette availability", () => {
  const content = { type: "Dataflow", outputConfig: { servoInputMode: "proportion", allowedOutputTypes: ["Servo"] },
    program: { id: "p", nodes: { n: { id: "n", data: { type: "Timer", orderedDisplayName: "Timer 1" } } },
      connections: {} } };
  const tile = projectDataflowTile(content, "tile");
  expect(tile.content.nodes[0].type).toBe("Timer");
  expect(tile.content.outputConfig).toEqual(content.outputConfig);
  expect(buildCapabilityContext(config())!.dataflow.node_palette).not.toContain("Timer");
  delete (content as { outputConfig?: unknown }).outputConfig;
  expect(projectDataflowTile(content, "tile").content.outputConfig).toBeUndefined();
});
