// abstract class Port {
//   type: string;
// }

// This interface is used as a map for the type system
export interface PortTypes {
  number: number;
  string: string;
  boolean: boolean;
}

// New types can be supported by redefining PortTypes with an additional
// type
export interface PortMap {
  [index: string]: { type: keyof PortTypes }
}

// This make the props readonly but that seems OK
export type DataParams<Type extends PortMap> = {
  [Property in keyof Type]: PortTypes[Type[Property]["type"]]
};

export interface Connection {
  nodeId: string,
  nodePort: string
}

type Connections<Type extends PortMap> = {
  -readonly [Property in keyof Type]?: Connection
};

export interface GNodeType {
  id: string;
  inputConnections?: Record<string, Connection | undefined>;
  data: (inputs: any) => unknown;
}

export abstract class GNode<Inputs extends PortMap | undefined, Outputs extends PortMap | undefined>
  implements GNodeType
{
  inputDefinitions: Inputs;
  outputDefinitions: Outputs;

  id: string;

  inputConnections: Inputs extends PortMap ? Connections<Inputs> : undefined;

  // Replace the "any" return type with
  abstract data(inputs: Inputs extends PortMap ? DataParams<Inputs> : undefined):
    Outputs extends PortMap ? DataParams<Outputs> : undefined;
}

// Common output type shared by many nodes
export const valueNodeOutputs = {
  value: { type: "number" }
} as const;

export type ValueNodeOutputsType = typeof valueNodeOutputs;

// Additional port types can in theory be added by re-opening the PortTypes interface
// Like this
// interface PortTypes {
//   newType: { special: string}
// }
//
// And then they can be referred to like this:
// const specialNodeInputs = {
//   a: { type: "newType" }
// } as const;
//
// And then DataParams will handle the correctly:
// type SpecialNodeDataParams = DataParams<typeof specialNodeInputs>;
//
// However Typescript won't let you re-open an interface that is imported.
// So this would work to let some other module add its own type to the core.
// In our case, it seems fine to have a fixed set of port types so it isn't
// necessary to solve this.
