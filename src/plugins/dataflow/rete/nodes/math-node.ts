import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { ValueControl } from "../controls/value-control";
import { getNumDisplayStr } from "../../nodes/utilities/view-utilities";
import { NodeOperationTypes } from "../../model/utilities/node";
import { BaseNode, BaseNodeModel } from "./base-node";
import { DropdownListControl, IDropdownListControl } from "../controls/dropdown-list-control";
import { PlotButtonControl } from "../controls/plot-button-control";
import { typeField } from "../../../../utilities/mst-utils";
import { INodeServices } from "../node-services";

export const MathNodeModel = BaseNodeModel.named("MathNodeModel")
.props({
  type: typeField("Math"),
  mathOperator: "Add"
})
.actions(self => ({
  setMathOperator(val: string) {
    self.mathOperator = val;
  }
}));
export interface IMathNodeModel extends Instance<typeof MathNodeModel> {}

export class MathNode extends BaseNode<
  {
    num1: ClassicPreset.Socket,
    num2: ClassicPreset.Socket
  },
  {
    value: ClassicPreset.Socket
  },
  {
    value: ValueControl,
    mathOperator: IDropdownListControl,
    plotButton: PlotButtonControl
  },
  IMathNodeModel
> {
  valueControl: ValueControl;

  constructor(
    id: string | undefined,
    model: IMathNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    this.addInput("num1", new ClassicPreset.Input(numSocket, "Number1"));
    this.addInput("num2", new ClassicPreset.Input(numSocket, "Number2"));

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const dropdownOptions = NodeOperationTypes
    .filter((nodeOp) => {
      return nodeOp.type === "math";
    }).map((nodeOp) => {
      return { name: nodeOp.name, icon: nodeOp.icon };
    });
    const dropdownControl = new DropdownListControl(model,"mathOperator", services.process, dropdownOptions);
    this.addControl("mathOperator", dropdownControl);

    this.valueControl = new ValueControl("Math");
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(model));
  }

  getSentence(num1: number, num2: number, result: number) {
    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.mathOperator);
    if (nodeOperationTypes) {
      const n1Str = getNumDisplayStr(num1);
      const n2Str = getNumDisplayStr(num2);
      const resultStr = getNumDisplayStr(result);
      return nodeOperationTypes.numberSentence(n1Str, n2Str) + resultStr;
    } else {
      return "";
    }
  }

  data({num1, num2}: {num1?: number[], num2?: number[]}) {
    let result = 0;
    let resultSentence = "";

    const n1 = num1 ? num1[0] : NaN;
    const n2 = num2 ? num2[0] : NaN;


    // In v1 the inputs can be arrays not just single values this was probably
    // used to handle some kind of smoothing transform. The only block which might
    // use these previous values currently is the hold block which has a "previous value"
    // option. However it seems like that could be implemented by internally recording
    // the value.
    // The other place the previous values are shown is in the plot block.
    // The plot block could record these values internally also, so it seems like we
    // can keep it simple and just pass single values.

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.mathOperator);

    if (nodeOperationTypes) {
      if (isNaN(n1) || isNaN(n2)) {
        result = NaN;
      } else {
        // NaNs are for propagating lack of values.
        // Actual math errors like divide-by-zero should output 0.
        result = nodeOperationTypes.method(n1, n2);
      }

      resultSentence = this.getSentence(n1, n2, result);
    }

    // This nodeValue is used to record the recent values of the node
    this.model.setNodeValue(result);
    this.valueControl.setSentence(resultSentence);

    return { value: result };
  }
}
