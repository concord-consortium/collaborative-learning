import React, { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { observer } from "mobx-react-lite";
import { IAdornmentModel } from "./adornment-models";
import { useGraphLayoutContext } from "../models/graph-layout";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { INumericAxisModel } from "../imports/components/axis/models/axis-model";
import { getAdornmentComponentInfo } from "./adornment-component-info";
import { IDotsRef, transitionDuration } from "../graph-types";

import "./adornment.scss";

interface IProps {
  adornment: IAdornmentModel
  subPlotKey: Record<string, string>
  topCats: string[] | number[]
  rightCats: string[] | number[]
  dotsRef?: IDotsRef
}

export const Adornment = observer(function Adornment(
  {adornment, subPlotKey, topCats, rightCats, dotsRef}: IProps
) {
  const graphModel = useGraphModelContext(),
    layout = useGraphLayoutContext(),
    subPlotWidth = topCats.length > 0
                     ? layout.plotWidth / topCats.length
                     : layout.plotWidth,
    subPlotHeight = rightCats.length > 0
                      ? layout.plotHeight / rightCats.length
                      : layout.plotHeight,
    isFadeInComplete = useRef(false),
    isFadeOutComplete = useRef(false);

  useEffect(function fadeInCleanup() {
    isFadeInComplete.current = adornment.isVisible;
    isFadeOutComplete.current = !adornment.isVisible;
  }, [adornment.isVisible]);

  const classFromSubPlotKey = adornment.classNameFromKey(subPlotKey);
  // The adornmentKey is a unique value used for React's key prop and for the adornment wrapper's HTML ID.
  // We can't use the subPlotKey because that value may be duplicated if there are multiple types of
  // adornments active on the graph.
  const adornmentKey = `${adornment.id}${classFromSubPlotKey ? `-${classFromSubPlotKey}` : ''}`;
  const componentInfo = getAdornmentComponentInfo(adornment.type);
  if (!componentInfo) return null;
  const { Component } = componentInfo;

  const adornmentWrapperClass = clsx(
    'adornment-wrapper',
    `${adornmentKey}-wrapper`,
    `${classFromSubPlotKey}`,
    {
      'fadeIn': adornment.isVisible && !isFadeInComplete.current,
      'fadeOut': !adornment.isVisible && !isFadeOutComplete.current,
      'hidden': !adornment.isVisible && isFadeOutComplete.current
    }
  );

  return (
    <div
      id={adornmentKey}
      className={adornmentWrapperClass}
      style={{animationDuration: `${transitionDuration}ms`}}
      data-testid={'adornment-wrapper'}
    >
      <Component
        containerId={adornmentKey}
        key={adornmentKey}
        model={adornment}
        plotHeight={subPlotHeight}
        plotWidth={subPlotWidth}
        subPlotKey={subPlotKey}
        xAxis={graphModel.getAxis('bottom') as INumericAxisModel}
        yAxis={graphModel.getAxis('left') as INumericAxisModel}
        dotsRef={dotsRef}
      />
    </div>
  );
});
