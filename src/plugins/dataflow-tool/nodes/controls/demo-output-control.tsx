import React from "react";
import Rete, { NodeEditor, Node } from "rete";

import bulbOn from "../../assets/lightbulb-on.png";
import bulbOff from "../../assets/lightbulb-off.png";

import clawOpen from "../../assets/claw-open.png";
import clawClosed from "../../assets/claw-closed.png";

import backyardClaw00 from "../../assets/backyard-claw/Claw_close_08.png";
import backyardClaw01 from "../../assets/backyard-claw/Claw_close_07.png";
import backyardClaw02 from "../../assets/backyard-claw/Claw_close_06.png";
import backyardClaw03 from "../../assets/backyard-claw/Claw_close_05.png";
import backyardClaw04 from "../../assets/backyard-claw/Claw_close_04.png";
import backyardClaw05 from "../../assets/backyard-claw/Claw_close_03.png";
import backyardClaw06 from "../../assets/backyard-claw/Claw_close_02.png";
import backyardClaw07 from "../../assets/backyard-claw/Claw_close_01.png";

import paddle from "../../assets/grabber/paddle.png";
import grabber00 from "../../assets/grabber/claw/Claw_close_08.png";
import grabber01 from "../../assets/grabber/claw/Claw_close_07.png";
import grabber02 from "../../assets/grabber/claw/Claw_close_06.png";
import grabber03 from "../../assets/grabber/claw/Claw_close_05.png";
import grabber04 from "../../assets/grabber/claw/Claw_close_04.png";
import grabber05 from "../../assets/grabber/claw/Claw_close_03.png";
import grabber06 from "../../assets/grabber/claw/Claw_close_02.png";
import grabber07 from "../../assets/grabber/claw/Claw_close_01.png";
import chord00 from "../../assets/grabber/chord/Cord_tilt_down_08.png";
import chord01 from "../../assets/grabber/chord/Cord_tilt_down_07.png";
import chord02 from "../../assets/grabber/chord/Cord_tilt_down_06.png";
import chord03 from "../../assets/grabber/chord/Cord_tilt_down_05.png";
import chord04 from "../../assets/grabber/chord/Cord_tilt_down_04.png";
import chord05 from "../../assets/grabber/chord/Cord_tilt_down_03.png";
import chord06 from "../../assets/grabber/chord/Cord_tilt_down_02.png";
import chord07 from "../../assets/grabber/chord/Cord_tilt_down_01.png";
import chord08 from "../../assets/grabber/chord/Cord_tilt_up_01.png";
import chord09 from "../../assets/grabber/chord/Cord_tilt_up_02.png";
import chord10 from "../../assets/grabber/chord/Cord_tilt_up_03.png";
import chord11 from "../../assets/grabber/chord/Cord_tilt_up_04.png";
import chord12 from "../../assets/grabber/chord/Cord_tilt_up_05.png";
import chord13 from "../../assets/grabber/chord/Cord_tilt_up_06.png";
import chord14 from "../../assets/grabber/chord/Cord_tilt_up_07.png";
import chord15 from "../../assets/grabber/chord/Cord_tilt_up_08.png";

import "./demo-output-control.scss";
const backyardClawFrames = [backyardClaw00, backyardClaw01, backyardClaw02, backyardClaw03, backyardClaw04, backyardClaw05, backyardClaw06, backyardClaw07];
const grabberClawFrames = [grabber00, grabber01, grabber02, grabber03, grabber04, grabber05, grabber06, grabber07];
const grabberChordFrames = [chord00, chord01, chord02, chord03, chord04, chord05, chord06, chord07, chord08, chord09, chord10, chord11, chord12, chord13, chord14, chord15];

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
      let percentOpen = compProps.value;
      percentOpen = Math.min(1, percentOpen);
      percentOpen = Math.max(0, percentOpen);
      const frame = percentOpen < 1 ? Math.floor(grabberClawFrames.length * percentOpen) :  grabberClawFrames.length - 1;
      return (
        <div className={`demo-output-control ${controlClassName}`}>
          {compProps.type === "Light Bulb"
            ? <img src={ compProps.value ? bulbOn : bulbOff } className="demo-output-image lightbulb-image" />
            : compProps.type === "Backyard Claw"
            ? <img src={ backyardClawFrames[frame] } className="demo-output-image backyard-claw-image" />
            : <img src={ grabberClawFrames[frame] } className="demo-output-image backyard-claw-image" />
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
