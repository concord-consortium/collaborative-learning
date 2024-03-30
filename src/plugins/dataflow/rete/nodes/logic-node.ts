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
import { INodeServices } from "../service-types";

export const LogicNodeModel = BaseNodeModel.named("LogicNodeModel")
.props({
  type: typeField("Logic"),
  logicOperator: "Greater Than"
})
.actions(self => ({
  setLogicOperator(val: string) {
    self.logicOperator = val;
  }
}));
export interface ILogicNodeModel extends Instance<typeof LogicNodeModel> {}

export class LogicNode extends BaseNode<
  {
    num1: ClassicPreset.Socket,
    num2: ClassicPreset.Socket
  },
  {
    value: ClassicPreset.Socket
  },
  {
    value: ValueControl,
    logicOperator: IDropdownListControl,
    plotButton: PlotButtonControl
  },
  ILogicNodeModel
> {
  valueControl: ValueControl;

  constructor(
    id: string | undefined,
    model: ILogicNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    this.addInput("num1", new ClassicPreset.Input(numSocket, "Number1"));
    this.addInput("num2", new ClassicPreset.Input(numSocket, "Number2"));

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const dropdownOptions = NodeOperationTypes
    .filter((nodeOp) => {
      return nodeOp.type === "logic";
    }).map((nodeOp) => {
      return { name: nodeOp.name, icon: nodeOp.icon };
    });
    const dropdownControl = new DropdownListControl(this, "logicOperator", dropdownOptions);
    this.addControl("logicOperator", dropdownControl);

    this.valueControl = new ValueControl("Logic");
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  getSentence(num1: number, num2: number, result: number) {
    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.logicOperator);
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

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.logicOperator);

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
