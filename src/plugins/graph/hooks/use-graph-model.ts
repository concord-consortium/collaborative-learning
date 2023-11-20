import {MutableRefObject, useCallback, useEffect} from "react";
import {isAddCasesAction, isRemoveCasesAction} from "../../../models/data/data-set-actions";
import {IGraphModel, isGraphVisualPropsAction} from "../models/graph-model";
import {IDotsRef} from "../graph-types";
import {matchCirclesToData} from "../utilities/graph-utils";
import {onAnyAction} from "../../../utilities/mst-utils";

interface IProps {
  graphModel: IGraphModel
  enableAnimation: MutableRefObject<boolean>
  dotsRef: IDotsRef
  instanceId: string | undefined
}

export function useGraphModel(props: IProps) {
  const { graphModel, enableAnimation, dotsRef, instanceId } = props;

  const callMatchCirclesToData = useCallback(() => {
    for (const layer of graphModel.layers) {
      matchCirclesToData({
        dataConfiguration: layer.config,
        pointRadius: graphModel.getPointRadius(),
        pointColor: graphModel.pointColor,
        pointStrokeColor: graphModel.pointStrokeColor,
        dotsElement: dotsRef.current,
        enableAnimation, instanceId
      });
    }
  }, [graphModel, dotsRef, enableAnimation, instanceId]);

  // respond to added/removed cases
  useEffect(function installAddRemoveCaseHandler() {
    for (const layer of graphModel.layers) {
      return layer.config.onAction(action => {
        if (isAddCasesAction(action) || isRemoveCasesAction(action)) {
          callMatchCirclesToData(); // TODO make this only call it for one layer
        }
      });
    }
  }, [graphModel.layers, callMatchCirclesToData]);

  // // respond to change in plotType -- TODO
  // useEffect(function installPlotTypeAction() {
  //   const disposer = onAnyAction(graphModel, action => {
  //     if (action.name === 'setPlotType') {
  //       const { caseDataArray } = dataConfig || {};
  //       const newPlotType = action.args?.[0];/*,
  //         attrIDs = newPlotType === 'dotPlot' ? [xAttrID] : [xAttrID, yAttrID]*/
  //       startAnimation(enableAnimation);
  //       // In case the y-values have changed we rescale
  //       if (newPlotType === 'scatterPlot') {
  //         const yAxisModel = graphModel.getAxis('left');
  //         if (caseDataArray) {
  //           const values
  //             = caseDataArray.map(({ caseID }) => dataset?.getNumeric(caseID, yAttrID)) as number[];
  //           setNiceDomain(values || [], yAxisModel as INumericAxisModel);
  //         }
  //       }
  //     }
  //   });
  //   return () => disposer();
  // }, [dataConfig, dataset, enableAnimation, graphModel, yAttrID]);

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
