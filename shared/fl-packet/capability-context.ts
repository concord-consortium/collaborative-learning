import { utf8ByteLength } from "../utf8-byte-length";

// Optional, current application facts. Absence means unknown, never an empty palette.
// Lists contain UI labels except allowedOutputTypes, which retains CLUE's internal names.
export interface CapabilityContext {
  schema_version: "clue.capability_context.v1";
  dataflow: {
    creation_tool_configured: boolean;
    node_palette: string[];
    demo_device_options: string[];
    outputConfig: { servoInputMode: "degrees" | "proportion"; allowedOutputTypes: string[] };
  };
}

export const kMaxCapabilityNames = 20;
export const kMaxCapabilityNameLength = 80;
export const kMaxCapabilityBytes = 4096;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: string[]) {
  return Object.keys(value).length === expected.length && expected.every(k => k in value);
}
function names(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= kMaxCapabilityNames &&
    value.every(v => typeof v === "string" && !!v.trim() && v.length <= kMaxCapabilityNameLength) &&
    new Set(value).size === value.length;
}

export function readCapabilityContext(value: unknown): CapabilityContext | undefined {
  if (!record(value) || !keys(value, ["schema_version", "dataflow"]) ||
      value.schema_version !== "clue.capability_context.v1") return undefined;
  const d = value.dataflow;
  if (!record(d) || !keys(d, ["creation_tool_configured", "node_palette", "demo_device_options", "outputConfig"]) ||
      typeof d.creation_tool_configured !== "boolean" || !names(d.node_palette) || !names(d.demo_device_options)) {
    return undefined;
  }
  const o = d.outputConfig;
  if (!record(o) || !keys(o, ["servoInputMode", "allowedOutputTypes"]) ||
      (o.servoInputMode !== "degrees" && o.servoInputMode !== "proportion") || !names(o.allowedOutputTypes)) {
    return undefined;
  }
  if (utf8ByteLength(JSON.stringify(value)) > kMaxCapabilityBytes) return undefined;
  return JSON.parse(JSON.stringify(value));
}
