import { ClassicPreset } from "rete";
import { observer } from "mobx-react";
import classNames from "classnames";
import React from "react";
import { advancedGrabberFrames, fanFrames, fanHousing, fanMotor, grabberCordFrames, grabberFrames,
  grabberPaddle, humidifier, lightBulbOff, lightBulbOn } from "../../nodes/controls/demo-output-control-assets";
import { HumidifierAnimation } from "./demo-outputs/humidifier-animation";
import { IDemoOutputNodeModel } from "../nodes/demo-output-node";

import "./demo-output-control.scss";

export class DemoOutputControl extends ClassicPreset.Control
{
  constructor(
    public model: IDemoOutputNodeModel
  ) {
    super();

    // TODO: convert "Heat Lamp" type to "Light Bulb" this is needed for old programs
  }

  get type() {
    return this.model.outputType;
  }

  get value1() {
    // TODO: returning 0 if we are undefined just to make things work, this might
    // might not be the right thing to do
    return this.model.nodeValue ?? 0;
  }

  get value2() {
    return this.model.tilt ?? 0;
  }

  get percentClosed() {
    return Math.max(0, Math.min(1, this.value1));
  }

  get percentValue2() {
    return Math.max(0, Math.min(1, this.value2));
  }

  getFrame(percent: number, frames: any[]) {
    const numFrames = frames.length;
    let frameIndex = Math.floor(numFrames * percent);
    frameIndex = Math.max(frameIndex, 0);
    frameIndex = Math.min(frameIndex, numFrames - 1);
    return frames[frameIndex];
  }
}

export const DemoOutputControlComponent: React.FC<{ data: DemoOutputControl }> =
  observer(function DemoOutputControlComponent(props)
{
  const control = props.data;
  const { type, value1 } = control;

  const controlClassName = classNames({
    "lightbulb-control": type === "Light Bulb",
    "advanced-grabber-control": type === "Advanced Grabber",
    "grabber-control": type === "Grabber",
    "humidifier-control": type === "Humidifier",
    "fan-control": type === "Fan",
  });
  const fanBladeClasses = classNames({
    "fan-part blades": true,
    "spinning fast": value1 === 1
  });

  const grabberFrame = control.getFrame(control.percentClosed, grabberFrames);
  const advancedGrabberFrame = control.getFrame(control.percentClosed, advancedGrabberFrames);
  const grabberCordFrame = control.getFrame(control.percentValue2, grabberCordFrames);
  const grabberDegrees = (control.percentValue2 - .5) * -50;
  const grabberRotateStyle =  { transform: `rotate(${grabberDegrees}deg)`};

  return (
    <div className={`demo-output-control ${controlClassName}`}>
      { type === "Light Bulb" &&
        <img
          src={ value1 ? lightBulbOn : lightBulbOff }
          className="demo-output-image lightbulb-image"
        />
      }

      { type === "Grabber" &&
        <img
          src={ grabberFrame }
          className="demo-output-image grabber-image"
        />
      }

      { type === "Advanced Grabber" &&
        <>
          <img
            src={ grabberPaddle }
            className="demo-output-image grabber-paddle-image"
          />
          <img
            src={ grabberCordFrame }
            className="demo-output-image grabber-cord-image"
          />
          <img
            src={ advancedGrabberFrame }
            className="demo-output-image advanced-grabber-image"
            style={grabberRotateStyle}
          />
        </>
      }

      { type === "Humidifier" &&
        <>
            {<img
              id="humidifier-base"
              src={humidifier}
            />}
            <HumidifierAnimation
              nodeValue={control.value1}
            />
        </>
      }

      { type === "Fan" &&
        <div className="fan-assembly">
          {/* .spinning, .slow, .medium, .fast*/}
          <img className="fan-part motor" src={fanMotor}/>
          <img className={fanBladeClasses} src={fanFrames[0]} />
          <img className="fan-part housing" src={fanHousing}/>
        </div>
      }

    </div>
  );
});
