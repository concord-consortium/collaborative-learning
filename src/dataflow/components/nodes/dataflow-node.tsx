import * as React from "react";
import { Node, Socket, Control } from "rete-react-render-plugin";
import "./dataflow-node.sass";

export class DataflowNode extends Node {
  public render() {
    const { node, bindSocket, bindControl } = this.props;
    const { outputs, controls, inputs, selected } = this.state;

    return (
      <div className={`node ${selected} ${node.name.toLowerCase().replace(/ /g, "-")}`}>
        <div className="node-title">
          {node.name}
        </div>
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
        {controls.map((control: any) => (
          <Control
            className="control"
            key={control.key}
            control={control}
            innerRef={bindControl}
          />
        ))}
        {inputs.map((input: any) => (
          <div className="input" key={input.key}>
            <Socket
              type="input"
              socket={input.socket}
              io={input}
              innerRef={bindSocket}
            />
            {(!input.showControl() && input.name !== "sequence") && (
              <div className="input-title">{input.name}</div>
            )}
            {(input.showControl() || input.name === "sequence") && (
              <Control
                className="input-control"
                control={input.control}
                innerRef={bindControl}
              />
            )}
          </div>
        ))}
      </div>
    );
  }
}
