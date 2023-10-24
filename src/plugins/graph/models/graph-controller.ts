import React from "react";
import {IGraphModel} from "./graph-model";
import {GraphLayout} from "./graph-layout";
import {getDataSetFromId} from "../../../models/shared/shared-data-utils";
import {AxisPlace, AxisPlaces} from "../imports/components/axis/axis-types";
import {
  CategoricalAxisModel, EmptyAxisModel, isCategoricalAxisModel, isEmptyAxisModel, isNumericAxisModel, NumericAxisModel
} from "../imports/components/axis/models/axis-model";
import {
  axisPlaceToAttrRole, graphPlaceToAttrRole, IDotsRef, kDefaultNumericAxisBounds, PlotType
} from "../graph-types";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {matchCirclesToData, setNiceDomain} from "../utilities/graph-utils";
import { getAppConfig } from "../../../models/tiles/tile-environment";

// keys are [primaryAxisType][secondaryAxisType]
const plotChoices: Record<string, Record<string, PlotType>> = {
  empty: {empty: 'casePlot', numeric: 'dotPlot', categorical: 'dotChart'},
  numeric: {empty: 'dotPlot', numeric: 'scatterPlot', categorical: 'dotPlot'},
  categorical: {empty: 'dotChart', numeric: 'dotPlot', categorical: 'dotChart'}
};

interface IGraphControllerConstructorProps {
  layout: GraphLayout
  enableAnimation: React.MutableRefObject<boolean>
  instanceId: string
  autoAdjustAxes: React.MutableRefObject<boolean>
}

interface IGraphControllerProps {
  graphModel: IGraphModel
  dotsRef: IDotsRef
}

export class GraphController {
  graphModel?: IGraphModel;
  dotsRef?: IDotsRef;
  layout: GraphLayout;
  enableAnimation: React.MutableRefObject<boolean>;
  instanceId: string;
  autoAdjustAxes: React.MutableRefObject<boolean>;

  constructor({layout, enableAnimation, instanceId, autoAdjustAxes}: IGraphControllerConstructorProps) {
    this.layout = layout;
    this.instanceId = instanceId;
    this.enableAnimation = enableAnimation;
    this.autoAdjustAxes = autoAdjustAxes;
  }

  setProperties(props: IGraphControllerProps) {
    this.graphModel = props.graphModel;
    this.dotsRef = props.dotsRef;
    if (this.graphModel.config.dataset !== this.graphModel.data) {
      console.log('resetting, FIXME');
      this.graphModel.config.setDataset(this.graphModel.data, this.graphModel.metadata);
    }
    this.initializeGraph();
  }

  callMatchCirclesToData() {
    const {graphModel, dotsRef, enableAnimation, instanceId} = this;
    if (graphModel && dotsRef?.current) {
      const { config: dataConfiguration, pointColor, pointStrokeColor } = graphModel,
        pointRadius = graphModel.getPointRadius();
      matchCirclesToData({
        dataConfiguration, dotsElement: dotsRef.current,
        pointRadius, enableAnimation, instanceId, pointColor, pointStrokeColor
      });
    }
  }

  initializeGraph() {
    const {graphModel, dotsRef, layout} = this,
      dataConfig = graphModel?.config;
    console.log('initializeGraph');

    // handle any attributes auto-assigned before our handlers were in place
    if (graphModel?.autoAssignedAttributes.length) {
      graphModel.autoAssignedAttributes.forEach(({ place, role, dataSetID, attrID }) => {
        this.handleAttributeAssignment(place, dataSetID, attrID);
      });
      graphModel.clearAutoAssignedAttributes();
    }
    if (dataConfig && layout && dotsRef?.current) {
      AxisPlaces.forEach((axisPlace: AxisPlace) => {
        const axisModel = graphModel.getAxis(axisPlace),
          attrRole = axisPlaceToAttrRole[axisPlace];
        if (axisModel) {
          layout.setAxisScaleType(axisPlace, axisModel.scale);
          const axisMultiScale = layout.getAxisMultiScale(axisPlace);
          if (isEmptyAxisModel(axisModel)) {  // EmptyAxisModel
            axisMultiScale.setScaleType('ordinal');
          }
          if (isCategoricalAxisModel(axisModel)) {
            axisMultiScale.setCategorySet(dataConfig.categorySetForAttrRole(attrRole));
          }
          if (isNumericAxisModel(axisModel)) {
            axisMultiScale.setNumericDomain(axisModel.domain);
          }
        }
      });
      this.callMatchCirclesToData();
    }
  }

  handleAttributeAssignment(graphPlace: GraphPlace, dataSetID: string, attrID: string) {
    console.log('handleAttributeAssignment: ', graphPlace, attrID);
    const {graphModel, layout} = this,
      dataset = getDataSetFromId(graphModel, dataSetID),
      dataConfig = graphModel?.config,
      appConfig = getAppConfig(graphModel),
      emptyPlotIsNumeric = appConfig?.getSetting("emptyPlotIsNumeric", "graph");
    if (!(graphModel && layout && dataConfig)) {
      console.log("  conditions not met");
      return;
    }
    this.callMatchCirclesToData();
    if (['plot', 'legend'].includes(graphPlace)) {
      // Since there is no axis associated with the legend and the plotType will not change, we bail
      return;
    } else if (graphPlace === 'yPlus') {
      // The yPlus attribute utilizes the left numeric axis for plotting but doesn't change anything else
      const yAxisModel = graphModel.getAxis('left');
      yAxisModel && setNiceDomain(dataConfig.numericValuesForYAxis, yAxisModel);
      return;
    }

    const setPrimaryRoleAndPlotType = () => {
      const axisPlace = graphPlace as AxisPlace,
        graphAttributeRole = axisPlaceToAttrRole[axisPlace];
      if (['left', 'bottom'].includes(axisPlace)) { // Only assignment to 'left' and 'bottom' change plotType
        const defaultAttrType = emptyPlotIsNumeric ? 'numeric' : 'empty';
        const attributeType = dataConfig.attributeType(graphPlaceToAttrRole[graphPlace]) ?? defaultAttrType,
          primaryType = attributeType,
          otherAxisPlace = axisPlace === 'bottom' ? 'left' : 'bottom',
          otherAttrRole = axisPlaceToAttrRole[otherAxisPlace],
          otherAttributeType = dataConfig.attributeType(graphPlaceToAttrRole[otherAxisPlace]) ?? defaultAttrType,
          // Numeric attributes get priority for primaryRole when present. First one that is already present
          // and then the newly assigned one. If there is an already assigned categorical then its place is
          // the primaryRole, or, lastly, the newly assigned place
          primaryRole = otherAttributeType === 'numeric' ? otherAttrRole
            : attributeType === 'numeric' ? graphAttributeRole
              : otherAttributeType !== 'empty' ? otherAttrRole : graphAttributeRole;
        dataConfig.setPrimaryRole(primaryRole);
        graphModel.setPlotType(plotChoices[primaryType][otherAttributeType]);
      }
      if (dataConfig.attributeID(graphAttributeRole) !== attrID) {
        dataConfig.setAttribute(graphAttributeRole, {attributeID: attrID});
      }
    };

    const setupAxis = (place: AxisPlace) => {
      const attrRole = graphPlaceToAttrRole[place],
        attributeID = dataConfig.attributeID(attrRole),
        attr = attributeID ? dataset?.attrFromID(attributeID) : undefined,
        attrType = dataConfig.attributeType(attrRole) ?? 'empty',
        currAxisModel = graphModel.getAxis(place),
        currentType = currAxisModel?.type ?? 'empty',
        [min, max] = kDefaultNumericAxisBounds;
      switch (attrType) {
        case 'numeric': {
          if (!currAxisModel || !isNumericAxisModel(currAxisModel)) {
            const newAxisModel = NumericAxisModel.create({place, min, max});
            graphModel.setAxis(place, newAxisModel);
            dataConfig.setAttributeType(attrRole, 'numeric');
            layout.setAxisScaleType(place, 'linear');
            setNiceDomain(attr?.numValues || [], newAxisModel);
          } else {
            setNiceDomain(attr?.numValues || [], currAxisModel);
          }
        }
          break;
        case 'categorical': {
          if (currentType !== 'categorical') {
            const newAxisModel = CategoricalAxisModel.create({place});
            graphModel.setAxis(place, newAxisModel);
            dataConfig.setAttributeType(attrRole, 'categorical');
            layout.setAxisScaleType(place, 'band');
          }
          layout.getAxisMultiScale(place)?.setCategorySet(dataConfig.categorySetForAttrRole(attrRole));
        }
          break;
        case 'empty': {
          if (currentType !== 'empty') {
            if (!['left', 'bottom'].includes(place)) {
              layout.setAxisScaleType(place, 'ordinal');
              graphModel.removeAxis(place);
            }
            else {
              const newAxisModel = emptyPlotIsNumeric
                                     ? NumericAxisModel.create({place, min, max})
                                     : EmptyAxisModel.create({place});
              graphModel.setAxis(place, newAxisModel);
            }
          }
        }
      }
    };

    setPrimaryRoleAndPlotType();
    AxisPlaces.forEach(setupAxis);
  }
}
