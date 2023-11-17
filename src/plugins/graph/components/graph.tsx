import {observer} from "mobx-react-lite";
import {appConfig} from "../../../initialize-app";
import React, { MutableRefObject, useEffect, useMemo, useRef} from "react";
import {select} from "d3";
import {GraphController} from "../models/graph-controller";
import {DroppableAddAttribute} from "./droppable-add-attribute";
import {Background} from "./background";
import {DroppablePlot} from "./droppable-plot";
import {AxisPlace, AxisPlaces} from "../imports/components/axis/axis-types";
import {GraphAxis} from "./graph-axis";
import {attrRoleToGraphPlace, graphPlaceToAttrRole, IDotsRef, kDefaultNumericAxisBounds, kGraphClass} from "../graph-types";
import {ScatterDots} from "./scatterdots";
import {DotPlotDots} from "./dotplotdots";
import {CaseDots} from "./casedots";
import {ChartDots} from "./chartdots";
import {Marquee} from "./marquee";
import {DataConfigurationContext} from "../hooks/use-data-configuration-context";
import {useDataSetContext} from "../imports/hooks/use-data-set-context";
import {useGraphModel} from "../hooks/use-graph-model";
import {setNiceDomain, startAnimation} from "../utilities/graph-utils";
import {IAxisModel, INumericAxisModel, isNumericAxisModel} from "../imports/components/axis/models/axis-model";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {useGraphLayoutContext} from "../models/graph-layout";
import {
  isAttributeAssignmentAction, isRemoveYAttributeAction, isReplaceYAttributeAction, isSetAttributeIDAction,
  useGraphModelContext
} from "../models/graph-model";
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
}

export const Graph = observer(
    function Graph({ graphController, graphRef, dotsRef, onRequestRowHeight }: IProps) {

  // console.log("📁 graph.tsx ------------------------");

  const graphModel = useGraphModelContext();
  const {autoAdjustAxes, enableAnimation} = graphController;
  const {plotType} = graphModel;
  const instanceId = useInstanceIdContext();
  const marqueeState = useMemo<MarqueeState>(() => new MarqueeState(), []);
  const dataset = useDataSetContext();
  const showEditableGraphValue = !!dataset;
  const layout = useGraphLayoutContext();
  const xScale = layout.getAxisScale("bottom");
  const svgRef = useRef<SVGSVGElement>(null);
  const plotAreaSVGRef = useRef<SVGSVGElement>(null);
  const backgroundSvgRef = useRef<SVGGElement>(null);

  useEffect(function setupPlotArea() {
    if (xScale && xScale?.length > 0) {
      const plotBounds = layout.getComputedBounds('plot');
      // console.log("\t🥩 plotBounds:", plotBounds);
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
   * Only in the case that place === 'y' and there is more than one attribute assigned to the y-axis
   * do we have to do anything special. Otherwise, we can just call handleChangeAttribute.
   */
  const handleRemoveAttribute = (place: GraphPlace, idOfAttributeToRemove: string) => {
    if (place === 'left' && graphModel.config?.yAttributeDescriptions.length > 1) {
      graphModel.removeYAttributeID(idOfAttributeToRemove);
      const yAxisModel = graphModel.getAxis('left') as IAxisModel;
      // console.log("\t🥩 yAxisModel:", yAxisModel);

      setNiceDomain(graphModel.config.numericValuesForYAxis, yAxisModel);
    } else {
      dataset && handleChangeAttribute(place, dataset, '');
    }
  };

  // respond to assignment of new attribute ID
  useEffect(function handleNewAttributeID() {
    const disposer = graphModel && onAnyAction(graphModel, action => {
      if (isAttributeAssignmentAction(action)) {
        let graphPlace: GraphPlace = "yPlus";
        let dataSetId = dataset?.id ?? "";
        let attrId = "";
        if (isSetAttributeIDAction(action)) {
          const [role, _dataSetId, _attrId] = action.args;
          graphPlace = attrRoleToGraphPlace[role] as GraphPlace;
          dataSetId = _dataSetId;
          attrId = _attrId;
        }
        else if (isRemoveYAttributeAction(action)) {
          graphPlace = "yPlus";
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

  //-------------Min Max Value Change -------------------//
  const handleMinMaxChange = (minOrMax: string, axis: AxisPlace, newValue: number) => {
    console.log("📁 graph.tsx ------------------------");
    console.log("\t🥩 newValue:", newValue);
    console.log("\t🥩 axis:", axis);
    console.log("\t🥩 minOrMax:", minOrMax);

    const axisModel = graphModel.getAxis(axis) as INumericAxisModel;
    // console.log("\t🥩 yAxisModel:", yAxisModel);
    console.log("minOrMax:", minOrMax);
    console.log("newValue:", newValue);
    if (minOrMax === "min" && newValue < axisModel.max){
      axisModel.setMin(newValue);
    } else if (minOrMax === "max" && newValue > axisModel.min){
      axisModel.setMax(newValue);
    }
  };


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
            <svg ref={dotsRef} className={`graph-dot-area ${instanceId}`}>
              {renderPlotComponent()}
            </svg>
            <Marquee marqueeState={marqueeState}/>
          </svg>

          <DroppablePlot
            graphElt={graphRef.current}
            plotElt={backgroundSvgRef.current}
            onDropAttribute={handleChangeAttribute}
          />

          <Legend
            legendAttrID={graphModel.getAttributeID('legend')}
            graphElt={graphRef.current}
            onDropAttribute={handleChangeAttribute}
            onRemoveAttribute={handleRemoveAttribute}
            onTreatAttributeAs={handleTreatAttrAs}
          />
        </svg>
        {renderDroppableAddAttributes()}
        <Adornments dotsRef={dotsRef}/>=
        { appConfig.getSetting("defaultSeriesLegend", "graph") &&
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
            // console.log("\t🥩 axis-----------", axis);
            const axisModel = graphModel?.getAxis(axis);
            const minVal = isNumericAxisModel(axisModel) ? axisModel.min : kDefaultNumericAxisBounds[0];
            const maxVal = isNumericAxisModel(axisModel) ? axisModel.max : kDefaultNumericAxisBounds[1];
            //TODO - hide first and last tick
            return (
              <div key={`${axis}-min-max`}>
                <EditableGraphValue
                  value={minVal}
                  minOrMax={"min"}
                  axis={axis}
                  onValueChange={(newValue) => handleMinMaxChange("min", axis, newValue)}
                />
                <EditableGraphValue
                  value={maxVal}
                  minOrMax={"max"}
                  axis={axis}
                  onValueChange={(newValue) => handleMinMaxChange("max", axis, newValue)}
                />
              </div>
            );
          })
        }
      </div>
    </DataConfigurationContext.Provider>
  );
});
