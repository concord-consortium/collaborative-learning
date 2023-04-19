import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { InputValueControl } from "../controls/input-value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeLiveOutputTypes, NodeMicroBitHubs } from "../../model/utilities/node";
import { dataflowLogEvent } from "../../dataflow-logger";
import { NodeChannelInfo } from "../../model/utilities/channel";

interface HubStatus {
  id: string,
  missing: boolean
}

function getRelayMessageReceived(node: Node) {
  console.log("| given the node, can we determne if the relay state has been receieved?")
  return "(sent) or (received)";
}
export class LiveOutputReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Live Output", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      this.addInput(node, "nodeValue");
      node
        .addControl(new DropdownListControl(this.editor, "liveOutputType", node, NodeLiveOutputTypes, true))
        .addControl(new DropdownListControl(this.editor, "hubSelect", node, NodeMicroBitHubs, true));

      node.data.lastTick = Date.now();
      return node as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    // TODO & NOTE (CLAW) At the moment we take the input as soon as we can and send it to serial
    // this updates the value of the node and then the default NodeProcess takes the data
    // and sends it out via Serial.  It does not pass through any rete "output"
    const n1 = inputs.nodeValue.length ? inputs.nodeValue[0] : node.data.nodeValue;
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        this.updateHubsStatusReport(_node);

        // handle data and display of data
        const outputTypeControl = _node.controls.get("liveOutputType") as DropdownListControl;
        const outputType = outputTypeControl.getValue();
        const nodeValue = _node.inputs.get("nodeValue")?.control as InputValueControl;
        let newValue = isNaN(n1) ? 0 : n1;

        const binaryOutputTypes = ["Heat Lamp", "Fan", "Sprinkler", "Light Bulb"];
        const relayOutputTypes =  ["Heat Lamp", "Fan", "Sprinkler"]

        if (binaryOutputTypes.includes(outputType)){
          newValue = isNaN(n1) ? 0 : +(n1 !== 0);
          const offOnString = newValue === 0 ? "off" : "on";
          if (!relayOutputTypes.includes(outputType)) {
            nodeValue?.setDisplayMessage(offOnString);
          }
          // handle relay outputs, which are binarty but must also display if the relay state has been received
          else if (relayOutputTypes.includes(outputType)) {
            nodeValue?.setDisplayMessage(offOnString + " " + getRelayMessageReceived(_node));
          }
        }

        if (outputType === "Grabber"){
          newValue = this.getNewValueForGrabber(n1);
          const roundedDisplayValue = Math.round((newValue / 10) * 10);
          // Swap commented/uncommented below to change to display of nearest 1%
          // nodeValue?.setDisplayMessage(`${newValue}% closed`);
          nodeValue?.setDisplayMessage(`${roundedDisplayValue}% closed`);
        }

        nodeValue?.setValue(newValue);
        nodeValue?.setConnected(inputs.nodeValue.length);

        _node.data.outputType = outputType;
        this.editor.view.updateConnections( {node: _node} );
        _node.update();
      }
    }
  }

  private getNewValueForGrabber(num: number){
    if (num > 1)  return 100;
    if (num < 0)  return 0;
    return parseInt((num * 100).toFixed(2), 10);
  }

  private updateHubsStatusReport(n: Node){
    // use existing missing state information to figure out & display if hub is active
    const hubSelect = n.controls.get("hubSelect") as DropdownListControl;
    const hubStatusArray: HubStatus[] = hubSelect.getChannels()
      .filter((c: NodeChannelInfo) => c.type === "temperature" && c.deviceFamily === "microbit")
      .map((c: NodeChannelInfo) => {
        return { id: c.channelId.charAt(2), missing: c.missing};
      });

    hubStatusArray.forEach((s: HubStatus) => {
      // "active" is !missing
      hubSelect.setActiveOption(s.id, !s.missing);
    });
  }

  // TODO IMPROVEMENT - this is a duplicate method - abstract for all factories?
  private addInput(node: Node, inputKey: string, displayLabel = "") {
    if (this.editor) {
      const oldInput = node.inputs.get(inputKey);
      if (!oldInput) {
        const input = new Rete.Input(inputKey, "Number", this.numSocket);
        node.addInput(input);
        input.addControl(new InputValueControl(
          this.editor,
          inputKey,
          node,
          () => {
            node.data.plot = !node.data.plot;
            this.editor?.trigger("process");
            const toggleStr = node.data.plot ? "on" : "off";
            const tileId = node.meta.inTileWithId as string;
            dataflowLogEvent(`toggle minigraph ${toggleStr}`, node, tileId);
          },
          displayLabel,
          0, // Initial value
          `Display for ${inputKey}`,
          '', // Initial display message
          (node as any).data.watchedValues[inputKey].backgroundColor,
          (node as any).data.watchedValues[inputKey].borderColor,
          (val: any) => {
            return typeof val === "number" ? val : 1;
          }
        ));
      }
    }
  }

  private removeInput(node: Node, inputKey: string) {
    const input = node.inputs.get(inputKey);
    if (input && this.editor) {
      input.connections.slice().map(this.editor.removeConnection.bind(this.editor));
      node.removeInput(input);
    }
  }

}

