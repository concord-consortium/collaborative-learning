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
  transformOperator: "Absolute Value"
})
.actions(self => ({
  setTransformOperator(val: string) {
    self.transformOperator = val;
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
    const dropdownControl = new DropdownListControl(this, "transformOperator", dropdownOptions);
    this.addControl("transformOperator", dropdownControl);

    this.valueControl = new ValueControl("Math");
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  getSentence(num1: number, result: number) {
    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.transformOperator);
    if (nodeOperationTypes) {
      const n1Str = getNumDisplayStr(num1);
      const resultStr = getNumDisplayStr(result);
      return nodeOperationTypes.numberSentence(n1Str, "") + resultStr;
    } else {
      return "";
    }
  }

  data({num1}: {num1?: number[]}) {
    let result = 0;
    let resultSentence = "";

    const n1 = num1 ? num1[0] : NaN;

    // In v1 the inputs can be arrays not just single values this was probably
    // used to handle some kind of smoothing transform. The only block which might
    // use these previous values currently is the hold block which has a "previous value"
    // option. However it seems like that could be implemented by internally recording
    // the value.
    // The other place the previous values are shown is in the plot block.
    // The plot block could record these values internally also, so it seems like we
    // can keep it simple and just pass single values.

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.transformOperator);

    // FIXME: The "ramp" transform runs on each `data` call, not each `tick`.
    // This is consistent with the previous implementation, but it means that it
    // doesn't work properly in all cases
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

      resultSentence = this.getSentence(n1, result);
    }

    // This nodeValue is used to record the recent values of the node
    this.model.setNodeValue(result);
    this.valueControl.setSentence(resultSentence);

    return { value: result };
  }
}
