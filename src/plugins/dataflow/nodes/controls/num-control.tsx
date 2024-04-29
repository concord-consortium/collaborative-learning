import React, { useCallback, useRef, useState } from "react";
import { ClassicPreset } from "rete";
import { observer } from "mobx-react";
import { useStopEventPropagation } from "./custom-hooks";
import { IBaseNode } from "../base-node";

import "./num-control.sass";

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
    public tooltip = "",
    public units = ""
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
  node: IBaseNode;
  setValue(val: number): void;
  getValue(): number;
  label: string;
  tooltip: string;
  units: string;
}

export const NumberControlComponent: React.FC<{ data: INumberControl }> = observer(
  function NumberControlComponent(props)
{
  const control = props.data;

  // FIXME: the type of inputValue is flipping between a number and a string
  const [inputValue, setInputValue] = useState(control.getValue());

  const handleChange = useCallback((e: any) => {
    setInputValue(e.target.value);
  }, []);

  const handleBlur = useCallback((e: any) => {
    const v = e.target.value;
    if (isFinite(v)) {
      const newValue = Number(v);
      control.setValue(newValue);
      // If the new value string is 01 this will update to 1
      setInputValue(newValue);
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

  // FIXME: in readOnly mode there is a lot of stuff in this component that is
  // extraneous. A layer is put on top of dataflow that prevents interactions
  // with the nodes. It would be better to make this more clear somehow.
  const possiblyReadOnlyInputValue = control.node.readOnly ? control.getValue() : inputValue;

  const inputRef = useRef<HTMLInputElement>(null);
  useStopEventPropagation(inputRef, "pointerdown");
  useStopEventPropagation(inputRef, "dblclick");

  const unitsClass = control.units ? "units one" : "";
  return (
    <div className={`number-container ${unitsClass}`} title={control.tooltip}>
      { control.label
        ? <label className="number-label">{control.label}</label>
        : null
      }
      <input className={`number-input`}
        ref={inputRef}
        type={"text"}
        value={possiblyReadOnlyInputValue}
        onKeyPress={handleKeyPress}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      { control.units &&
        <div className="single-unit">{control.units}</div>
      }
    </div>
  );
});
