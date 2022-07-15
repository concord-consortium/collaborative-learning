import React from "react";
import Rete, { NodeEditor, Node } from "rete";
import { lightBulbOn, lightBulbOff, backyardClawFrames, grabberPaddle, grabberClawFrames, grabberChordFrames } from "./demo-output-control-assets";

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
      const controlClassName = compProps.type === "Light Bulb" ? "lightbulb-control" : compProps.type === "Backyard Claw" ? "backyard-claw-control" : "grabber-control";
      let percentOpen = compProps.value;
      percentOpen = Math.min(1, percentOpen);
      percentOpen = Math.max(0, percentOpen);
      const frame = percentOpen < 1 ? Math.floor(grabberClawFrames.length * percentOpen) :  grabberClawFrames.length - 1;
      return (
        <div className={`demo-output-control ${controlClassName}`}>
          {compProps.type === "Light Bulb"
            ? <img src={ compProps.value ? lightBulbOn : lightBulbOff } className="demo-output-image lightbulb-image" />
            : compProps.type === "Backyard Claw"
            ? <img src={ backyardClawFrames[frame] } className="demo-output-image backyard-claw-image" />
            : <>
              <img src={ grabberPaddle } className="demo-output-image grabber-paddle-image" />
              <img src={ grabberClawFrames[frame] } className="demo-output-image grabber-claw-image" />
              </>
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
