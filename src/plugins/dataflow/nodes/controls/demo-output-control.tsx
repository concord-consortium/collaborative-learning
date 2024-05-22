import { ClassicPreset } from "rete";
import { observer } from "mobx-react";
import classNames from "classnames";
import React from "react";
import { IDemoOutputNodeModel } from "../demo-output-node";
import { fanFrames, fanHousing, fanMotor,
  grabberPaddle, humidifier, lightBulbOff, lightBulbOn } from "./demo-outputs/demo-output-control-assets";
import { HumidifierAnimation } from "./demo-outputs/humidifier-animation";
import { GrabberAnimation } from "./demo-outputs/grabber-animation";
import { AdvancedGrabberAnimation } from "./demo-outputs/advanced-grabber-animation";

import "./demo-output-control.scss";

export class DemoOutputControl extends ClassicPreset.Control
{
  constructor(
    public model: IDemoOutputNodeModel
  ) {
    super();
  }

  get type() {
    return this.model.outputType;
  }

  get nodeValue() {
    return this.model.nodeValue ?? 0;
  }

  get tilt() {
    return this.model.tilt ?? 0;
  }

  // Converts [-1,1] to [0,1]. Caps at 0 and 1.
  get percentTilt() {
    let percentTilt = (this.tilt + 1) / 2;
    percentTilt = Math.min(1, percentTilt);
    percentTilt = Math.max(0, percentTilt);
    return percentTilt;
  }
}

export const DemoOutputControlComponent: React.FC<{ data: DemoOutputControl }> =
  observer(function DemoOutputControlComponent(props)
{
  const control = props.data;
  const { type, nodeValue: value1 } = control;

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

  return (
    <div className={`demo-output-control ${controlClassName}`}>
      { type === "Light Bulb" &&
        <img
          src={ value1 ? lightBulbOn : lightBulbOff }
          className="demo-output-image lightbulb-image"
        />
      }

      { type === "Grabber" &&
        <GrabberAnimation nodeValue={control.nodeValue}/>
      }

      { type === "Advanced Grabber" &&
        <>
          <img
            src={ grabberPaddle }
            className="demo-output-image grabber-paddle-image"
          />
          <AdvancedGrabberAnimation
            nodeValue={control.nodeValue}
            percentTilt={control.percentTilt}
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
              nodeValue={control.nodeValue}
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
