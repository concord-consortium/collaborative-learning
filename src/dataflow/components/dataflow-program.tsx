import "@babel/polyfill"; // errors about missing `regeneratorRuntime` without this
import { inject, observer } from "mobx-react";
import { BaseComponent, IBaseProps } from "./dataflow-base";
import * as React from "react";
import Rete from "rete";
import { Node } from "rete";
import ConnectionPlugin from "rete-connection-plugin";
import ReactRenderPlugin from "rete-react-render-plugin";
import ContextMenuPlugin from "rete-context-menu-plugin";
import { NodeData } from "rete/types/core/data";
import { autorun } from "mobx";

import "./dataflow-program.sass";

interface IProps extends IBaseProps {}

interface IState {}

const numSocket = new Rete.Socket("Number value");

// cf. https://codesandbox.io/s/retejs-react-render-t899c
class NumControl extends Rete.Control {
  private emitter: any;
  private component: any;
  private props: any;
  constructor(emitter: any, key: string, node: any, readonly = false) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    const handleChange = (onChange: any) => {
      return (e: any) => onChange(+e.target.value);
    };
    const handlePointerMove = (e: any) => e.stopPropagation();
    this.component = (compProps: { value: any; onChange: any; }) => (
      <input
        type="number"
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

class NumComponent extends Rete.Component {
  constructor() {
    super("Number");
  }

   public builder(node: Node) {
    const out1 = new Rete.Output("num", "Number", numSocket);
    const ctrl = new NumControl(this.editor, "num", node);

    return node.addControl(ctrl).addOutput(out1) as any;
  }

   public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.num;
  }
}

class SensorComponent extends Rete.Component {
  constructor(name: string) {
    super(name);
  }

   public builder(node: Node) {
    const out1 = new Rete.Output("num", "Number", numSocket);
    const ctrl = new NumControl(this.editor, "num", node, true);

    return node.addControl(ctrl).addOutput(out1) as any;
  }

   public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.num;
  }
}

class AddComponent extends Rete.Component {
  constructor() {
    super("Add");
  }

  public builder(node: Node) {
    const inp1 = new Rete.Input("num1", "Number", numSocket);
    const inp2 = new Rete.Input("num2", "Number2", numSocket);
    const out = new Rete.Output("num", "Number", numSocket);

    inp1.addControl(new NumControl(this.editor, "num1", node));
    inp2.addControl(new NumControl(this.editor, "num2", node));

    return node
      .addInput(inp1)
      .addInput(inp2)
      .addControl(new NumControl(this.editor, "preview", node, true))
      .addOutput(out) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 = inputs.num2.length ? inputs.num2[0] : node.data.num2;
    const sum = n1 + n2;

    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const preview = _node.controls.get("preview") as NumControl;
        preview && preview.setValue(sum);
      }
    }

    outputs.num = sum;
  }
}

@inject("stores")
@observer
export class DataflowProgram extends BaseComponent<IProps, IState> {
  private toolDiv: HTMLElement | null;
  private registeredThings: string[] = [];

  public render() {
    return (
      <div className="flow-tool" ref={elt => this.toolDiv = elt} />
    );
  }

  public componentDidMount() {
    (async () => {
      const components = [new NumComponent(), new AddComponent()];
      if (!this.toolDiv) return;

      const editor = new Rete.NodeEditor("demo@0.1.0", this.toolDiv);
      editor.use(ConnectionPlugin);
      editor.use(ReactRenderPlugin);
      editor.use(ContextMenuPlugin);

      const engine = new Rete.Engine("demo@0.1.0");

      components.map(c => {
        editor.register(c);
        engine.register(c);
      });

      const n1 = await components[0].createNode({ num: 2 });
      const n2 = await components[0].createNode({ num: 3 });
      const add = await components[1].createNode();

      n1.position = [80, 200];
      n2.position = [80, 400];
      add.position = [500, 240];

      editor.addNode(n1);
      editor.addNode(n2);
      editor.addNode(add);

      editor.connect(n1.outputs.get("num")!, add.inputs.get("num1")!);
      editor.connect(n2.outputs.get("num")!, add.inputs.get("num2")!);

      (editor as any).on(
        "process nodecreated noderemoved connectioncreated connectionremoved",
        async () => {
          await engine.abort();
          await engine.process(editor.toJSON());
        }
      );

      // Can this be in a control with stores injected
      autorun(() => {
        const { thingStore } = this.stores;

        thingStore.things.forEach(thing => {
          if (!this.registeredThings.includes(thing.thingArn)) {
            this.registeredThings.push(thing.thingArn);
            const newComponent = new SensorComponent(thing.thingName);
            editor.register(newComponent);
            engine.register(newComponent);
          }
        });
      });

      // Can this auto-call processing and be in the sensor component instead of doing this n^2 loop
      autorun(() => {
        const { thingStore } = this.stores;
        let change = false;

        thingStore.things.forEach(thing => {
          const thingValue = thing.value;
          if (thingValue) {
            const block = editor.nodes.find((n: Node) => n.name === thing.thingName);
            if (block) {
              const control = block.controls.get("num") as NumControl;
              if (control && control.getValue() !== thingValue) {
                control.setValue(thingValue);
                change = true;
              }
            }
          }
        });

        if (change) {
          (async () => {
            await engine.abort();
            await engine.process(editor.toJSON());
          })();
        }
      });

      editor.view.resize();
      (editor as any).trigger("process");
    })();
  }
}
