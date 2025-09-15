import React, { createContext } from "react";
import {IGraphModel} from "./graph-model";
import {GraphLayout} from "./graph-layout";
import {AxisPlace, AxisPlaces} from "../imports/components/axis/axis-types";
import {
  CategoricalAxisModel, EmptyAxisModel, isCategoricalAxisModel, isEmptyAxisModel, isNumericAxisModel, NumericAxisModel
} from "../imports/components/axis/models/axis-model";
import {
  axisPlaceToAttrRole, graphPlaceToAttrRole, kDefaultNumericAxisBounds, PlotType
} from "../graph-types";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {matchCirclesToData, setNiceDomain, startAnimation} from "../utilities/graph-utils";
import { getAppConfig } from "../../../models/tiles/tile-environment";
import { IDataConfigurationModel } from "./data-configuration-model";

/**
 * This determines the type of plot that will be drawn, based on the types of the two axes.
 * The keys are [primaryAxisType][secondaryAxisType]
 */
const plotChoices: Record<string, Record<string, PlotType>> = {
  empty: {empty: 'casePlot', numeric: 'dotPlot', categorical: 'dotChart'},
  numeric: {empty: 'dotPlot', numeric: 'scatterPlot', categorical: 'dotPlot'},
  categorical: {empty: 'dotChart', numeric: 'dotPlot', categorical: 'dotChart'}
};

interface IGraphControllerConstructorProps {
  layout: GraphLayout
  enableAnimation: React.MutableRefObject<boolean>
  instanceId: string
}

interface IGraphControllerProps {
  graphModel: IGraphModel
}

export class GraphController {
  graphModel?: IGraphModel;
  layout: GraphLayout;
  enableAnimation: React.MutableRefObject<boolean>;
  instanceId: string;

  constructor({layout, enableAnimation, instanceId}: IGraphControllerConstructorProps) {
    this.layout = layout;
    this.instanceId = instanceId;
    this.enableAnimation = enableAnimation;
  }

  setProperties(props: IGraphControllerProps) {
    this.graphModel = props.graphModel;
    this.initializeGraph();
  }

  callMatchCirclesToData() {
    const {graphModel, enableAnimation, instanceId} = this;
    if (graphModel) {
      const { pointColor, pointStrokeColor } = graphModel,
        pointRadius = graphModel.getPointRadius();
      for (const layer of graphModel.layers) {
        const dataConfiguration = layer.config;
        if (dataConfiguration && layer.dotsElt) {
          matchCirclesToData({
            dataConfiguration, dotsElement: layer.dotsElt,
            pointRadius, enableAnimation, instanceId, pointColor, pointStrokeColor
          });
      }
      }
    }
  }

  initializeGraph() {
    const {graphModel, layout} = this;

    // handle any attributes auto-assigned before our handlers were in place
    if (graphModel?.autoAssignedAttributes.length) {
      graphModel.autoAssignedAttributes.forEach(({ layer, place, role, dataSetID, attrID }) => {
        this.handleAttributeAssignment(layer.config, place, attrID);
      });
      graphModel.clearAutoAssignedAttributes();
    }
    if (graphModel && layout) {
      AxisPlaces.forEach((axisPlace: AxisPlace) => {
        const axisModel = graphModel.getAxis(axisPlace),
          attrRole = axisPlaceToAttrRole[axisPlace];
        if (axisModel) {
          console.log(`=== initializeGraph`, axisPlace, axisModel.type);
          layout.setAxisScaleType(axisPlace, axisModel.scale);
          const axisMultiScale = layout.getAxisMultiScale(axisPlace);
          if (isEmptyAxisModel(axisModel)) {  // EmptyAxisModel
            axisMultiScale.setScaleType('ordinal');
          }
          if (isCategoricalAxisModel(axisModel)) {
            // FIXME handle multiple layers
            axisMultiScale.setCategorySet(graphModel.layers[0].config.categorySetForAttrRole(attrRole));
          }
          if (isNumericAxisModel(axisModel)) {
            axisMultiScale.setNumericDomain(axisModel.domain);
          }
        }
      });
      this.callMatchCirclesToData();
    }
  }

  handleAttributeAssignment(dataConfiguration: IDataConfigurationModel, graphPlace: GraphPlace, attrID: string) {
    const {graphModel, layout} = this,
      appConfig = getAppConfig(graphModel),
      emptyPlotIsNumeric = appConfig?.getSetting("emptyPlotIsNumeric", "graph"),
      isPrimaryLayer = graphModel?.layers[0].config === dataConfiguration;
    if (!(graphModel && layout)) {
      return;
    }
    if (['plot', 'legend'].includes(graphPlace)) {
      // Since there is no axis associated with the legend and the plotType will not change, we bail
      return;
    } else if (!isPrimaryLayer || graphPlace === 'yPlus') {
      // The first trace of the primary (0th) layer controls the plot type.
      // Other data traces just rescale without altering anything else.
      if (!graphModel.lockAxes) {
        this.autoscaleAllAxes();
      }
      this.callMatchCirclesToData();
      return;
    }

    const setPrimaryRoleAndPlotType = () => {
      const axisPlace = graphPlace as AxisPlace,
        graphAttributeRole = axisPlaceToAttrRole[axisPlace];
      if (['left', 'bottom'].includes(axisPlace)) { // Only assignment to 'left' and 'bottom' change plotType
        const defaultAttrType = emptyPlotIsNumeric ? 'numeric' : 'empty';
        const attributeType = graphModel.attributeType(graphPlaceToAttrRole[graphPlace]) ?? defaultAttrType,
          primaryType = attributeType,
          otherAxisPlace = axisPlace === 'bottom' ? 'left' : 'bottom',
          otherAttrRole = axisPlaceToAttrRole[otherAxisPlace],
          otherAttributeType = graphModel.attributeType(graphPlaceToAttrRole[otherAxisPlace]) ?? defaultAttrType,
          // Numeric attributes get priority for primaryRole when present. First one that is already present
          // and then the newly assigned one. If there is an already assigned categorical then its place is
          // the primaryRole, or, lastly, the newly assigned place
          primaryRole = otherAttributeType === 'numeric' ? otherAttrRole
            : attributeType === 'numeric' ? graphAttributeRole
              : otherAttributeType !== 'empty' ? otherAttrRole : graphAttributeRole;
        // Only call setters if something has changed, to avoid triggering unwanted reactions
        if (primaryRole !== graphModel.primaryRole) {
          graphModel.setPrimaryRole(primaryRole);
        }
        const plotType = plotChoices[primaryType][otherAttributeType];
        if (plotType !== graphModel.plotType) {
          graphModel.setPlotType(plotType);
        }
      }
    };

    const setupAxis = (place: AxisPlace) => {
      const attrRole = graphPlaceToAttrRole[place],
        attrType = dataConfiguration.attributeType(attrRole) ?? 'empty',
        currAxisModel = graphModel.getAxis(place),
        currentType = currAxisModel?.type ?? 'empty',
        currentLayer = graphModel.layerForDataConfigurationId(dataConfiguration.id),
        shouldNotResetBounds = (currentLayer?.editable || graphModel.lockAxes) &&
                               isNumericAxisModel(currAxisModel),
        [min, max] = shouldNotResetBounds ? [currAxisModel.min, currAxisModel.max] : kDefaultNumericAxisBounds;
      switch (attrType) {
        case 'numeric': {
          if (!currAxisModel || !isNumericAxisModel(currAxisModel)) {
            const newAxisModel = NumericAxisModel.create({place, min, max});
            graphModel.setAxis(place, newAxisModel);
            dataConfiguration.setAttributeType(attrRole, 'numeric');
            console.log(`=== setupAxis`, place);
            layout.setAxisScaleType(place, 'linear');
          }
          if (!graphModel.lockAxes && !currentLayer?.editable) {
            setNiceDomain(graphModel.numericValuesForAttrRole(attrRole), graphModel.getAxis(place)!, false);
          }
        }
          break;
        case 'categorical': {
          if (currentType !== 'categorical') {
            const newAxisModel = CategoricalAxisModel.create({place});
            graphModel.setAxis(place, newAxisModel);
            dataConfiguration.setAttributeType(attrRole, 'categorical');
            layout.setAxisScaleType(place, 'band');
          }
          layout.getAxisMultiScale(place)?.setCategorySet(dataConfiguration.categorySetForAttrRole(attrRole));
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
              !emptyPlotIsNumeric && layout.setAxisScaleType(place, 'ordinal');
            }
          }
        }
      }
    };

    setPrimaryRoleAndPlotType();
    AxisPlaces.forEach(setupAxis);
    this.callMatchCirclesToData();
  }

  /**
   * Set the domains of all axes to fit all of the data points.
   */
  autoscaleAllAxes(growOnly: boolean = false) {
    if (!this.graphModel) return;
    startAnimation(this.enableAnimation);
    for (const place of AxisPlaces) {
      const role = graphPlaceToAttrRole[place];
      const axisModel = this.graphModel.getAxis(place);
      if (isNumericAxisModel(axisModel)) {
        setNiceDomain(this.graphModel.numericValuesForAttrRole(role), axisModel, growOnly);
      }
    }
  }
}

export const GraphControllerContext = createContext<GraphController|undefined>(undefined);
