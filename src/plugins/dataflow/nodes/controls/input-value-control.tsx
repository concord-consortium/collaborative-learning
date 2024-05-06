import { ClassicPreset } from "rete";
import React from "react";
import { observer } from "mobx-react";
import { computed, makeObservable } from "mobx";
import { IBaseNode } from "../base-node";
import { MinigraphOptions, defaultMinigraphOptions } from "../dataflow-node-plot-types";
import { PlotButtonControl, PlotButtonControlComponent } from "./plot-button-control";

import "./input-value-control.scss";

export class InputValueControl
  extends ClassicPreset.Control
  implements IInputValueControl
{
  // In Dataflow v1 setting the value also updated the node data with putData
  // for the given key of the ValueControl. This approach overlapped with the
  // updating of the node data via the watchedValues feature.
  // The actual value was not used by the value control because in all cases
  // the setDisplayMessage was called too.
  // So in Dataflow v2 we are just getting rid of the value property and
  // each node will need to explicity save its calculated data in a
  // watchedValue property.

  constructor(
    public node: IBaseNode,
    public inputName: string,
    public label = "",
    public tooltip = "Something", // FIXME: need better default
    public getDisplayMessage: () => string
  ){
    super();
    makeObservable(this);
  }

  public get model() {
    return this.node.model;
  }

  @computed
  public get connected() {
    return this.node.isConnected(this.inputName);
  }

  @computed
  public get legendDotStyle() {
    const graphStyle = this.model.watchedValues[this.inputName];
    return graphStyle ?? defaultMinigraphOptions;
  }

  @computed
  public get plotButtonControl() {
    return new PlotButtonControl(this.node);
  }
}

export interface IInputValueControl {
  id: string;
  inputName: string;
  label: string;
  tooltip: string;
  getDisplayMessage(): string;
  connected: boolean;
  legendDotStyle: MinigraphOptions;
  plotButtonControl: PlotButtonControl;
}

export const InputValueControlComponent: React.FC<{ data: IInputValueControl; }> =
  observer(function InputValueControlComponent(props)
{
  const control = props.data;

  return (
    <div className="demo-output-value-container" title={control.tooltip}>
      <div className="left-content">
        <PlotButtonControlComponent data={control.plotButtonControl} />
        <div className="minigraph-legend">
          { control.connected
            ? <div
              className="legend-dot"
              style={control.legendDotStyle} />
            : '' }
        </div>
      </div>
      <div className="display-text">
        { control.label + control.getDisplayMessage() }
      </div>
    </div>
  );
});
