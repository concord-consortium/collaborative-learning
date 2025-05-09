import React, {useCallback, useContext, useEffect, useRef} from "react";
import {autorun, reaction} from "mobx";
import { isAddCasesAction, isRemoveAttributeAction, isRemoveCasesAction, isSetCaseValuesAction }
  from "../../../models/data/data-set-actions";
import {IDotsRef, GraphAttrRoles} from "../graph-types";
import {INumericAxisModel} from "../imports/components/axis/models/axis-model";
import {useGraphLayoutContext} from "../models/graph-layout";
import {useGraphModelContext} from "../hooks/use-graph-model-context";
import {matchCirclesToData, startAnimation} from "../utilities/graph-utils";
import {useCurrent} from "../../../hooks/use-current";
import {useInstanceIdContext} from "../imports/hooks/use-instance-id-context";
import {onAnyAction} from "../../../utilities/mst-utils";
import { IGraphLayerModel } from "../models/graph-layer-model";
import { mstReaction } from "../../../utilities/mst-reaction";
import { useReadOnlyContext } from "../../../components/document/read-only-context";
import { GraphControllerContext } from "../models/graph-controller";
import { useGraphSettingsContext } from "./use-graph-settings-context";

interface IDragHandlers {
  start: (event: MouseEvent) => void
  drag: (event: MouseEvent) => void
  end: (event: MouseEvent) => void
}

export const useDragHandlers = (target: any, {start, drag, end}: IDragHandlers) => {
  const readOnly = useReadOnlyContext();
  useEffect(() => {
    if (target && !readOnly) {
      target.addEventListener('mousedown', start);
      target.addEventListener('mousemove', drag);
      target.addEventListener('mouseup', end);
      // On cleanup, remove event listeners
      return () => {
        target.removeEventListener('mousedown', start);
        target.removeEventListener('mousemove', drag);
        target.removeEventListener('mouseup', end);
      };
    }
  }, [target, start, drag, end, readOnly]);
};

export interface IPlotResponderProps {
  layer: IGraphLayerModel;
  refreshPointPositions: (selectedOnly: boolean) => void;
  refreshPointSelection: () => void;
  dotsRef: IDotsRef;
  enableAnimation: React.MutableRefObject<boolean>;
}

export const usePlotResponders = (props: IPlotResponderProps) => {
  const {layer, enableAnimation, refreshPointPositions, refreshPointSelection, dotsRef} = props,
    dataConfiguration = layer.config,
    dataset = dataConfiguration?.dataset,
    graphModel = useGraphModelContext(),
    layout = useGraphLayoutContext(),
    instanceId = useInstanceIdContext(),
    controller = useContext(GraphControllerContext),
    graphSettings = useGraphSettingsContext(),
    refreshPointPositionsRef = useCurrent(refreshPointPositions);

  useEffect(function respondToLayerDotsEltCreation() {
    return reaction(
      () => { return layer.dotsElt; },
      (dotsElt) => {
        matchCirclesToData({
          dataConfiguration,
          pointRadius: graphModel.getPointRadius(),
          pointColor: graphModel.pointColor,
          pointStrokeColor: graphModel.pointStrokeColor,
          dotsElement: dotsElt,
          enableAnimation,
          instanceId
        });

      }
    );
  }, [dataConfiguration, enableAnimation, graphModel, instanceId, layer.dotsElt]);

  /* This routine is frequently called many times in a row when something about the graph changes that requires
  * refreshing the plot's point positions. That, by itself, would be a reason to ensure that
  * the actual refreshPointPositions function is only called once. But another, even more important reason is
  * that there is no guarantee that when callRefreshPointPositions is invoked, the d3 points in the plot
  * have been synced with the data configuration's notion of which cases are plottable. Delaying the actual
  * plotting of points until the next event cycle ensures that the data configuration's filter process will
  * have had a chance to take place. */
  const timer = useRef<any>();
  const callRefreshPointPositions = useCallback((selectedOnly: boolean) => {
    if (timer.current) {
      return;
    }
    timer.current = setTimeout(() => {
      refreshPointPositionsRef.current(selectedOnly);
      timer.current = null;
    }, 10);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [refreshPointPositionsRef]);

  useEffect(function doneWithTimer() {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const callRescaleIfNeeded = useCallback((growOnly: boolean = false) => {
    const currentLayer = graphModel.layerForDataConfigurationId(dataConfiguration.id);
    if (graphSettings.scalePlotOnValueChange &&
        !graphModel.lockAxes &&
        !graphModel.interactionInProgress &&
        // If the layer is editable (i.e. manual points is enabled), do not autoscale the axes
        !currentLayer?.editable) {
      controller!.autoscaleAllAxes(growOnly);
    }
  }, [controller, dataConfiguration.id, graphModel, graphSettings.scalePlotOnValueChange]);

  // respond to numeric axis domain changes (e.g. axis dragging)
  useEffect(() => {
    const disposer = mstReaction(
      () => {
        const xNumeric = graphModel.getAxis('bottom') as INumericAxisModel;
        const yNumeric = graphModel.getAxis('left') as INumericAxisModel;
        const y2Numeric = graphModel.getAxis('rightNumeric') as INumericAxisModel;
        return [xNumeric?.domain, yNumeric?.domain, y2Numeric?.domain];
      },
      () => {
        callRefreshPointPositions(false);
      },
      {fireImmediately: true, name: "usePlot.domain reaction"},
      graphModel
    );
    return () => disposer();
  }, [callRefreshPointPositions, graphModel]);

  useEffect(function respondToCategorySetChanges() {
    return reaction(() => {
      return layout.categorySetArrays;
    }, (categorySetsArrays) => {
      if (categorySetsArrays.length) {
        startAnimation(enableAnimation);
        callRefreshPointPositions(false);
      }
    });
  }, [callRefreshPointPositions, enableAnimation, layout.categorySetArrays]);

  // respond to attribute assignment changes
  useEffect(() => {
    const disposer = mstReaction(
      () => GraphAttrRoles.map((aRole) => dataConfiguration?.attributeID(aRole)),
      () => {
        startAnimation(enableAnimation);
        callRefreshPointPositions(false);
      },
      { name: "usePlot.attribute assignment reaction" },
      dataConfiguration
    );
    return () => disposer();
  }, [callRefreshPointPositions, dataConfiguration, enableAnimation]);

  // respond to axis range changes (e.g. component resizing)
  useEffect(() => {
    const disposer = reaction(
      () => [layout.getAxisLength('left'), layout.getAxisLength('bottom')],
      () => {
        callRefreshPointPositions(false);
      }
    );
    return () => disposer();
  }, [layout, callRefreshPointPositions]);

  // respond to value changes
  useEffect(() => {
    if (dataset) {
      const disposer = onAnyAction(dataset, action => {
        if (isSetCaseValuesAction(action)) {
          callRescaleIfNeeded();
          // assumes that if we're caching then only selected cases are being updated
          callRefreshPointPositions(dataset.isCaching);
          // TODO: handling of add/remove cases was added specifically for the case plot.
          // Bill has expressed a desire to refactor the case plot to behave more like the
          // other plots, which already handle removal of cases (and perhaps addition of cases?)
          // without this. Should check to see whether this is necessary down the road.
        } else if (["addCases", "removeCases"].includes(action.name)) {
          callRefreshPointPositions(false);
        }
      });
      return () => disposer();
    }
  }, [dataset, callRefreshPointPositions, callRescaleIfNeeded]);

  // respond to color changes
  useEffect(() => {
    return mstReaction(
      () => {
        const colors: Record<string, string> = {};
        const layers = Array.from(graphModel.layers);
        const descriptions = layers.map(l => l.config.yAttributeDescriptions);
        descriptions.forEach(desc => desc.forEach(
          d => colors[d.attributeID] = graphModel.getColorForId(d.attributeID)));
        return JSON.stringify(colors);
      },
      colorString => callRefreshPointPositions(false),
      { name: "usePlot.color reaction" },
      graphModel
    );
  }, [graphModel, callRefreshPointPositions]);

  // respond to selection change
  useEffect(function respondToSelectionChange() {
    return mstReaction(
      () => [dataset?.selectionIdString],
      () => refreshPointSelection(),
      { name: "usePlot.selection reaction" },
      graphModel
    );
  }, [graphModel, dataset, refreshPointSelection]);

  // respond to added or removed cases and change in attribute type
  useEffect(function handleAddRemoveCases() {
    const disposer = dataConfiguration?.onAction(action => {
      if (isAddCasesAction(action)
          || isRemoveCasesAction(action)
          || isRemoveAttributeAction(action)
          || ['addCases', 'removeCases', 'setAttributeType'].includes(action.name)) {

        matchCirclesToData({
          dataConfiguration,
          pointRadius: graphModel.getPointRadius(),
          pointColor: graphModel.pointColor,
          pointStrokeColor: graphModel.pointStrokeColor,
          dotsElement: dotsRef.current,
          enableAnimation, instanceId
        });
        const growOnly = isAddCasesAction(action);
        callRescaleIfNeeded(growOnly);
        callRefreshPointPositions(false);
      }
    }) || (() => true);
    return () => disposer();
  }, [controller, dataset, dataConfiguration, enableAnimation, graphModel,
    callRefreshPointPositions, dotsRef, instanceId, callRescaleIfNeeded]);

  // respond to pointsNeedUpdating becoming false; that is when the points have been updated
  // Happens when the number of plots has changed for now. Possibly other situations in the future.
  useEffect(() => {
    return autorun(
      () => {
        !dataConfiguration?.pointsNeedUpdating && callRefreshPointPositions(false);
      });
  }, [dataConfiguration, callRefreshPointPositions]);

};
