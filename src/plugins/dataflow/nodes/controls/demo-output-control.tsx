import React from "react";
import classNames from "classnames";
import Rete, { NodeEditor, Node } from "rete";
import {
  lightBulbOn, lightBulbOff, grabberFrames, grabberPaddle,
  advancedGrabberFrames, grabberCordFrames,
  fanHousing, fanMotor, fanFrames,
  humidifier
} from "./demo-output-control-assets";
import { HumidiferAnimation } from "./humidifier-animation";

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

    this.component = (compProps: { value: number, percentClosed: number, percentTilt: number, type: string }) => {
      const controlClassName = classNames({
        "lightbulb-control": compProps.type === "Light Bulb" || compProps.type === "Heat Lamp",
        "advanced-grabber-control": compProps.type === "Advanced Grabber",
        "grabber-control": compProps.type === "Grabber",
        "humidifier-control": compProps.type === "Humidifier",
        "fan-control": compProps.type === "Fan",
      });
      const fanBladeClasses = classNames({
        "fan-part blades": true,
        "spinning fast": compProps.value === 1
      });
      const grabberFrame = this.getGrabberFrame(compProps.percentClosed);
      const cordFrame = this.getCordFrame(compProps.percentTilt);
      return (
        <div className={`demo-output-control ${controlClassName}`}>
          { (compProps.type === "Light Bulb" || compProps.type === "Heat Lamp") &&
            <img
              src={ compProps.value ? lightBulbOn : lightBulbOff }
              className="demo-output-image lightbulb-image"
            />
          }

          { compProps.type === "Grabber" &&
            <img
              src={ grabberFrames[grabberFrame] }
              className="demo-output-image grabber-image"
            />
          }

          { compProps.type === "Advanced Grabber" &&
            <>
              <img
                src={ grabberPaddle }
                className="demo-output-image grabber-paddle-image"
              />
              <img
                src={ grabberCordFrames[cordFrame] }
                className="demo-output-image grabber-cord-image"
              />
              <img
                src={ advancedGrabberFrames[grabberFrame] }
                className="demo-output-image advanced-grabber-image"
                style={this.getGrabberRotateStyle(compProps.percentTilt)}
              />
            </>
          }

          { compProps.type === "Humidifier" &&
            <>
                {<img
                  id="humidifier-base"
                  src={humidifier}
                />}
                <HumidiferAnimation
                  nodeValue={compProps.value}
                  nodeId={this.node.id}
                  editor={this.emitter}
                />
            </>
          }

          { compProps.type === "Fan" &&
            <div className="fan-assembly">
              {/* .spinning, .slow, .medium, .fast*/}
              <img className="fan-part motor" src={fanMotor}/>
              <img className={fanBladeClasses} src={fanFrames[0]} />
              <img className="fan-part housing" src={fanHousing}/>
            </div>
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
      percentClosed: this.getPercentClosed(initial),
      tilt: initialTilt,
      percentTilt: this.getPercentTilt(initialTilt),
      type: initialType
    };
  }

  // Converts a number to [0,1]
  private getPercentClosed = (val: number) => {
    let percentClosed = Math.min(1, val);
    percentClosed = Math.max(0, percentClosed);
    return percentClosed;
  };

  public setValue = (val: number) => {
    this.props.value = val;
    this.props.percentClosed = this.getPercentClosed(val);
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

  private getGrabberFrame = (percentClosed: number) => {
    return this.getFrame(percentClosed, advancedGrabberFrames.length);
  };

  private getCordFrame = (percentTilt: number) => {
    return this.getFrame(percentTilt, grabberCordFrames.length);
  };

  private getFrame = (percent: number, numFrames: number) => {
    let frame = Math.floor(numFrames * percent);
    frame = Math.max(frame, 0);
    frame = Math.min(frame, numFrames - 1);
    return frame;
  };

  private getGrabberRotateStyle = (percentTilt: number) => {
    const degrees = (percentTilt - .5) * -50;
    const transform = `rotate(${degrees}deg)`;
    return { transform };
  };
}
