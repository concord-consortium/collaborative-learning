import {observer} from "mobx-react-lite";
import React, { MutableRefObject, useEffect, useMemo, useRef} from "react";
import {select} from "d3";
import {GraphController} from "../models/graph-controller";
import {DroppableAddAttribute} from "./droppable-add-attribute";
import {Background} from "./background";
import {DroppablePlot} from "./droppable-plot";
import {AxisPlace, AxisPlaces} from "../imports/components/axis/axis-types";
import {GraphAxis} from "./graph-axis";
import {attrRoleToGraphPlace, graphPlaceToAttrRole,
        IDotsRef, kDefaultNumericAxisBounds, kGraphClass} from "../graph-types";
import {ScatterDots} from "./scatterdots";
import {DotPlotDots} from "./dotplotdots";
import {CaseDots} from "./casedots";
import {ChartDots} from "./chartdots";
import {Marquee} from "./marquee";
import {DataConfigurationContext} from "../hooks/use-data-configuration-context";
import {DataSetContext, useDataSetContext} from "../imports/hooks/use-data-set-context";
import {useGraphModel} from "../hooks/use-graph-model";
import {useGraphSettingsContext} from "../hooks/use-graph-settings-context";
import {setNiceDomain, startAnimation} from "../utilities/graph-utils";
import {IAxisModel, INumericAxisModel, isNumericAxisModel} from "../imports/components/axis/models/axis-model";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {useGraphLayoutContext} from "../models/graph-layout";
import { isAttributeAssignmentAction, isRemoveAttributeFromRoleAction, isRemoveYAttributeWithIDAction,
  isReplaceYAttributeAction, isSetAttributeForRoleAction }
  from "../models/data-configuration-model";
import { useGraphModelContext } from "../models/graph-model";
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

import "./graph.scss";
import "./graph-clue-styles.scss";

interface IProps {
  graphController: GraphController;
  graphRef: MutableRefObject<HTMLDivElement | null>;
  dotsRef: IDotsRef;
  onRequestRowHeight?: (id: string, size: number) => void;
  readOnly?: boolean
}

export const Graph = observer(
    function Graph({ graphController, readOnly, graphRef, dotsRef, onRequestRowHeight }: IProps) {

  const graphModel = useGraphModelContext(),
    {autoAdjustAxes, enableAnimation} = graphController,
    {plotType} = graphModel,
    instanceId = useInstanceIdContext(),
    marqueeState = useMemo<MarqueeState>(() => new MarqueeState(), []),
    dataset = useDataSetContext(),
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
  }, [dataset, plotAreaSVGRef, layout, layout.plotHeight, layout.plotWidth, xScale]);

  const handleChangeAttribute = (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => {
    const computedPlace = place === 'plot' && graphModel.config.noAttributesAssigned ? 'bottom' : place;
    const attrRole = graphPlaceToAttrRole[computedPlace];
    if (attrRole === 'y' && oldAttrId) {
      graphModel.replaceYAttributeID(oldAttrId, attrId);
      const yAxisModel = graphModel.getAxis('left') as IAxisModel;
      setNiceDomain(graphModel.config.numericValuesForYAxis, yAxisModel);
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
      setNiceDomain(graphModel.config.numericValuesForYAxis, yAxisModel); // FIXME needs update for multiple datasets
    } else {
      dataset && handleChangeAttribute(place, dataset, '');
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
        if (layerNumber > 0) { // TODO temporary
          console.log('Ignoring change in layer ', layerNumber, action.name);
          return;
        }
        const layer = graphModel.layers[layerNumber];
        const dataSetId = layer.config.dataset?.id;
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
        graphPlace && graphController?.handleAttributeAssignment(graphPlace, dataSetId, attrId);
      }
    });
    return () => disposer?.();
  }, [graphController, dataset, layout, enableAnimation, graphModel]);

  const handleTreatAttrAs = (place: GraphPlace, attrId: string, treatAs: AttributeType) => {
    graphModel.config.setAttributeType(graphPlaceToAttrRole[place], treatAs);
    dataset && graphController?.handleAttributeAssignment(place, dataset.id, attrId);

    const connectingLines = graphModel.adornments.find(a => a.type === kConnectingLinesType);
    if (connectingLines && place === "left") {
      treatAs === 'categorical' && graphModel.hideAdornment(kConnectingLinesType);
      treatAs === 'numeric' && graphModel.showAdornment(connectingLines);
    }

    // TODO: use isVisible state, set above, instead of this hack
    if (!connectingLines?.isVisible){
      const dotArea = select(dotsRef.current);
      const anyFoundPath = dotArea.selectAll("path");
      if (anyFoundPath) anyFoundPath.remove();
    }
  };

  // useDataTips({dotsRef, dataset, graphModel, enableAnimation});
  //useDataTips hook is used to identify individual points in a dense scatterplot
  //it should be commented out for now as it shrinks outer circle when hovered over, but may prove useful in the future

  const renderPlotComponent = () => {
    const props = {
        dotsRef, enableAnimation
      },
      typeToPlotComponentMap = {
        casePlot: <CaseDots {...props}/>,
        dotChart: <ChartDots {...props}/>,
        dotPlot: <DotPlotDots {...props}/>,
        scatterPlot: <ScatterDots {...props}/>
      };
    return typeToPlotComponentMap[plotType];
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

  useGraphModel({dotsRef, graphModel, enableAnimation, instanceId});
  // TODO multi-dataset: DataContext / providers will need to be replaced by looping over layers.

  const handleMinMaxChange = (minOrMax: string, axis: AxisPlace, newValue: number) => {
    const axisModel = graphModel.getAxis(axis) as INumericAxisModel;
    if (minOrMax === "min" && newValue < axisModel.max){
      axisModel.setMin(newValue);
    } else if (minOrMax === "max" && newValue > axisModel.min){
      axisModel.setMax(newValue);
    }
  };

  return (
    <DataConfigurationContext.Provider value={graphModel.config}>
      <DataSetContext.Provider value={graphModel.config.dataset}>
        <div className={kGraphClass} ref={graphRef} data-testid="graph">
          <svg className='graph-svg' ref={svgRef}>
            <Background
              marqueeState={marqueeState}
              ref={backgroundSvgRef}
            />

            {renderGraphAxes()}

            <svg ref={plotAreaSVGRef}>
              <svg ref={dotsRef} className={`graph-dot-area ${instanceId}`}>
                {renderPlotComponent()}
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
          <Adornments dotsRef={dotsRef}/>
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

            })
          }
        </div>
      </DataSetContext.Provider>
    </DataConfigurationContext.Provider>
  );
});
