import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "./num-socket";
import { NodeDemoOutputTypes, NodePlotRed, kBinaryOutputTypes } from "../model/utilities/node";
import { BaseNode, BaseNodeModel, NoOutputs } from "./base-node";
import { DropdownListControl, IDropdownListControl } from "./controls/dropdown-list-control";
import { typeField } from "../../../utilities/mst-utils";
import { INodeServices } from "./service-types";
import { MinigraphOptions } from "./dataflow-node-plot";
import { DemoOutputControl } from "./controls/demo-output-control";
import { IInputValueControl, InputValueControl } from "./controls/input-value-control";

const tiltMinigraphOptions: MinigraphOptions = {
  backgroundColor: "#fff",
  borderColor: NodePlotRed
};

export const DemoOutputNodeModel = BaseNodeModel.named("DemoOutputNodeModel")
.props({
  type: typeField("Demo Output"),
  outputType: "Light Bulb",
  // Initialize tilt to 0 whether we use it or not
  tilt: 0
})
.volatile(self =>  ({
  targetClosed: 0,
  currentClosed: 0,
  targetTilt: 0,
  currentTilt: 0,
  // lastTick hopefully can be handled by the tick function instead of being stored here
}))
.actions(self => ({
  setTilt(tilt: number | null | undefined) {
    if (self.outputType === "Advanced Grabber") {
      if (tilt != null && (tilt === 1 || tilt === 0 || tilt === -1)) {
        // Only update the tilt if it is a legal value: 1, 0, -1
        self.tilt = tilt;
      }
      self.watchedValues.tilt = tiltMinigraphOptions;
    } else {
      delete self.watchedValues.tilt;
    }
  }
}))
.actions(self => ({
  afterCreate() {
    self.setTilt(self.tilt);
  },
  setOutputType(val: string) {
    self.outputType = val;
  }
}));
export interface IDemoOutputNodeModel extends Instance<typeof DemoOutputNodeModel> {}

export class DemoOutputNode extends BaseNode<
  {
    nodeValue: ClassicPreset.Socket,
    tilt: ClassicPreset.Socket
  },
  NoOutputs,
  {
    outputType: IDropdownListControl,
    demoOutput: DemoOutputControl
  },
  IDemoOutputNodeModel
> {
  demoOutputControl: DemoOutputControl;
  inputValueControl: IInputValueControl;
  inputTiltControl?: IInputValueControl;

  constructor(
    id: string | undefined,
    model: IDemoOutputNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    const nodeValueInput = new ClassicPreset.Input(numSocket, "NodeValue");
    this.addInput("nodeValue", nodeValueInput);

    // Copy the types so typescript doesn't complain that they are readonly
    const outputTypes = [...NodeDemoOutputTypes];
    const dropdownControl = new DropdownListControl(this, "outputType", outputTypes);
    this.addControl("outputType", dropdownControl);

    const demoOutputControl = new DemoOutputControl(model);
    this.addControl("demoOutput", demoOutputControl);

    this.inputValueControl = new InputValueControl(this, "nodeValue", "", "Display for nodeValue");
    nodeValueInput.addControl(this.inputValueControl);
  }

  private updateTilt(tiltValue: number | null) {
    this.model.setTilt(tiltValue);
    if (this.model.outputType === "Advanced Grabber") {
      if (!this.hasInput("tilt")) {
        const tiltInput = new ClassicPreset.Input(numSocket, "Tilt");
        this.addInput("tilt", tiltInput);

        this.inputTiltControl = new InputValueControl(this, "tilt", "tilt:", "Display for tilt");
        tiltInput.addControl(this.inputTiltControl);

        // Tell rete to re-draw the node since we changed our inputs
        this.services.update("node", this.id);
      }
      const { tilt } = this.model;
      const tiltWord = tilt === 1 ? "up" : tilt === -1 ? "down" : "center";
      this.inputTiltControl?.setDisplayMessage(tiltWord);
    } else {
      if (!this.hasInput("tilt")) return;

      // Make sure we don't have any connections
      this.services.removeInputConnection(this.id, "tilt");
      this.removeInput("tilt");
      // Tell rete to re-draw the node since we changed our inputs
      this.services.update("node", this.id);
    }
  }

  data({nodeValue, tilt}: {nodeValue?: number[], tilt?: number[]}) {
    // TODO: we should put this in a MobX transaction so it only triggers
    // one render.
    const value = nodeValue ? nodeValue[0] : null;
    if (kBinaryOutputTypes.includes(this.model.outputType)) {
      // if there is not a valid input, use 0
      // otherwise convert all non-zero to 1
      const newValue = (value == null || isNaN(value)) ? 0 : +(value !== 0);
      this.model.setNodeValue(newValue);
      this.inputValueControl.setDisplayMessage(newValue === 0 ? "off" : "on");
    } else {
      // Clamp the value between 0 and 1
      const newValue = (value == null) ? 0 : Math.max(0, Math.min(1, value));
      this.model.setNodeValue(newValue);
      const hundredPercentClosed = Math.round(newValue * 10) * 10;
      this.inputValueControl.setDisplayMessage(`${hundredPercentClosed}% closed`);
    }

    const tiltValue = tilt ? tilt[0] : null;
    this.updateTilt(tiltValue);
    return {};
  }
}
