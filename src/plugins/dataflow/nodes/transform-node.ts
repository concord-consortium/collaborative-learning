import { ClassicPreset } from "rete";
import { Instance, types } from "mobx-state-tree";
import { numSocket } from "./num-socket";
import { ValueControl } from "./controls/value-control";
import { getNumDisplayStr } from "./utilities/view-utilities";
import { NodeOperationTypes } from "../model/utilities/node";
import { BaseNode, BaseNodeModel, StringifiedNumber } from "./base-node";
import { DropdownListControl, IDropdownListControl } from "./controls/dropdown-list-control";
import { PlotButtonControl } from "./controls/plot-button-control";
import { typeField } from "../../../utilities/mst-utils";
import { INodeServices } from "./service-types";

export const TransformNodeModel = BaseNodeModel.named("TransformNodeModel")
.props({
  type: typeField("Transform"),
  transformOperator: "Absolute Value",

  // TODO: we'll have to deal with migrating this somehow, we might
  // need to run the process function once for imported dataflow tiles
  // so these inputs get saved
  num1: types.maybe(StringifiedNumber),
})
.actions(self => ({
  setTransformOperator(val: string) {
    self.transformOperator = val;
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
    const dropdownControl = new DropdownListControl(this, "transformOperator", dropdownOptions);
    this.addControl("transformOperator", dropdownControl);

    this.valueControl = new ValueControl("Transform", this.getSentence);
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  getSentence = () => {
    const result = this.model.nodeValue;
    const { num1 } = this.model;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.transformOperator);
    if (nodeOperationTypes) {
      const n1Str = getNumDisplayStr(num1);
      const resultStr = getNumDisplayStr(result);
      return nodeOperationTypes.numberSentence(n1Str, "") + resultStr;
    } else {
      return "";
    }
  };

  data({num1}: {num1?: number[]}) {
    let result = 0;

    const n1 = num1 ? num1[0] : NaN;

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
    }

    // TODO: we should try to wrap these data functions in an action so all of their
    // changes are grouped together.

    // The input numbers are saved so readOnly views can display the sentence
    this.model.setNum1(n1);

    // This nodeValue is used to record the recent values of the node
    this.model.setNodeValue(result);

    return { value: result };
  }

  onTick() {
    if (this.model.transformOperator === "Ramp") {
      // If we are "ramping", we need to reprocess on every tick so the values can update
      // Probably we should go further and move the ramp logic into onTick.
      // If the program sampling rate is really slow and the user changes connections or
      // values in another node that causes a reprocess that will cause the ramped value
      // to change outside of the tick
      return true;
    }
    return false;
  }
}
