import * as React from "react";
import { Node, Socket, Control } from "rete-react-render-plugin";
import { DataflowNodePlot } from "./dataflow-node-plot";
import { NodeType, NodeTypes } from "../../utilities/node";
import "./dataflow-node.sass";

export class DataflowNode extends Node {

  public render() {
    const { node, bindSocket, bindControl } = this.props;
    const { outputs, controls, inputs } = this.state;

    const settingsControls = controls.filter(isSettingControl);
    const outputControls = controls.filter(isOutputControl);
    const deleteControls = controls.filter(isDeleteControl);
    const deleteControl = deleteControls && deleteControls.length ? deleteControls[0] : null;

    const undecoratedInputs = inputs.filter(isDecoratedInput(false));
    const decoratedInputs = inputs.filter(isDecoratedInput(true));

    const plotButton = controls.find((c: any) => c.key === "plot");
    const showPlot = plotButton ? plotButton.props.showgraph : false;
    const nodeType = NodeTypes.find( (n: NodeType) => n.name === node.name);
    const displayName = nodeType ? nodeType.displayName : node.name;

    return (
      <div className={`node ${node.name.toLowerCase().replace(/ /g, "-")}`}>
        <div className="top-bar">
          <div className="node-title">
            {displayName}
          </div>
          {deleteControl &&
            <Control
              className="control"
              key={deleteControl.key}
              control={deleteControl}
              innerRef={bindControl}
            />
          }
        </div>
        {settingsControls.map((control: any) => (
          <Control
            className="control"
            key={control.key}
            control={control}
            innerRef={bindControl}
          />
        ))}
        {settingsControls.length > 0 &&
          <div className="hr control-color" />
        }
        <div className="inputs-outputs">
          <div className="inputs">
            {undecoratedInputs.map((input: any) => (
              <div className="input" key={input.key}>
                <Socket
                  type="input"
                  socket={input.socket}
                  io={input}
                  innerRef={bindSocket}
                />
              </div>
            ))}
          </div>
          <div className="output-controls">
            <div className={`output-container ${node.name.toLowerCase().replace(/ /g, "-")}`}>
              {outputControls.map((control: any) => (
                <Control
                  className="control"
                  key={control.key}
                  control={control}
                  innerRef={bindControl}
                />
              ))}
            </div>
          </div>
          <div className="outputs">
            {outputs.map((output: any) => (
              <div className="node-output output" key={output.key}>
                <Socket
                  type="output"
                  socket={output.socket}
                  io={output}
                  innerRef={bindSocket}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="decorated-inputs">
          {decoratedInputs.map((input: any) => (
            <div className="input" key={input.key}>
              <Socket
                type="input"
                socket={input.socket}
                io={input}
                innerRef={bindSocket}
              />
              <Control
                className="input-control"
                control={input.control}
                key={input.control.key}
                innerRef={bindControl}
              />
            </div>
          ))}
        </div>
        <DataflowNodePlot
          display={showPlot}
          data={node}
        />
      </div>
    );
  }
}

// all controls that are not the readouts of data (outputs) or delete
function isSettingControl(control: any) {
  return control.key !== "plot" && control.key !== "nodeValue" && control.key !== "delete";
}

function isOutputControl(control: any) {
  return control.key === "plot" || control.key === "nodeValue";
}

function isDeleteControl(control: any) {
  return control.key === "delete";
}

function isDecoratedInput(isDecorated: boolean) {
  return (input: any) => !!input.control === isDecorated;
}
