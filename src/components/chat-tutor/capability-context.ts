import { NodeTypes } from "../../../shared/dataflow-node-types";
import { CapabilityContext, readCapabilityContext } from "../../../shared/fl-packet/capability-context";
import { NodeDemoOutputTypes, NodeLiveOutputTypes, resolveAllowedOutputTypes }
  from "../../plugins/dataflow/model/utilities/node";

interface CapabilityConfig {
  toolbar: ReadonlyArray<{ id: string }>;
  getSetting(name: string, group: string): unknown;
}

// Same palette, choices and resolver as the actual product. No document is needed.
// A configured tile tool is not proof of edit permission, free tile capacity or connected hardware.
export function buildCapabilityContext(config?: CapabilityConfig): CapabilityContext | undefined {
  if (!config) return undefined;
  return readCapabilityContext({
    schema_version: "clue.capability_context.v1",
    dataflow: {
      creation_tool_configured: config.toolbar.some(tool => tool.id === "Dataflow"),
      node_palette: NodeTypes.map(type => type.displayName),
      demo_device_options: NodeDemoOutputTypes.map(type => "displayName" in type ? type.displayName : type.name),
      outputConfig: {
        servoInputMode: config.getSetting("servoInputMode", "dataflow") === "proportion" ? "proportion" : "degrees",
        allowedOutputTypes: resolveAllowedOutputTypes(config.getSetting("liveOutputTypes", "dataflow")) ??
          NodeLiveOutputTypes.map(type => type.name),
      },
    },
  });
}
