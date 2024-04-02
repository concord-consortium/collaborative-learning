import { ClassicPreset } from "rete";
import { Instance, types } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { ValueControl } from "../controls/value-control";
import { NodeDemoOutputTypes, NodePlotRed } from "../../model/utilities/node";
import { BaseNode, BaseNodeModel, NoOutputs } from "./base-node";
import { DropdownListControl, IDropdownListControl } from "../controls/dropdown-list-control";
import { PlotButtonControl } from "../controls/plot-button-control";
import { typeField } from "../../../../utilities/mst-utils";
import { INodeServices } from "../service-types";
import { MinigraphOptions } from "../../nodes/dataflow-node-plot";
import { DemoOutputControl } from "../controls/demo-output-control";

const tiltMinigraphOptions: MinigraphOptions = {
  backgroundColor: "#fff",
  borderColor: NodePlotRed
};

export const DemoOutputNodeModel = BaseNodeModel.named("DemoOutputNodeModel")
.props({
  type: typeField("Demo Output"),
  outputType: "Light Bulb",
  tilt: types.maybe(types.number)
})
.volatile(self =>  ({
  targetClosed: 0,
  currentClosed: 0,
  targetTilt: 0,
  currentTilt: 0,
  // lastTick hopefully can be handled by the tick function instead of being stored here
}))
.actions(self => ({
  setTilt(tilt: number) {
    self.tilt = tilt;
  },
  configureTilt() {
    if (self.outputType === "Advanced Grabber") {
      self.watchedValues.tilt = tiltMinigraphOptions;
    } else {
      self.tilt = undefined;
      delete self.watchedValues.tilt;
    }
  }
}))
.actions(self => ({
  afterCreate() {
    self.configureTilt();
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
    value: ValueControl,
    outputType: IDropdownListControl,
    demoOutput: DemoOutputControl,
    plotButton: PlotButtonControl
  },
  IDemoOutputNodeModel
> {
  demoOutputControl: DemoOutputControl;

  constructor(
    id: string | undefined,
    model: IDemoOutputNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    // TODO: this name is confusing because it matches the nodeValue in the model.
    // However if we are migrating existing data it will probably be helpful to
    // keep this input name the same.
    this.addInput("nodeValue", new ClassicPreset.Input(numSocket, "NodeValue"));

    const dropdownControl = new DropdownListControl(this, "outputType", NodeDemoOutputTypes);
    this.addControl("outputType", dropdownControl);

    const demoOutputControl = new DemoOutputControl(model);
    this.addControl("demoOutput", demoOutputControl);
    // TODO: add InputValueControl to the nodeValue input
  }

  private updateGrabberStuff() {
    this.model.configureTilt();
    if (this.model.outputType === "Advanced Grabber") {
      if (this.hasInput("tilt")) return;
      this.addInput("tilt", new ClassicPreset.Input(numSocket, "Tilt"));
      // Tell rete to re-draw the node since we changed our inputs
      this.services.update("node", this.id);
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
    value != null && this.model.setNodeValue(value);

    const tiltValue = tilt ? tilt[0] : null;
    tiltValue != null && this.model.setTilt(tiltValue);

    this.updateGrabberStuff();
    return {};
  }
}
