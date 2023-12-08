import React, { useEffect, useRef } from "react";
import { DotsElt } from "../d3-types";
import { PlotProps } from "../graph-types";
import { DataConfigurationContext } from "../hooks/use-data-configuration-context";
import { IGraphLayerModel } from "../models/graph-layer-model";
import { IGraphModel } from "../models/graph-model";
import { ChartDots } from "./chartdots";
import { DotPlotDots } from "./dotplotdots";
import { ScatterDots } from "./scatterdots";


export interface GraphLayerProps {
  graphModel: IGraphModel;
  layer: IGraphLayerModel;
  enableAnimation: React.MutableRefObject<boolean>;
}

/**
 * Render a single layer of the Graph.
 *
 * @param props - properties object
 * @param props.enableAnimation - Ref indicating whether animation of changes is currently desired
 */
export const GraphLayer = function GraphLayer({ graphModel, layer, enableAnimation }: GraphLayerProps) {

  const dotsRef = useRef<DotsElt>(null);

  useEffect(() => {
    layer.setDotsElt(dotsRef.current);
  }, [layer, dotsRef]);

  const plotProps: PlotProps = {
    enableAnimation,
    dotsRef
  };

  const typeToPlotComponentMap = {
    casePlot: null, // <CaseDots {...props}/>,
    dotChart: <ChartDots {...plotProps} />,
    dotPlot: <DotPlotDots {...plotProps} />,
    scatterPlot: <ScatterDots {...plotProps} />
  };

  return (
    <svg ref={dotsRef} key={layer.id} data-layer={layer.id} data-config={layer.config.id}>
      <DataConfigurationContext.Provider value={layer.config}>
        {typeToPlotComponentMap[graphModel.plotType]}
      </DataConfigurationContext.Provider>
    </svg>
  );

};
