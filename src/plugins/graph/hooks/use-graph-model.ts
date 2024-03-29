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

  const callMatchAllCirclesToData = useCallback(() => {
    matchAllCirclesToData({
      graphModel, enableAnimation, instanceId
    });
  }, [graphModel, enableAnimation, instanceId]);

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
