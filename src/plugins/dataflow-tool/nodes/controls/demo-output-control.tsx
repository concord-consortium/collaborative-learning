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
      const clawFrame = this.getClawFrame(compProps.percentOpen);
      const chordFrame = this.getChordFrame(compProps.percentTilt);
      return (
        <div className={`demo-output-control ${controlClassName}`}>
          {compProps.type === "Light Bulb"
            ? <img src={ compProps.value ? lightBulbOn : lightBulbOff } className="demo-output-image lightbulb-image" />
            : compProps.type === "Backyard Claw"
            ? <img src={ backyardClawFrames[clawFrame] } className="demo-output-image backyard-claw-image" />
            : <>
                <img src={ grabberPaddle } className="demo-output-image grabber-paddle-image" />
                <img src={ grabberChordFrames[chordFrame] } className="demo-output-image grabber-chord-image" />
                <img
                  src={ grabberClawFrames[clawFrame] }
                  className="demo-output-image grabber-claw-image"
                  style={this.getClawRotateStyle(compProps.percentTilt)}
                />
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
    return percentOpen;
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
    this.props.percentTilt = this.getPercentTilt(tilt);
    (this as any).update();
  };

  public setOutputType = (type: string) => {
    this.props.type = type;
    (this as any).update();
  };

  private getClawFrame = (percentOpen: number) => {
    return percentOpen < 1 ? Math.floor(grabberClawFrames.length * percentOpen) :  grabberClawFrames.length - 1;
  };

  private getChordFrame = (percentTilt: number) => {
    return percentTilt < 1 ? Math.floor(grabberChordFrames.length * percentTilt) : grabberChordFrames.length - 1;
  };

  private getClawRotateStyle = (percentTilt: number) => {
    const degrees = (percentTilt - .5) * -50;
    return { transform: `rotate(${degrees}deg)` };
  };
}
