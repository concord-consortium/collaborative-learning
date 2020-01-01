import * as React from "react";
import Rete, { NodeEditor, Node } from "rete";
import "./plot-button-control.sass";

export class PlotButtonControl extends Rete.Control {
  private emitter: NodeEditor;
  private component: any;
  private props: any;
  private node: Node;
  private stepY = 5;

  constructor(emitter: NodeEditor, key: string, node: Node) {
    super(key);
    this.emitter = emitter;
    this.key = key;
    this.node = node;

    const initial = node.data[key] || false;
    node.data[key] = initial;

    const handleChange = (onChange: any) => {
      return (e: any) => { onChange(e.target.value); };
    };

    this.component = (compProps: {showgraph: any; onGraphButtonClick: any; }) => (
      <div className="node-graph-container"
           title={compProps.showgraph ? "Hide Node Value Graph" : "Show Node Value Graph"}>
        <div
          className={`graph-button main-color ${compProps.showgraph ? "active" : ""}`}
          onClick={handleChange(compProps.onGraphButtonClick)}>
          <svg className="icon">
            <use xlinkHref="#icon-preview-plot" />
          </svg>
        </div>
      </div>
    );

    this.props = {
      showgraph: initial,
      onGraphButtonClick: () => {
        this.setGraph(!this.props.showgraph);
      }
    };
  }

  public setGraph = (show: boolean) => {
    this.props.showgraph = show;
    this.putData(this.key, show);
    // this update is needed to ensure that we redraw the plot
    // in the proper state after the button is pressed
    this.node.update();
    this.emitter.trigger("process");
  }

}
