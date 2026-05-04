import React, { useRef } from "react";
import { ClassicPreset } from "rete";
import PreviewPlotIcon from "../../assets/icons/preview-plot.svg";
import { observer } from "mobx-react";
import { useStopEventPropagation } from "./custom-hooks";
import { IBaseNode } from "../base-node";
import { handleBlockChildKeyDown } from "../dataflow-node";

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
    if (this.node.readOnly) return;
    this.model.setPlot(!this.model.plot);

    const toggleStr = this.model.plot ? "on" : "off";
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
    <div className="node-graph-toggle-button"
        title={showGraph ? "Hide Block Value Graph" : "Show Block Value Graph"}>
      <div
        ref={divRef}
        className={`graph-button main-color ${showGraph ? "active" : ""}`}
        role="button"
        tabIndex={-1}
        aria-label={showGraph ? "Hide block value graph" : "Show block value graph"}
        aria-pressed={showGraph}
        onClick={control.togglePlot}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            control.togglePlot();
            return;
          }
          handleBlockChildKeyDown(e);
        }}>
        <svg className="icon">
          <PreviewPlotIcon />
        </svg>
      </div>
    </div>
  );
});
