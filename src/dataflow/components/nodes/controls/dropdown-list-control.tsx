import * as React from "react";
import Rete from "rete";

export class DropdownListControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  constructor(emitter: any, key: string, node: any, optionArray: any, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;

    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };
    const handlePointerMove = (e: any) => e.stopPropagation();

    this.component = (compProps: { value: any; onChange: any; optionArray: any; }) => (
      <select
        value={compProps.value}
        onChange={handleChange(compProps.onChange)}
        onPointerMove={handlePointerMove}>
        {compProps.optionArray.map((val: any, i: any) => (
          <option key={i} value={val}>
            {val}
          </option>
        ))}
      </select>
    );

    const initial = node.data[key] || optionArray[0];
    node.data[key] = initial;

    this.props = {
      readonly,
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      optionArray
    };
  }

  public setValue = (val: any) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }

  public setOptions = (options: any) => {
    this.props.optionArray = options;
    // problem, if called with event nodecreate, update doesn't exist
  }
}
