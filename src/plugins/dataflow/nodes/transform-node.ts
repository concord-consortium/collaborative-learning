import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "./num-socket";
import { ValueControl } from "./controls/value-control";
import { getNumDisplayStr } from "./utilities/view-utilities";
import { NodeOperationTypes } from "../model/utilities/node";
import { BaseNode, BaseNodeModel } from "./base-node";
import { DropdownListControl, IDropdownListControl } from "./controls/dropdown-list-control";
import { PlotButtonControl } from "./controls/plot-button-control";
import { typeField } from "../../../utilities/mst-utils";
import { INodeServices } from "./service-types";

export const TransformNodeModel = BaseNodeModel.named("TransformNodeModel")
.props({
  type: typeField("Transform"),
  transformOperator: "Absolute Value",
})
.volatile(self => ({
  num1: NaN,
}))
.actions(self => ({
  setTransformOperator(val: string) {
    self.transformOperator = val;
    // When the transformOperator changes we want to update all of the
    // downstream nodes
    self.process();
  },
  setNum1(val: number) {
    self.num1 = val;
  }
}));
export interface ITransformNodeModel extends Instance<typeof TransformNodeModel> {}

export class TransformNode extends BaseNode<
  {
    num1: ClassicPreset.Socket,
  },
  {
    value: ClassicPreset.Socket
  },
  {
    value: ValueControl,
    transformOperator: IDropdownListControl,
    plotButton: PlotButtonControl
  },
  ITransformNodeModel
> {
  valueControl: ValueControl;

  constructor(
    id: string | undefined,
    model: ITransformNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    this.addInput("num1", new ClassicPreset.Input(numSocket, "Number1"));

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const dropdownOptions = NodeOperationTypes
    .filter((nodeOp) => {
      return nodeOp.type === "transform";
    }).map((nodeOp) => {
      return { name: nodeOp.name, icon: nodeOp.icon };
    });
    const dropdownControl =
      new DropdownListControl(this, "transformOperator", model.setTransformOperator, dropdownOptions);
    this.addControl("transformOperator", dropdownControl);

    this.valueControl = new ValueControl("Transform", this.getSentence);
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  getSentence = () => {
    const result = this.model.nodeValue;
    const resultStr = getNumDisplayStr(result);

    const { num1 } = this.model;
    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.transformOperator);
    if (nodeOperationTypes) {
      const n1Str = getNumDisplayStr(num1);
      return nodeOperationTypes.numberSentence(n1Str, "") + resultStr;
    } else {
      return "";
    }
  };

  data({num1}: {num1?: number[]}) {
    let result = 0;

    const n1 = num1 ? num1[0] : NaN;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.transformOperator);

    // FIXME: The "ramp" transform runs on every `data` call, not just the `ticks`.
    // This is consistent with the previous implementation, but it means that it
    // doesn't work properly when the diagram is reprocessed not for a tick.
    // For example a number node is changed. This could be fixed by including
    // the time elapsed since the prevValue. Or we could change it to only change
    // the ramp value during a tick.
    if (nodeOperationTypes) {
      if (isNaN(n1)) {
        result = NaN;
      } else {
        // NaNs are for propagating lack of values.
        // Actual math errors like divide-by-zero should output 0.
        const recents = this.model.recentValues.get("nodeValue");
        const prevValue = recents && recents.length > 1 ? recents[recents.length - 1] : undefined;

        // prevValue might be null, and nodeOperationTypes doesn't handle that
        result = nodeOperationTypes.method(n1, 0, prevValue ?? undefined);
      }
    }

    // The input numbers are saved so readOnly views can display the sentence
    this.model.setNum1(n1);

    // This nodeValue is used to record the recent values of the node
    this.saveNodeValue(result);

    return { value: result };
  }
}
