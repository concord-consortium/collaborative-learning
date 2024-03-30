import React, { useRef } from "react";
import { ClassicPreset } from "rete";

import PreviewPlotIcon from "../../assets/icons/preview-plot.svg";

import "./plot-button-control.scss";
import { observer } from "mobx-react";
import { useStopEventPropagation } from "./custom-hooks";
import { IBaseNode } from "../nodes/base-node";

interface PlottableModel {
  plot: boolean;
  setPlot: (val: boolean) => void;
}

export class PlotButtonControl extends ClassicPreset.Control
{
  constructor(
    public node: IBaseNode & { model: PlottableModel }
  ) {
    super();
  }

  get model() {
    return this.node.model;
  }

  togglePlot = () => {
    this.model.setPlot(!this.model.plot);

    const toggleStr = this.model.plot ? "off" : "on";
    this.node.logNodeEvent(`toggle minigraph ${toggleStr}`);
  };
}

export const PlotButtonControlComponent = observer(
  function PlotButtonControlComponent(props: {data: PlotButtonControl})
{
  const control = props.data;
  const showGraph = control.model.plot;

  const divRef = useRef<HTMLDivElement>(null);
  useStopEventPropagation(divRef, "pointerdown");
  useStopEventPropagation(divRef, "dblclick");

  return (
    <div className="node-graph-container"
        title={showGraph ? "Hide Block Value Graph" : "Show Block Value Graph"}>
      <div
        ref={divRef}
        className={`graph-button main-color ${showGraph ? "active" : ""}`}
        onClick={control.togglePlot}>
        <svg className="icon">
          <PreviewPlotIcon />
        </svg>
      </div>
    </div>
  );
});
