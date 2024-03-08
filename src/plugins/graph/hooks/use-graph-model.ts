import {MutableRefObject, useCallback, useEffect} from "react";
import {IGraphModel, isGraphVisualPropsAction} from "../models/graph-model";
import {matchAllCirclesToData, setNiceDomain, startAnimation} from "../utilities/graph-utils";
import {onAnyAction} from "../../../utilities/mst-utils";

interface IProps {
  graphModel: IGraphModel;
  enableAnimation: MutableRefObject<boolean>;
  instanceId: string | undefined;
}

export function useGraphModel(props: IProps) {
  const { graphModel, enableAnimation, instanceId } = props;

  // const callMatchCirclesToData = useCallback((layer) => {
  //   matchCirclesToData({
  //     dataConfiguration: layer.config,
  //     pointRadius: graphModel.getPointRadius(),
  //     pointColor: graphModel.pointColor,
  //     pointStrokeColor: graphModel.pointStrokeColor,
  //     dotsElement: layer.dotsElt,
  //     enableAnimation, instanceId
  //   });
  // }, [graphModel, enableAnimation, instanceId]);

  const callMatchAllCirclesToData = useCallback(() => {
    matchAllCirclesToData({
      graphModel, enableAnimation, instanceId
    });
  }, [graphModel, enableAnimation, instanceId]);

  // respond to added/removed cases
  // TODO seems redundant with use-plot.ts handleAddRemoveCases
  // useEffect(function installAddRemoveCaseHandler() {
  //   const disposers: (()=>void)[] = [];
  //   for (const layer of graphModel.layers) {
  //     console.log("registering layer responder");
  //     disposers.push(layer.config.onAction(action => {
  //       console.log('layer responder examining', action);
  //       if (isAddCasesAction(action) || isRemoveCasesAction(action)) {
  //         callMatchCirclesToData(layer);
  //       }
  //     }));
  //   }
  //   return () => { disposers.forEach((d) => { d(); }); };
  // }, [graphModel.layers, callMatchCirclesToData]);

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
