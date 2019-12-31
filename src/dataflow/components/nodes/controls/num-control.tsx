import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import { HTMLSelect } from "@blueprintjs/core";
import "./num-control.sass";
import { NodePeriodUnits } from "../../../utilities/node";

// cf. https://codesandbox.io/s/retejs-react-render-t899c
export class NumControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  private min: number | null;
  constructor(emitter: NodeEditor,
              key: string,
              node: Node,
              readonly = false,
              label = "",
              initVal = 0,
              minVal: number | null = null,
              units: string[] | null = null,
              tooltip = "") {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    const handleBlur = (onBlur: any) => {
      return (e: any) => { onBlur(e.target.value); };
    };
    const handleKeyPress = (e: any) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    };
    const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
      this.props.currentUnits = event.target.value;
      this.putData(this.key + "Units", this.props.currentUnits);
      const pUnits = NodePeriodUnits.find((u: any) => u.unit === this.props.currentUnits);
      const pUnitsInSecs = pUnits ? pUnits.lengthInSeconds : 1;
      this.putData(this.key, this.props.value * pUnitsInSecs);

      (this as any).update();
      this.emitter.trigger("process");
    };
    this.component = (compProps: { readonly: any,
                                   value: any;
                                   inputValue: any;
                                   onChange: any;
                                   onBlur: any;
                                   label: string;
                                   currentUnits: string;
                                   units: string[] | null,
                                   tooltip: string}) => {
      const inputRef = useRef<HTMLInputElement>(null);
      useStopEventPropagation(inputRef, "pointerdown");
      return (
        <div className="number-container" title={compProps.tooltip}>
          { label
            ? <label className="number-label">{compProps.label}</label>
            : null
          }
          <input className={`number-input ${compProps.units && compProps.units.length ? "units" : ""}`}
            ref={inputRef}
            type={"text"}
            value={compProps.inputValue}
            onKeyPress={handleKeyPress}
            onChange={handleChange(compProps.onChange)}
            onBlur={handleBlur(compProps.onBlur)}
          />
          { compProps.units?.length
            ? <div className="type-options-back">
                <HTMLSelect className="type-options"
                  onChange={handleSelectChange}
                  value={compProps.currentUnits}
                >
                  { compProps.units.map((unit, index) => (
                      <option key={index} value={unit}>{unit}</option>
                    ))
                  }
                </HTMLSelect>
              </div>
            : null
          }
        </div>
      );
    };

    const unitsKey = key + "Units";
    const initialUnits = node.data[unitsKey] || (units?.length ? units[0] : "");
    node.data[unitsKey] = initialUnits;
    const periodUnits = NodePeriodUnits.find((u: any) => u.unit === initialUnits);
    const periodUnitsInSeconds = periodUnits ? periodUnits.lengthInSeconds : 1;
    this.min = minVal;
    const initial = Number(node.data[key] || initVal);
    node.data[key] = initial;

    this.props = {
      readonly,
      value: initial / periodUnitsInSeconds,
      inputValue: initial / periodUnitsInSeconds,
      onChange: (v: any) => {
        this.setInputValue(v);
      },
      onBlur: (v: any) => {
        if (isFinite(v)) {
          this.setValue(Number(v));
          this.emitter.trigger("process");
        } else {
          this.restoreValue();
        }
      },
      label,
      currentUnits: initialUnits,
      units,
      tooltip
    };
  }

  public setInputValue = (val: string) => {
    this.props.inputValue = val;
    (this as any).update();
  }

  public setValue = (val: number) => {
    if (this.min && val < this.min) {
      val = this.min;
    }
    this.props.inputValue = val;
    this.props.value = val;
    const periodUnits = NodePeriodUnits.find((u: any) => u.unit === this.props.currentUnits);
    const periodUnitsInSeconds = periodUnits ? periodUnits.lengthInSeconds : 1;
    this.putData(this.key, val * periodUnitsInSeconds);
    (this as any).update();
  }

  public restoreValue = () => {
    this.setInputValue(this.props.value);
  }

  public getValue = () => {
    return this.props.value;
  }
}
