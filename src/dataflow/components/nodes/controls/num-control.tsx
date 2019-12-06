import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
import { HTMLSelect } from "@blueprintjs/core";
import "./num-control.sass";

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
              units: string[] | null = null) {
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
      this.putData("units", this.props.currentUnits);
      (this as any).update();
    };
    this.component = (compProps: { readonly: any,
                                   value: any;
                                   inputValue: any;
                                   onChange: any;
                                   onBlur: any;
                                   label: string;
                                   currentUnits: string;
                                   units: string[] | null}) => {
      const inputRef = useRef<HTMLInputElement>(null);
      useStopEventPropagation(inputRef, "pointerdown");
      return (
        <div className="number-container">
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
          { compProps.units && compProps.units.length
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

    this.min = minVal;
    const initial = node.data[key] || initVal;
    node.data[key] = initial;

    const unitsKey = "units";
    const initialUnits = node.data[unitsKey] || (units?.length ? units[0] : "");
    node.data[unitsKey] = initialUnits;

    this.props = {
      readonly,
      value: initial,
      inputValue: initial,
      onChange: (v: any) => {
        this.setInputValue(v);
      },
      onBlur: (v: any) => {
        if (!isNaN(v)) {
          this.setValue(Number(v));
          this.emitter.trigger("process");
        } else {
          this.restoreValue();
        }
      },
      label,
      currentUnits: initialUnits,
      units
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
    this.putData(this.key, val);
    (this as any).update();
  }

  public restoreValue = () => {
    this.props.inputValue = this.props.value;
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }
}
