import { ClassicPreset } from "rete";
import "./value-control.sass";
import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";

export class ValueControl extends ClassicPreset.Control
{
  constructor(
    public nodeName: string,
    public getSentence: () => string
  ){
    super();
  }
}

export const ValueControlComponent: React.FC<{ data: ValueControl; }> =
  observer(function ValueControlComponent(props)
{
  const control = props.data;
  const sentence = control.getSentence();

  const sentLen = sentence.length;
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
      {sentence}
    </div>
  );

});
