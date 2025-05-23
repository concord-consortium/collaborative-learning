import { DataParams, GNode, ValueNodeOutputsType, valueNodeOutputs } from "./df-alt-core";

// This *can't* be typed with:
// const sumNodeInputs: PortMap = { ... }
// If it is, then `typeof sumNodeInputs` returns PortMap instead of the literal.
// DataParams needs the literal so it can generate the type.
// The `as const` at the end tells TS to make the whole object a literal not just
// top level keys.
// This means that the runtime definition can't be enforced at definition
// time, but when it is used in DataParams the type is enforced.
const sumNodeInputs = {
  left: { type: "number" },
  right: { type: "number" },
} as const;

// This creates an type of
// { left: number, right: number }
type SumNodeDataParams = DataParams<typeof sumNodeInputs>;

export class SumNode extends GNode<typeof sumNodeInputs, ValueNodeOutputsType> {
  public inputDefinitions = sumNodeInputs;
  public outputDefinitions = valueNodeOutputs;

  // I'm not sure why the `: SumNodeDataParams` is necessary here it should be picked up
  // from the generic abstract class
  data({left, right}: SumNodeDataParams) {
    return { value: (left + right) };
  }
}
