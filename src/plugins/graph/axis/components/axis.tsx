import React, {MutableRefObject, useState} from "react";
import {range} from "d3";
import {useAxis} from "../hooks/use-axis";
import {useAxisLayoutContext} from "../models/axis-layout-context";
import {IAxisModel} from "../models/axis-model";
import {SubAxis} from "./sub-axis";

import "./axis.scss";

interface IProps {
  getAxisModel: () => IAxisModel | undefined
  label?: string
  enableAnimation: MutableRefObject<boolean>
  showScatterPlotGridLines?: boolean
  centerCategoryLabels?: boolean
}

export const Axis = ({
                        label, getAxisModel, showScatterPlotGridLines = false,
                        centerCategoryLabels = true,
                        enableAnimation
}: IProps) => {
  const
    axisModel = getAxisModel(),
    layout = useAxisLayoutContext(),
    place = axisModel?.place || 'bottom',
    [axisElt, setAxisElt] = useState<SVGGElement | null>(null);

  console.log("<Axis> with props:", axisModel, layout, place, axisElt);

  useAxis({
    getAxisModel, axisElt, axisTitle: label, centerCategoryLabels
  });

  const getSubAxes = () => {
    const numRepetitions = layout.getAxisMultiScale(place)?.repetitions ?? 1;

    console.log("range(numRepititions:", range(numRepetitions));

    return range(numRepetitions).map(i => {
      return <SubAxis key={i}
                      numSubAxes={numRepetitions}
                      subAxisIndex={i}
                      getAxisModel={getAxisModel}
                      enableAnimation={enableAnimation}
                      showScatterPlotGridLines={showScatterPlotGridLines}
                      centerCategoryLabels={centerCategoryLabels}
      />;
    });
  };

  return (
    <g className='axis' ref={elt => setAxisElt(elt)} data-testid={`axis-${place}`}>
      {getSubAxes()}
    </g>
  );
};
