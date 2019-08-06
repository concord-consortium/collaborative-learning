import * as React from "react";
import { useRef, useEffect } from "react";
import Rete, { NodeEditor, Node } from "rete";
import "./text-control.sass";

export class TextControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  constructor(emitter: NodeEditor,
              key: string,
              node: Node,
              label = "",
              initVal = "") {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    const handlePointerDown = (e: PointerEvent) => e.stopPropagation();
    this.component = (compProps: { value: any; onChange: any; label: any}) => {
      const inputRef = useRef<HTMLInputElement>(null);
      useEffect(() => {
        inputRef.current && inputRef.current.addEventListener("pointerdown", handlePointerDown);
        return () => {
          inputRef.current && inputRef.current.removeEventListener("pointerdown", handlePointerDown);
        };
      }, []);
      return (
        <div className="text-container">
          { label
            ? <label className="text-label">{compProps.label}</label>
            : null
          }
          <input
            className="text-input"
            ref={inputRef}
            type={"text"}
            value={compProps.value}
            onChange={handleChange(compProps.onChange)}
          />
        </div>
      );
    };

    const initial = node.data[key] || initVal;
    node.data[key] = initial;

    this.props = {
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      label
    };
  }

  public setValue = (val: string) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }
}
