// FIXME: ESLint is unhappy with these control components
/* eslint-disable react-hooks/rules-of-hooks */
import React from "react";
import Rete, { NodeEditor, Node } from "rete";
import { PlotButtonControlComponent } from "./plot-button-control";
import { NodePlotColor } from "../../model/utilities/node";
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
    initVal = 0,
    tooltip = "",
    initDisplayMessage = "",
    backgroundColor = NodePlotColor,
    borderColor = NodePlotColor,
    valueDisplayFunction = (val: any) => val,
  ) {
    super(key);
    this.emitter = emitter;
    this.key = key;

    const initial = node.data[key] || initVal;
    node.data[key] = initial;

    this.props = {
      value: initial,
      onChange: (v: any) => {
        this.setValue(v);
        this.emitter.trigger("process");
      },
      label,
      tooltip,
      displayMessage: initDisplayMessage, // A message to display instead of the value
      backgroundColor,
      borderColor,
      connected: false,
      valueDisplayFunction
    };

    this.component = (compProps: {
      value: any,
      onChange: any,
      label: any,
      tooltip: string,
      displayMessage: string,
      backgroundColor: string,
      borderColor: string,
      connected: boolean,
      valueDisplayFunction: (val: any) => any
    }) => {
      return (
        <div className="demo-output-value-container" title={compProps.tooltip}>
          <div className="left-content">
            <PlotButtonControlComponent showgraph={false} onGraphButtonClick={onGraphButtonClick} />
            <div className="minigraph-legend">
              { compProps.connected
                ? <div
                  className="legend-dot"
                  style={{
                    backgroundColor: compProps.backgroundColor,
                    borderColor: compProps.borderColor
                  }} />
                : '' }
            </div>
          </div>
          <div className="display-text">
            {compProps.value === undefined
              ? "Undefined"
              : compProps.label + (compProps.displayMessage || compProps.valueDisplayFunction(compProps.value))}
          </div>
        </div>
      );
    };
  }

  public setValue = (val: number) => {
    this.props.value = val;
    this.putData(this.key, val);
    (this as any).update();
  };

  public setDisplayMessage = (message: string) => {
    this.props.displayMessage = message;
    (this as any).update();
  };

  public setConnected = (connected: boolean) => {
    this.props.connected = connected;
    (this as any).update();
  };

  public getValue = () => {
    return this.props.value;
  };
}
/* eslint-enable */
