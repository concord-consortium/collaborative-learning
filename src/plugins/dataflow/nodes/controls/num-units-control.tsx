import React, { useCallback, useRef, useState } from "react";
import { ClassicPreset } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import { NodePeriodUnits } from "../../model/utilities/node";
import { IBaseNode } from "../base-node";
import { observer } from "mobx-react";
import classNames from "classnames";

import "./num-control.scss";

export class NumberUnitsControl <
  ModelType extends
    Record<Key, number> &
    Record<`set${Capitalize<Key>}`, (val: number) => void> &
    Record<`${Key}Units`, string> &
    Record<`set${Capitalize<Key>}Units`, (val: string) => void>,
  NodeType extends { model: ModelType } & IBaseNode,
  Key extends keyof NodeType['model'] & string
>
  extends ClassicPreset.Control
  implements INumberUnitsControl
{
  setter: (val: number) => void;
  setterUnits: (val: string) => void;

  constructor(
    public node: NodeType,
    public readonly modelKey: Key,

    public label = "",
    public minVal: number | null = null,
    public units: string[],
    public tooltip = ""
  ) {
    super();

    // The stored value is always in seconds
    const setterProp = "set" + modelKey.charAt(0).toUpperCase() + modelKey.slice(1) as `set${Capitalize<Key>}`;

    // The typing above using `set${Capitalize<Key>}` almost works, but it fails here
    // I'm pretty sure there is a way to make it work without having to use the "as any" here
    this.setter = this.model[setterProp] as any;

    const setterUnitsProp =
      ("set" + modelKey.charAt(0).toUpperCase() + modelKey.slice(1) + 'Units') as `set${Capitalize<Key>}Units`;

    this.setterUnits = this.model[setterUnitsProp] as any;
  }

  public get model() {
    return this.node.model;
  }

  /**
   * This is setting the value in the base units so the value being displayed needs to be
   * converted to the base unit (seconds) before passing it to setValue
   * @param val
   */
  public setValue(val: number) {
    if ((this.minVal != null) && val < this.minVal) {
      val = this.minVal;
    }

    this.setter(val);
  }

  public getValue() {
    return this.model[this.modelKey];
  }

  /**
   * This will not convert the value. That should be done by the caller.
   * Because the underlying value doesn't change here we don't need to reprocess
   * the node.
   *
   * @param val
   */
  public setCurrentUnits(val: string) {
    this.setterUnits(val);
  }

  public getCurrentUnits() {
    // TODO: I'm not sure why the cast is needed here when it isn't needed in getValue
    return this.model[`${this.modelKey}Units`] as string;
  }

  public get periodUnitsInSeconds() {
    const periodUnits = NodePeriodUnits.find(u => u.unit === this.getCurrentUnits());
    return periodUnits ? periodUnits.lengthInSeconds : 1;
  }

  public setValueFromUser(val: number) {
    this.setValue(val * this.periodUnitsInSeconds);
  }

  public getValueForUser() {
    return this.getValue() / this.periodUnitsInSeconds;
  }

  public logEvent(operation: string) {
    this.node.logControlEvent(operation, "nodenumber", this.modelKey,
      this.getValueForUser(), this.getCurrentUnits());
  }
}

// A separate interface is required, otherwise the generic stuff above
// means we can't configure Rete's type system with this control
export interface INumberUnitsControl {
  id: string;
  node: IBaseNode;
  units: string[];
  setValue(val: number): void;
  getValue(): number;
  getValueForUser(): number;
  setValueFromUser(val: number): void;
  getCurrentUnits(): string;
  setCurrentUnits(val: string): void;
  label: string;
  tooltip: string;
  logEvent(operation: string): void;
}

export const NumberUnitsControlComponent: React.FC<{ data: INumberUnitsControl; }> = observer(
  function NumberUnitsControlComponent(props)
{
  const control = props.data;

  const [inputValue, setInputValue] = useState(control.getValueForUser());

  const handleChange = useCallback((e: any) => {
    setInputValue(e.target.value);
  }, []);

  const handleBlur = useCallback((e: any) => {
    const v = e.target.value;
    if (isFinite(v)) {
      control.setValueFromUser(Number(v));
      control.logEvent("numberinputmanualentry");
    } else {
      // Restore the value to the one currently stored in the control
      setInputValue(control.getValueForUser());
    }
  }, [control]);

  const handleKeyPress = useCallback((e: any) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  }, []);

  const handleSelectChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const oldValue = control.getValueForUser();

    control.setCurrentUnits(event.target.value);

    // We use the control's valueForUser instead of the state variable inputValue.
    // The problem might be that the blur hasn't triggered a re-render yet when the user then
    // changes the units. In this case the inputValue here will not yet match the actual inputValue.
    // However the control's valueForUser will match because it is updated immediately.
    control.setValueFromUser(oldValue);

    control.logEvent("unitdropdownselection");
  }, [control]);

  // FIXME: in readOnly mode there is a lot of stuff in this component that is
  // extraneous. A layer is put on top of dataflow that prevents interactions
  // with the nodes. It would be better to make this more clear somehow.
  const possiblyReadOnlyInputValue = control.node.readOnly ? control.getValue() : inputValue;

  const inputRef = useRef<HTMLInputElement>(null);
  useStopEventPropagation(inputRef, "pointerdown");
  useStopEventPropagation(inputRef, "dblclick");

  const unitsCountClass = classNames({
    "one": control.units.length === 1,
    "multiple": control.units.length > 1
  });

  return (
    <div className={`number-container units ${unitsCountClass}`} title={control.tooltip}>
      { control.label
        ? <label className="number-label">{control.label}</label>
        : null
      }
      <input className={`number-input units ${unitsCountClass}`}
        ref={inputRef}
        type={"text"}
        value={possiblyReadOnlyInputValue}
        onKeyPress={handleKeyPress}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      { control.units.length === 1
        ? <div className="single-unit">
            {control.units[0]}
          </div>
        : <div className="type-options-back">
            <div className="type-options">
              <select onChange={handleSelectChange}
                value={control.getCurrentUnits()}
              >
                { control.units.map((unit, index) => (
                    <option key={index} value={unit}>{unit}</option>
                  ))
                }
              </select>
            </div>
          </div>
      }
    </div>
  );
});
