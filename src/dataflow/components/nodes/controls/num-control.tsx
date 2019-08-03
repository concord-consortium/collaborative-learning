import * as React from "react";
import { useRef, useEffect } from "react";
import Rete from "rete";
import "./num-control.sass";

// cf. https://codesandbox.io/s/retejs-react-render-t899c
export class NumControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  private min: any;
  constructor(emitter: any,
              key: string,
              node: any,
              readonly = false,
              label = "",
              initVal = 0,
              minVal: number | null = null) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(+e.target.value); };
    };
    const handlePointerDown = (e: PointerEvent) => e.stopPropagation();
    this.component = (compProps: { readonly: any, value: any; onChange: any; label: any}) => {
      const inputRef = useRef<HTMLInputElement>(null);
      useEffect(() => {
        inputRef.current && inputRef.current.addEventListener("pointerdown", handlePointerDown);
        return () => {
          inputRef.current && inputRef.current.removeEventListener("pointerdown", handlePointerDown);
        };
      }, []);
      return (
        <div className="number-container">
          { label
            ? <label className="number-label">{compProps.label}</label>
            : null
          }
          <input className="number-input"
            ref={inputRef}
            type={readonly ? "text" : "number"}
            value={compProps.value}
            onChange={handleChange(compProps.onChange)} />
        </div>
      );
    };

    this.min = minVal;
    const initial = node.data[key] || initVal;
    node.data[key] = initial;

    this.props = {
      readonly,
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      label
    };
  }

  public setValue = (val: number) => {
    if (this.min && val < this.min) {
      val = this.min;
    }
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }
}
