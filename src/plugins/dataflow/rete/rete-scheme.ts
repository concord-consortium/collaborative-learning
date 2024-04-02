import { ClassicPreset, GetSchemes } from "rete";
import { DataflowNode } from "rete-engine";
import { INumberControl } from "./controls/num-control";
import { ValueControl } from "./controls/value-control";
import { IDropdownListControl } from "./controls/dropdown-list-control";
import { ReactArea2D } from "rete-react-plugin";
import { PlotButtonControl } from "./controls/plot-button-control";
import { INumberUnitsControl } from "./controls/num-units-control";
import { DemoOutputControl } from "./controls/demo-output-control";

// Crazy Rete typing...
class NodeWithControls extends ClassicPreset.Node<
  { [key in string]: ClassicPreset.Socket },
  { [key in string]: ClassicPreset.Socket },
  {
    [key in string]:
      | INumberControl
      | INumberUnitsControl
      | ValueControl
      | IDropdownListControl
      | DemoOutputControl
      | PlotButtonControl
      | ClassicPreset.Control
      | ClassicPreset.InputControl<"number">
      | ClassicPreset.InputControl<"text">;
  }
> {}

type Node = NodeWithControls & DataflowNode;

// We might be better off using a pattern like this:
// type Node = NumberNode | MathNode;
// However that then breaks the look up the controls using
// instanceof because each control value gets the intersection
// of all of the control types, so then typescript thinks the first instanceof
// will match everything
class Connection<
  A extends Node,
  B extends Node
> extends ClassicPreset.Connection<A, B> {}

export type Schemes = GetSchemes<
  Node,
  Connection<Node, Node>
>;

export type AreaExtra = ReactArea2D<Schemes>;


// End of Crazy Rete typing....
