import React from "react";
import Rete, { NodeEditor, Node } from "rete";
import bulbOn from "../../../../assets/dataflow/lightbulb-on.png";
import bulbOff from "../../../../assets/dataflow/lightbulb-off.png";
import "./lightbulb-control.sass";

export class LightbulbControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  private node: Node;

  constructor(emitter: NodeEditor, key: string, node: Node) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.node = node;

    this.component = (compProps: {value: number}) => (
      <div className="lightbulb-control">
        <img src={compProps.value ? bulbOn : bulbOff} className="lightbulb-image" />
      </div>
    );

    const initial = node.data[key] || 0;
    node.data[key] = initial;

    this.props = {
      value: initial,
    };
  }

  public setValue = (val: number) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }
}
