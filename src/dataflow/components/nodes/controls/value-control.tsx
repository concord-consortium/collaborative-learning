import * as React from "react";
import Rete from "rete";
import { roundNodeValue } from "../../../utilities/node";
import "./value-control.sass";

export class ValueControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  constructor(emitter: any,
              key: string,
              node: any) {
    super(key);
    this.emitter = emitter;
    this.key = key;

    this.component = (compProps: { value: number; sentence: string }) => (
      <div className="value-container">
        {compProps.sentence ? compProps.sentence : roundNodeValue(compProps.value)}
      </div>
    );

    const initial = node.data[key] || 0;
    node.data[key] = initial;

    this.props = {
      value: initial,
      sentence: ""
    };
  }

  public setSentence = (sentence: string) => {
    this.props.sentence = sentence;
    (this as any).update();
  }

  public setValue = (val: number) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }
}
