

import { ClassicPreset } from "rete";
import "./value-control.sass";
import classNames from "classnames";
import React from "react";
import { getNumDisplayStr } from "../../nodes/utilities/view-utilities";
import { observer } from "mobx-react";
import { action, makeObservable, observable } from "mobx";

export class ValueControl extends ClassicPreset.Control {
  // TODO: this value should stored where the actual values are being stored
  // In v1 it was saved into data.nodeValue in all cases
  // nodeValue was not serialized though
  // We could approximate this by having a nodeValue in the volatile props
  // of the model.

  @observable value = 0;

  @observable sentence = "";

  constructor(
    public nodeName: string
  ){
    super();
    makeObservable(this);
  }

  @action
  public setSentence(sentence: string) {
    this.sentence = sentence;
  }

  @action
  public setValue(value: number) {
    this.value = value;
  }
}

export const ValueControlComponent: React.FC<{ data: ValueControl; }> = observer(function ValueControlComponent(props) {
  const control = props.data;

  const sentLen = control.sentence.length;
  const fontSizeClasses = {
    "smallest": sentLen >= 15,
    "small": sentLen > 13 && sentLen < 15,
    "medium": sentLen > 11 && sentLen <= 13,
  };
  const valueClasses = classNames(
    "value-container", fontSizeClasses, control.nodeName.toLowerCase().replace(/ /g, "-"),
  );
  return (
    <div className={valueClasses} title={"Node Value"}>
      {control.sentence ? control.sentence : getNumDisplayStr(control.value)}
    </div>
  );

});
