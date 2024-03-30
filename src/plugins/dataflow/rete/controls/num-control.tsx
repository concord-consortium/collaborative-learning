import React, { useCallback, useRef, useState } from "react";
import { ClassicPreset } from "rete";
import { useStopEventPropagation } from "./custom-hooks";

import "./num-control.sass";
import { IBaseNode } from "../nodes/base-node";

// This generics design isn't very user friendly if a caller
// tries to construct the NumberControl with a key that doesn't
// exist on the model the error message just complains about all properties
// on the model not being numbers.
// A better approach might be to get rid of the:
//   ModelType extends Record<Key, number>
// and instead add the following constraint to the key in the
// the constructor:
//   key: Key & (ModelType[Key] extends number ? Key : never)
export class NumberControl<
  ModelType extends Record<Key, number> & Record<`set${Capitalize<Key>}`, (val: number) => void>,
  NodeType extends { model: ModelType } & IBaseNode,
  Key extends keyof NodeType['model'] & string
>
  extends ClassicPreset.Control
  implements INumberControl
{
  setter: (val: number) => void;

  // TODO: switch this to a set of options to make it more clear
  constructor(
    public node: NodeType,
    public modelKey: Key,

    public label = "",
    public minVal: number | null = null,
    public tooltip = ""
  ) {
    super();
    const setterProp = "set" + modelKey.charAt(0).toUpperCase() + modelKey.slice(1) as `set${Capitalize<Key>}`;

    // The typing above using `set${Capitalize<Key>}` almost works, but it fails here
    // I'm pretty sure there is a way to make it work without having to use the "as any" here
    this.setter = this.model[setterProp] as any;
  }

  public get model() {
    return this.node.model;
  }

  public setValue(val: number) {
    if ((this.minVal != null) && val < this.minVal) {
      val = this.minVal;
    }

    this.setter(val);

    // trigger a reprocess so our new value propagates through the nodes
    this.node.process();

    this.node.logControlEvent("numberinputmanualentry", "nodenumber", this.modelKey, val);
  }

  public getValue() {
    return this.model[this.modelKey];
  }
}

// A separate interface is required, otherwise the generic stuff above
// means we can't configure Rete's type system with this control
export interface INumberControl {
  id: string;
  setValue(val: number): void;
  getValue(): number;
  label: string;
  tooltip: string;
}

export const NumberControlComponent: React.FC<{ data: INumberControl }> = (props) => {
  const control = props.data;

  const [inputValue, setInputValue] = useState(control.getValue());

  const handleChange = useCallback((e: any) => {
    setInputValue(e.target.value);
  }, []);

  const handleBlur = useCallback((e: any) => {
    const v = e.target.value;
    if (isFinite(v)) {
      control.setValue(Number(v));
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
  useStopEventPropagation(inputRef, "dblclick");
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
