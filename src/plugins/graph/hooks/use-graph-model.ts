import { MutableRefObject, useCallback, useEffect } from "react";
import { isAddCasesAction, isRemoveCasesAction } from "../../../models/data/data-set-actions";
import { IGraphModel, isGraphVisualPropsAction } from "../models/graph-model";
import { useDataSetContext } from "../imports/hooks/use-data-set-context";
import { INumericAxisModel } from "../imports/components/axis/models/axis-model";
import { IDotsRef } from "../graph-types";
import { matchCirclesToData, setNiceDomain, startAnimation } from "../utilities/graph-utils";
import { onAnyAction } from "../../../utilities/mst-utils";

interface IProps {
  graphModel: IGraphModel
  enableAnimation: MutableRefObject<boolean>
  dotsRef: IDotsRef
  instanceId: string | undefined
}

export function useGraphModel(props: IProps) {
  const { graphModel, enableAnimation, dotsRef, instanceId } = props,
    dataConfig = graphModel.config,
    yAttrID = graphModel.getAttributeID('y'),
    dataset = useDataSetContext();

  const callMatchCirclesToData = useCallback(() => {
    matchCirclesToData({
      dataConfiguration: dataConfig,
      pointRadius: graphModel.getPointRadius(),
      pointColor: graphModel.pointColor,
      pointStrokeColor: graphModel.pointStrokeColor,
      dotsElement: dotsRef.current,
      enableAnimation, instanceId
    });
  }, [dataConfig, graphModel, dotsRef, enableAnimation, instanceId]);

  // respond to added/removed cases
  useEffect(function installAddRemoveCaseHandler() {
    return dataConfig.onAction(action => {
      if (isAddCasesAction(action) || isRemoveCasesAction(action)) {
        callMatchCirclesToData();
      }
    });
  }, [callMatchCirclesToData, dataConfig]);

  // respond to change in plotType
  useEffect(function installPlotTypeAction() {
    const disposer = onAnyAction(graphModel, action => {
      if (action.name === 'setPlotType') {
        const newPlotType = action.args?.[0];/*,
          attrIDs = newPlotType === 'dotPlot' ? [xAttrID] : [xAttrID, yAttrID]*/
        startAnimation(enableAnimation);
        // In case the y-values have changed we rescale
        if (newPlotType === 'scatterPlot') {
          const yAxisModel = graphModel.getAxis('left');
          const values = dataConfig.caseDataArray.map(({ caseID }) => dataset?.getNumeric(caseID, yAttrID)) as number[];
          setNiceDomain(values || [], yAxisModel as INumericAxisModel);
        }
      }
    });
    return () => disposer();
  }, [dataConfig.caseDataArray, dataset, enableAnimation, graphModel, yAttrID]);

  // respond to point properties change
  useEffect(function respondToGraphPointVisualAction() {
    const disposer = onAnyAction(graphModel, action => {
      if (isGraphVisualPropsAction(action)) {
        callMatchCirclesToData();
      }
    });
    return () => disposer();
  }, [callMatchCirclesToData, graphModel]);

}
