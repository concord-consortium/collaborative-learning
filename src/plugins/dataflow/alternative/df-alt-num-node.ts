import { GNode, ValueNodeOutputsType, valueNodeOutputs } from "./df-alt-core";

export class ValueNode extends GNode<undefined, ValueNodeOutputsType > {
  public outputDefinitions = valueNodeOutputs;

  data() {
    return { value: 1} ;
  }
}
