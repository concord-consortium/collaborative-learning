import React, { useCallback, useRef, useState } from "react";
import { ClassicPreset } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import { INumberNodeModel } from "../nodes/number-node";

import "./num-control.sass";

// TODO: it seems like some controls hold state that needs to be serialized
// but there is all of the state here which doesn't need to be saved.
// TODO: where is the value of the number control actually saved??
export class NumberControl extends ClassicPreset.Control {

  // TODO: switch this to a set of options to make it more clear
  constructor(
    // Extract these two properties so they are generic
    // Also it would probably better to make a version of this control
    // which doesn't do anything with units
    public model: INumberNodeModel,
    public key: string,

    private process: () => void,

    public label = "",
    public minVal: number | null = null,
    public tooltip = ""
  ) {
    super();
  }

  public setValue(val: number) {
    if ((this.minVal != null) && val < this.minVal) {
      val = this.minVal;
    }

    this.model.setValue(val);

    // trigger a reprocess so our new value propagates through the nodes
    this.process();

    // FIXME: need to handle dataflow log events maybe here or in component
    // dataflowLogEvent("numberinputmanualentry", this as Control, n.meta.inTileWithId as string);
  }

  public getValue() {
    return this.model.value;
  }
}

export const NumberControlComponent: React.FC<{ data: NumberControl; }> = (props) => {
  const control = props.data;

  const [inputValue, setInputValue] = useState(control.getValue());

  const handleChange = useCallback((e: any) => {
    setInputValue(e.target.value);
  }, []);

  const handleBlur = useCallback((e: any) => {
    const v = e.target.value;
    if (isFinite(v)) {
      control.setValue(Number(v));

      // FIXME: need to reprocess data and log the event
      // perhaps the logging could happen in the control instead of here
      // this.emitter.trigger("process");
      // const n = this.getNode();
      // dataflowLogEvent("numberinputmanualentry", this as Control, n.meta.inTileWithId as string);
    } else {
      // Restore the value to the one currently stored in the control
      setInputValue(control.getValue());
    }
  }, [control]);

  const handleKeyPress = useCallback((e: any) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  useStopEventPropagation(inputRef, "pointerdown");
  return (
    <div className="number-container" title={control.tooltip}>
      { control.label
        ? <label className="number-label">{control.label}</label>
        : null
      }
      <input className={`number-input`}
        ref={inputRef}
        type={"text"}
        value={inputValue}
        onKeyPress={handleKeyPress}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
};
