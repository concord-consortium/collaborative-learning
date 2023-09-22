import React from "react";
import Rete, { NodeEditor, Node } from "rete";
import PreviewPlotIcon from "../../assets/icons/preview-plot.svg";
import { dataflowLogEvent } from "../../dataflow-logger";

import "./plot-button-control.scss";

const handleChange = (onChange: any) => {
  return (e: any) => { onChange(e.target.value); };
};

export const PlotButtonControlComponent = (compProps: { showgraph: any; onGraphButtonClick: any; }) => (
  <div className="node-graph-container"
       title={compProps.showgraph ? "Hide Block Value Graph" : "Show Block Value Graph"}>
    <div
      className={`graph-button main-color ${compProps.showgraph ? "active" : ""}`}
      onClick={handleChange(compProps.onGraphButtonClick)}>
      <svg className="icon">
        <PreviewPlotIcon />
      </svg>
    </div>
  </div>
);

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

    this.props = {
      showgraph: initial,
      onGraphButtonClick: () => {
        this.logGraphToggle();
        this.setGraph(!this.props.showgraph);
      }
    };

    this.component = PlotButtonControlComponent;
  }

  public setGraph = (show: boolean) => {
    this.props.showgraph = show;
    this.putData(this.key, show);
    // this update is needed to ensure that we redraw the plot
    // in the proper state after the button is pressed
    this.node.update();
    this.emitter.trigger("process");
  };

  public logGraphToggle = () => {
    const toggleStr = this.props.showgraph ? "off" : "on";
    const tileId = this.node.meta.inTileWithId as string;
    dataflowLogEvent(`toggle minigraph ${toggleStr}`, this.node, tileId);
  };
}
