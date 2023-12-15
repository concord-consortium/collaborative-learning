import {observer} from "mobx-react-lite";
import React, { MutableRefObject, useEffect, useMemo, useRef} from "react";
import {select} from "d3";
import {GraphController} from "../models/graph-controller";
import {DroppableAddAttribute} from "./droppable-add-attribute";
import {Background} from "./background";
import {DroppablePlot} from "./droppable-plot";
import {AxisPlace, AxisPlaces} from "../imports/components/axis/axis-types";
import {GraphAxis} from "./graph-axis";
import {attrRoleToGraphPlace, graphPlaceToAttrRole, kDefaultNumericAxisBounds, kGraphClass} from "../graph-types";
import {Marquee} from "./marquee";
import {DataConfigurationContext} from "../hooks/use-data-configuration-context";
import {useGraphModel} from "../hooks/use-graph-model";
import {useGraphSettingsContext} from "../hooks/use-graph-settings-context";
import {setNiceDomain, startAnimation} from "../utilities/graph-utils";
import {IAxisModel, INumericAxisModel, isNumericAxisModel} from "../imports/components/axis/models/axis-model";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {useGraphLayoutContext} from "../models/graph-layout";
import { isAttributeAssignmentAction, isRemoveAttributeFromRoleAction, isRemoveYAttributeWithIDAction,
  isReplaceYAttributeAction, isSetAttributeForRoleAction }
  from "../models/data-configuration-model";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import {useInstanceIdContext} from "../imports/hooks/use-instance-id-context";
import {MarqueeState} from "../models/marquee-state";
import {Legend} from "./legend/legend";
import {MultiLegend} from "./legend/multi-legend";
import {AttributeType} from "../../../models/data/attribute";
import {IDataSet} from "../../../models/data/data-set";
// import {useDataTips} from "../hooks/use-data-tips";
import {onAnyAction} from "../../../utilities/mst-utils";
import { Adornments } from "../adornments/adornments";
import { kConnectingLinesType } from "../adornments/connecting-lines/connecting-lines-types";
import { EditableGraphValue } from "./editable-graph-value";
import { GraphLayer } from "./graph-layer";

import "./graph.scss";
import "./graph-clue-styles.scss";

interface IProps {
  graphController: GraphController;
  graphRef: MutableRefObject<HTMLDivElement | null>;
  onRequestRowHeight?: (id: string, size: number) => void;
  readOnly?: boolean
}

export const Graph = observer(
    function Graph({ graphController, readOnly, graphRef, onRequestRowHeight }: IProps) {

  const graphModel = useGraphModelContext(),
    {autoAdjustAxes, enableAnimation} = graphController,
    {plotType} = graphModel,
    instanceId = useInstanceIdContext(),
    marqueeState = useMemo<MarqueeState>(() => new MarqueeState(), []),
    layout = useGraphLayoutContext(),
    {defaultSeriesLegend, disableAttributeDnD} = useGraphSettingsContext(),
    xScale = layout.getAxisScale("bottom"),
    svgRef = useRef<SVGSVGElement>(null),
    plotAreaSVGRef = useRef<SVGSVGElement>(null),
    backgroundSvgRef = useRef<SVGGElement>(null);
  const showEditableGraphValue = graphModel.isLinkedToDataSet;

  useEffect(function setupPlotArea() {
    if (xScale && xScale?.length > 0) {
      const plotBounds = layout.getComputedBounds('plot');
      select(plotAreaSVGRef.current)
        .attr('x', plotBounds?.left || 0)
        .attr('y', plotBounds?.top || 0)
        .attr('width', layout.plotWidth > 0 ? layout.plotWidth : 0)
        .attr('height', layout.plotHeight > 0 ? layout.plotHeight : 0);
    }
  }, [plotAreaSVGRef, layout, layout.plotHeight, layout.plotWidth, xScale]);

  const handleChangeAttribute = (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => {
    const computedPlace = place === 'plot' && graphModel.noAttributesAssigned ? 'bottom' : place;
    const attrRole = graphPlaceToAttrRole[computedPlace];
    if (attrRole === 'y' && oldAttrId) {
      graphModel.replaceYAttributeID(oldAttrId, attrId);
      const yAxisModel = graphModel.getAxis('left') as IAxisModel;
      setNiceDomain(graphModel.numericValuesForYAxis, yAxisModel);
    } else {
      graphModel.setAttributeID(attrRole, dataSet.id, attrId);
    }
  };

  /**
   * Remove a given Attribute from the graph.
   * This is called by 'Remove...' menu options.
   */
  const handleRemoveAttribute = (place: GraphPlace, idOfAttributeToRemove: string) => {
    if (place === 'left') {
      graphModel.removeYAttributeID(idOfAttributeToRemove);
      const yAxisModel = graphModel.getAxis('left') as IAxisModel;
      setNiceDomain(graphModel.numericValuesForYAxis, yAxisModel);
    } else {
      const role = graphPlaceToAttrRole[place];
      if (role === 'y') {
        graphModel.removeYAttributeID(idOfAttributeToRemove);
      } else {
        graphModel.removeAttribute(role, idOfAttributeToRemove);
      }
    }
  };

  // respond to assignment of new attribute ID
  useEffect(function handleNewAttributeID() {
    const disposer = graphModel && onAnyAction(graphModel, action => {
      if (isAttributeAssignmentAction(action)) {
        let graphPlace: GraphPlace = "yPlus";
        // This should trigger only on changes in one of the attached DataConfiguration objects.
        // We can determine which one from the path.
        if (!action.path) return;
        const match = action.path.match(/^\/layers\/([0-9]+)\/config$/);
        if (!match) {
          console.warn('Unexpected action.path: ', action.path);
          return;
        }
        const layerNumber = Number(match[1]);
        if (!isFinite(layerNumber) || layerNumber >= graphModel.layers.length) {
          console.warn('Unexpected layer number: ', action.path);
          return;
        }
        const layer = graphModel.layers[layerNumber];
        let attrId = "";
        if (isSetAttributeForRoleAction(action)) {
          const [role, _desc] = action.args;
          graphPlace = attrRoleToGraphPlace[role] as GraphPlace;
          attrId = _desc?.attributeID || "";
        }
        else if (isRemoveAttributeFromRoleAction(action)) {
          const [role] = action.args;
          graphPlace = attrRoleToGraphPlace[role] as GraphPlace;
        }
        else if (isRemoveYAttributeWithIDAction(action)) {
          const [_attrId] = action.args; // "old" attr ID, do not pass to handleAttributeAssignment
          const removingLastOne = layer.config.yAttributeDescriptions.length === 0;
          graphPlace = removingLastOne ? "left" : "yPlus";
        }
        else if (isReplaceYAttributeAction(action)) {
          const [ , newAttrId] = action.args;
          graphPlace = "yPlus";
          attrId = newAttrId;
        }
        startAnimation(enableAnimation);
        graphPlace && graphController?.handleAttributeAssignment(layer.config, graphPlace, attrId);
      }
    });
    return () => disposer?.();
  }, [graphController, layout, enableAnimation, graphModel]);

  const handleTreatAttrAs = (place: GraphPlace, attrId: string, treatAs: AttributeType) => {
    const layer = graphModel.layerForAttributeId(attrId);
    if (!layer) return;
    layer.config.setAttributeType(graphPlaceToAttrRole[place], treatAs);
    layer.config.dataset && graphController?.handleAttributeAssignment(layer.config, place, attrId);

    const connectingLines = graphModel.adornments.find(a => a.type === kConnectingLinesType);
    if (connectingLines && place === "left") {
      treatAs === 'categorical' && graphModel.hideAdornment(kConnectingLinesType);
      treatAs === 'numeric' && graphModel.showAdornment(connectingLines);
    }
  };

  // useDataTips({dotsRef, graphModel, enableAnimation});
  //useDataTips hook is used to identify individual points in a dense scatterplot
  //it should be commented out for now as it shrinks outer circle when hovered over, but may prove useful in the future

  const renderPlotComponents = () => {
    const layers = graphModel.layers.map((layer) => {
      return (<GraphLayer key={layer.id} graphModel={graphModel} layer={layer} enableAnimation={enableAnimation}/>);
    });
    return layers;
  };

//******************** Render Graph Axes **********************
  const axes = AxisPlaces.filter((place: AxisPlace) => {
    return !!graphModel.getAxis(place);
  });

  const renderGraphAxes = () => {
    return axes.map((place: AxisPlace) => {
      return <GraphAxis key={place}
                        place={place}
                        enableAnimation={enableAnimation}
                        autoAdjust={autoAdjustAxes}
                        onDropAttribute={handleChangeAttribute}
                        onRemoveAttribute={handleRemoveAttribute}
                        onTreatAttributeAs={handleTreatAttrAs}
      />;
    });
  };

  const renderDroppableAddAttributes = () => {
    const droppables: JSX.Element[] = [];
    if (plotType !== 'casePlot') {
      const plotPlaces: GraphPlace[] = plotType === 'scatterPlot' ? ['yPlus', 'rightNumeric'] : [];
      const places: GraphPlace[] = ['top', 'rightCat', ...plotPlaces];
      places.forEach((place: GraphPlace) => {
        // Since an axis is already a droppable, we only need to render a droppable if there is no axis
        if (!graphModel.getAxis(place as AxisPlace)) {
          droppables.push(
            <DroppableAddAttribute
              key={place}
              place={place}
              plotType={plotType}
              onDrop={handleChangeAttribute.bind(null, place)}
            />
          );
        }
      });
    }
    return droppables;
  };

  useGraphModel({ graphModel, enableAnimation, instanceId });

  const handleMinMaxChange = (minOrMax: string, axis: AxisPlace, newValue: number) => {
    const axisModel = graphModel.getAxis(axis) as INumericAxisModel;
    if (minOrMax === "min" && newValue < axisModel.max){
      axisModel.setMin(newValue);
    } else if (minOrMax === "max" && newValue > axisModel.min){
      axisModel.setMax(newValue);
    }
  };

  // TODO multi-dataset: DataConfigurationContext should not be provided here, but is still used in some places.
  return (
    <DataConfigurationContext.Provider value={graphModel.config}>
        <div className={kGraphClass} ref={graphRef} data-testid="graph">
          <svg className='graph-svg' ref={svgRef}>
            <Background
              marqueeState={marqueeState}
              ref={backgroundSvgRef}
            />

            {renderGraphAxes()}

            <svg ref={plotAreaSVGRef}>
              <svg className={`graph-dot-area ${instanceId}`}>
                {renderPlotComponents()}
              </svg>
              <Marquee marqueeState={marqueeState}/>
            </svg>

            { !disableAttributeDnD &&
              <DroppablePlot
                graphElt={graphRef.current}
                plotElt={backgroundSvgRef.current}
                onDropAttribute={handleChangeAttribute}
              />
            }

            <Legend
              legendAttrID={graphModel.getAttributeID('legend')}
              graphElt={graphRef.current}
              onDropAttribute={handleChangeAttribute}
              onRemoveAttribute={handleRemoveAttribute}
              onTreatAttributeAs={handleTreatAttrAs}
            />
          </svg>
          {!disableAttributeDnD && renderDroppableAddAttributes()}
          <Adornments/>
          {defaultSeriesLegend &&
            <MultiLegend
              graphElt={graphRef.current}
              onChangeAttribute={handleChangeAttribute}
              onRemoveAttribute={handleRemoveAttribute}
              onTreatAttributeAs={handleTreatAttrAs}
              onRequestRowHeight={onRequestRowHeight}
            />
          }
          {
            showEditableGraphValue &&
            axes.map((axis: AxisPlace, idx) => {
              const axisModel = graphModel?.getAxis(axis);
              const minVal = isNumericAxisModel(axisModel) ? axisModel.min : kDefaultNumericAxisBounds[0];
              const maxVal = isNumericAxisModel(axisModel) ? axisModel.max : kDefaultNumericAxisBounds[1];
              if (isNumericAxisModel(axisModel)){
                return (
                  <div key={`${axis}-min-max`}>
                    <EditableGraphValue
                      value={minVal}
                      minOrMax={"min"}
                      axis={axis}
                      onValueChange={(newValue) => handleMinMaxChange("min", axis, newValue)}
                      readOnly={readOnly}
                    />
                    <EditableGraphValue
                      value={maxVal}
                      minOrMax={"max"}
                      axis={axis}
                      onValueChange={(newValue) => handleMinMaxChange("max", axis, newValue)}
                      readOnly={readOnly}
                    />
                  </div>
                );
              }
            })
          }
        </div>
    </DataConfigurationContext.Provider>
  );
});
