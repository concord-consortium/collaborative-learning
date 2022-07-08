// FIXME: ESLint is unhappy with these control components
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useRef } from "react";
import Rete, { NodeEditor, Node } from "rete";
import { PlotButtonControlComponent } from "./plot-button-control";
// import { useStopEventPropagation } from "./custom-hooks";
import "./demo-output-value-control.scss";

export class DemoOutputValueControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;

  constructor(
    emitter: NodeEditor,
    key: string,
    node: Node,
    onGraphButtonClick: () => void,
    label = "",
    initVal = "",
    tooltip = ""
  ) {
    super(key);
    this.emitter = emitter;
    this.key = key;

    // const handleChange = (onChange: any) => {
    //   return (e: any) => { onChange(e.target.value); };
    // };

    const initial = node.data[key] || initVal;
    node.data[key] = initial;

    this.props = {
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      label,
      tooltip
    };

    this.component = (compProps: { value: any; onChange: any; label: any, color: string, tooltip: string}) => {
      // const inputRef = useRef<HTMLInputElement>(null);
      // useStopEventPropagation(inputRef, "pointerdown");
      return (
        <div className="demo-output-value-container" title={compProps.tooltip}>
          <PlotButtonControlComponent showgraph={false} onGraphButtonClick={onGraphButtonClick} />
          {
          compProps.color && <div className="color-dot" style={{backgroundColor: compProps.color}}/>
          }
          <div className="display-text">
            {compProps.label + compProps.value}
          </div>
        </div>
      );
    };
    // <input
    //   className="text-input"
    //   ref={inputRef}
    //   type={"text"}
    //   value={compProps.value}
    //   onChange={handleChange(compProps.onChange)}
    // />
  }

  public setValue = (val: string) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  };

  public setColor = (color: string) => {
    this.props.color = color;
  };

  public getValue = () => {
    return this.props.value;
  };
}
/* eslint-enable */
