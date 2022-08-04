import React from "react";
import classNames from "classnames";
import Rete, { NodeEditor, Node } from "rete";
import { roundNodeValue } from "../../model/utilities/node";
import "./value-control.sass";

export class ValueControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  constructor(emitter: NodeEditor,
              key: string,
              node: Node) {
    super(key);
    this.emitter = emitter;
    this.key = key;

    this.component = (compProps: { value: number; sentence: string, class: string }) => {
      const sentLen = compProps.sentence.length;
      const dynamicClasses = classNames({
        "smallest": sentLen >= 15,
        "small": sentLen > 13 && sentLen < 15,
        "medium": sentLen > 11 && sentLen <= 13
      });

      return (
        <div className={`value-container ${compProps.class.toLowerCase().replace(/ /g, "-")} ${dynamicClasses}`}
             title={"Node Value"}>
          {compProps.sentence
            ? compProps.sentence
            : isFinite(compProps.value) ? roundNodeValue(compProps.value) : ""}
        </div>
      );
    };

    const initial = node.data[key] || 0;
    node.data[key] = initial;

    this.props = {
      value: initial,
      sentence: "",
      class: node.name,
    };
  }

  public setSentence = (sentence: string) => {
    this.props.sentence = sentence;
    (this as any).update();
  };

  public setValue = (val: number) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  };

  public getValue = () => {
    return this.props.value;
  };
}
