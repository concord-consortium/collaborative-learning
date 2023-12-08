import {MutableRefObject, useCallback, useEffect} from "react";
import {isAddCasesAction, isRemoveCasesAction} from "../../../models/data/data-set-actions";
import {IGraphModel, isGraphVisualPropsAction} from "../models/graph-model";
import {matchAllCirclesToData, matchCirclesToData, setNiceDomain, startAnimation} from "../utilities/graph-utils";
import {onAnyAction} from "../../../utilities/mst-utils";
import { reaction } from "mobx";

interface IProps {
  graphModel: IGraphModel;
  enableAnimation: MutableRefObject<boolean>;
  instanceId: string | undefined;
}

export function useGraphModel(props: IProps) {
  const { graphModel, enableAnimation, instanceId } = props;

  const callMatchCirclesToData = useCallback((layer) => {
    matchCirclesToData({
      dataConfiguration: layer.config,
      pointRadius: graphModel.getPointRadius(),
      pointColor: graphModel.pointColor,
      pointStrokeColor: graphModel.pointStrokeColor,
      dotsElement: layer.dotsElt,
      enableAnimation, instanceId
    });
  }, [graphModel, enableAnimation, instanceId]);

  const callMatchAllCirclesToData = useCallback(() => {
    matchAllCirclesToData({
      graphModel, enableAnimation, instanceId
    });
  }, [graphModel, enableAnimation, instanceId]);

  // respond to added/removed cases
  useEffect(function installAddRemoveCaseHandler() {
    const disposers: (()=>void)[] = [];
    for (const layer of graphModel.layers) {
      disposers.push(layer.config.onAction(action => {
        if (isAddCasesAction(action) || isRemoveCasesAction(action)) {
          callMatchCirclesToData(layer);
        }
      }));
    }
    return () => { disposers.forEach((d) => { d(); }); };
  }, [graphModel.layers, callMatchCirclesToData]);

  // respond to change in plotType
  useEffect(function installPlotTypeAction() {
    const disposer = onAnyAction(graphModel, action => {
      if (action.name === 'setPlotType') {
        const newPlotType = action.args?.[0];
        startAnimation(enableAnimation);
        // In case the y-values have changed we rescale
        if (newPlotType === 'scatterPlot') {
          const yAxisModel = graphModel.getAxis('left');
          yAxisModel && setNiceDomain(graphModel.numericValuesForYAxis, yAxisModel);
        }
      }
    });
    return () => disposer();
  }, [enableAnimation, graphModel]);

  // respond to layer update
  useEffect(function respondToLayerChange() {
    return reaction(
      () => { return graphModel.layers.map(l => l.dotsElt); },
      (dotsElements) => {
        // Is there some way to determine _which_ layer has changed here?
        // It feels inefficient to always rematch them all.
        callMatchAllCirclesToData();
      }
    );
  }, [callMatchAllCirclesToData, graphModel]);

  // respond to point properties change
  useEffect(function respondToGraphPointVisualAction() {
    const disposer = onAnyAction(graphModel, action => {
      if (isGraphVisualPropsAction(action)) {
        callMatchAllCirclesToData();
      }
    });
    return () => disposer();
  }, [callMatchAllCirclesToData, graphModel]);

}
