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

export const LogicNodeModel = BaseNodeModel.named("LogicNodeModel")
.props({
  type: typeField("Logic"),
  logicOperator: "Greater Than",
})
.volatile(self => ({
  num1: NaN,
  num2: NaN,
})).actions(self => ({
  setLogicOperator(val: string) {
    self.logicOperator = val;
    // When the logic operator changes we need to update all of the downstream nodes
    self.process();
  },
  setNum1(val: number) {
    self.num1 = val;
  },
  setNum2(val: number) {
    self.num2 = val;
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
    const dropdownControl = new DropdownListControl(this, "logicOperator", model.setLogicOperator, dropdownOptions);
    this.addControl("logicOperator", dropdownControl);

    this.valueControl = new ValueControl("Logic", this.getSentence);
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  getSentence = () => {
    const result = this.model.nodeValue;
    const resultStr = getNumDisplayStr(result);

    const { num1, num2 } = this.model;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.logicOperator);
    if (nodeOperationTypes) {
      const n1Str = getNumDisplayStr(num1);
      const n2Str = getNumDisplayStr(num2);
      return nodeOperationTypes.numberSentence(n1Str, n2Str) + resultStr;
    } else {
      return "";
    }
  };

  data({num1, num2}: {num1?: number[], num2?: number[]}) {
    let result = 0;

    const n1 = num1 ? num1[0] : NaN;
    const n2 = num2 ? num2[0] : NaN;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === this.model.logicOperator);

    if (nodeOperationTypes) {
      if (isNaN(n1) || isNaN(n2)) {
        result = NaN;
      } else {
        // NaNs are for propagating lack of values.
        // Actual math errors like divide-by-zero should output 0.
        result = nodeOperationTypes.method(n1, n2);
      }
    }

    // The input numbers are saved so readOnly views can display the sentence
    this.model.setNum1(n1);
    this.model.setNum2(n2);

    // This nodeValue is used to record the recent values of the node
    this.saveNodeValue(result);

    return { value: result };
  }
}
