import * as React from "react";
import Rete from "rete";

// cf. https://codesandbox.io/s/retejs-react-render-t899c
export class NumControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  constructor(emitter: any, key: string, node: any, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(+e.target.value); };
    };
    const handlePointerMove = (e: any) => e.stopPropagation();
    this.component = (compProps: { value: any; onChange: any; }) => (
      <input
        type={readonly ? "text" : "number"}
        value={compProps.value}
        onChange={handleChange(compProps.onChange)}
        onPointerMove={handlePointerMove}
      />
    );

    const initial = node.data[key] || 0;
    node.data[key] = initial;

    this.props = {
      readonly,
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      }
    };
  }

  public setValue = (val: number) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  }

  public getValue = () => {
    return this.props.value;
  }
}
