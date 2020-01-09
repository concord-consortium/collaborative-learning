import * as React from "react";
import { useRef } from "react";
import Rete, { NodeEditor, Node } from "@concord-consortium/rete";
import { useStopEventPropagation } from "./custom-hooks";
import "./num-control.sass";

// cf. https://codesandbox.io/s/retejs-react-render-t899c
export class DeleteControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  private node: Node;

  constructor(emitter: NodeEditor,
              key: string,
              node: Node,
              readonly = false) {
    super(key);
    this.emitter = emitter;
    this.node = node;

    const handleClick = (onClick: any) => {
      return (e: any) => { onClick(); };
    };

    this.component = (compProps: { onClick: any }) => {
      const inputRef = useRef<HTMLInputElement>(null);
      useStopEventPropagation(inputRef, "pointerdown");
      return (
        <div className="close-node-button control-color control-color-hoverable"
          onClick={handleClick(compProps.onClick)} title={"Delete Node"}>
          <svg className="icon">
            <use xlinkHref="#icon-delete-node" />
          </svg>
        </div>
      );
    };

    this.props = {
      onClick: () => {
        this.emitter.removeNode(this.node);
        this.emitter.selected.clear();
      }
    };
  }
}
