import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { useStopEventPropagation } from "./custom-hooks";
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
              minVal: number | null = null) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    const handleBlur = (onBlur: any) => {
      return (e: any) => { onBlur(e.target.value); };
    };
    this.component = (compProps: { readonly: any,
                                   value: any;
                                   inputValue: any;
                                   onChange: any;
                                   onBlur: any;
                                   label: string}) => {
      const inputRef = useRef<HTMLInputElement>(null);
      useStopEventPropagation(inputRef, "pointerdown");
      return (
        <div className="number-container">
          { label
            ? <label className="number-label">{compProps.label}</label>
            : null
          }
          <input className="number-input"
            ref={inputRef}
            type={"text"}
            value={compProps.inputValue}
            onChange={handleChange(compProps.onChange)}
            onBlur={handleBlur(compProps.onBlur)} />
        </div>
      );
    };

    this.min = minVal;
    const initial = node.data[key] || initVal;
    node.data[key] = initial;

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
      label
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
