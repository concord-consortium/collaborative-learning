

import { ClassicPreset } from "rete";
import "./value-control.sass";
import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { action, makeObservable, observable } from "mobx";

export class ValueControl extends ClassicPreset.Control
{
  // In Dataflow v1 setting the value also updated the node data with putData
  // for the given key of the ValueControl. This approach overlapped with the
  // updating of the node data via the watchedValues feature.
  // The actual value was not used by the value control because in all cases
  // the setSentence was called too.
  // So in Dataflow v2 we are just getting rid of the value property and
  // each node will need to explicity save its calculated data in a
  // watchedValue property.
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
}

export const ValueControlComponent: React.FC<{ data: ValueControl; }> =
  observer(function ValueControlComponent(props)
{
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
      {control.sentence}
    </div>
  );

});
