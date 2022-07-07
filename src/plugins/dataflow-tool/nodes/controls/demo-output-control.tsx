import React from "react";
import Rete, { NodeEditor, Node } from "rete";
import bulbOn from "../../assets/lightbulb-on.png";
import bulbOff from "../../assets/lightbulb-off.png";
import clawOpen from "../../assets/claw-open.png";
import clawClosed from "../../assets/claw-closed.png";
import "./demo-output-control.scss";

export class DemoOutputControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  private node: Node;

  constructor(emitter: NodeEditor, key: string, node: Node) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.node = node;

    this.component = (compProps: {value: number, type: string}) => {
      const controlClassName = compProps.type === "Light Bulb" ? "lightbulb-control" : "backyard-claw-control";
      return (
        <div className={`demo-output-control ${controlClassName}`}>
          {compProps.type === "Light Bulb"
            ? <img src={ compProps.value ? bulbOn : bulbOff } className="demo-output-image lightbulb-image" />
            : <img src={ compProps.value ? clawOpen : clawClosed } className="demo-output-image backyard-claw-image" />
          }
        </div>
      );
    };

    const initial = node.data[key] || 0;
    node.data[key] = initial;

    const initialType = "Light Bulb";

    this.props = {
      value: initial,
      type: initialType
    };
  }

  public setValue = (val: number) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  };

  public setOutputType = (type: string) => {
    this.props.type = type;
    (this as any).update();
  };
}
