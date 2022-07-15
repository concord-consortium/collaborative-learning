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

    this.component = (compProps: {value: number, percentOpen: number, percentTilt: number, type: string}) => {
      const controlClassName = compProps.type === "Light Bulb" ? "lightbulb-control" : compProps.type === "Backyard Claw" ? "backyard-claw-control" : "grabber-control";
      const frame = compProps.percentOpen < 1 ? Math.floor(grabberClawFrames.length * compProps.percentOpen) :  grabberClawFrames.length - 1;
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

    const initial = 0;
    const initialTilt = 0;
    node.data[key] = initial;

    const initialType = "Light Bulb";

    this.props = {
      value: initial,
      percentOpen: this.getPercentOpen(initial),
      tilt: initialTilt,
      percentTilt: this.getPercentTilt(initialTilt),
      type: initialType
    };
  }

  // Converts a number to [0,1]
  private getPercentOpen = (val: number) => {
    let percentOpen = Math.min(1, val);
    percentOpen = Math.max(0, percentOpen);
    return percentOpen
  };

  public setValue = (val: number) => {
    this.props.value = val;
    this.props.percentOpen = this.getPercentOpen(val);
    this.putData(this.key, val);
    (this as any).update();
  };

  // Converts [-1,1] to [0,1]. Caps at 0 and 1.
  private getPercentTilt = (tilt: number) => {
    let percentTilt = (tilt + 1) / 2;
    percentTilt = Math.min(1, percentTilt);
    percentTilt = Math.max(0, percentTilt);
    return percentTilt;
  };

  public setTilt = (tilt: number) => {
    this.props.tilt = tilt;
    (this as any).update();
  };

  public setOutputType = (type: string) => {
    this.props.type = type;
    (this as any).update();
  };
}
