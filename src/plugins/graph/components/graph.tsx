import {observer} from "mobx-react-lite";
import {appConfig} from "../../../initialize-app";
import React, {MutableRefObject, useCallback, useEffect, useMemo, useRef} from "react";
import {select} from "d3";
import { ITileApi } from "../../../components/tiles/tile-api";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileModel } from "../../../models/tiles/tile-model";
import { getScreenX, getScreenY } from "../hooks/use-point-locations";
import {GraphController} from "../models/graph-controller";
import {DroppableAddAttribute} from "./droppable-add-attribute";
import {Background} from "./background";
import {DroppablePlot} from "./droppable-plot";
import {AxisPlace, AxisPlaces} from "../imports/components/axis/axis-types";
import {GraphAxis} from "./graph-axis";
import {attrRoleToGraphPlace, graphPlaceToAttrRole, IDotsRef, kGraphClass} from "../graph-types";
import {ScatterDots} from "./scatterdots";
import {DotPlotDots} from "./dotplotdots";
import {CaseDots} from "./casedots";
import {ChartDots} from "./chartdots";
import {Marquee} from "./marquee";
import {DataConfigurationContext} from "../hooks/use-data-configuration-context";
import {useDataSetContext} from "../imports/hooks/use-data-set-context";
import {useGraphModel} from "../hooks/use-graph-model";
import {decipherDotId, setNiceDomain, startAnimation} from "../utilities/graph-utils";
import {IAxisModel} from "../imports/components/axis/models/axis-model";
import {GraphPlace} from "../imports/components/axis-graph-shared";
import {useGraphLayoutContext} from "../models/graph-layout";
import {isSetAttributeIDAction, useGraphModelContext} from "../models/graph-model";
import {useInstanceIdContext} from "../imports/hooks/use-instance-id-context";
import {MarqueeState} from "../models/marquee-state";
import {Legend} from "./legend/legend";
import {MultiLegend} from "./legend/multi-legend";
import {AttributeType} from "../../../models/data/attribute";
import {IDataSet} from "../../../models/data/data-set";
import {useDataTips} from "../hooks/use-data-tips";
import {onAnyAction} from "../../../utilities/mst-utils";
import { Adornments } from "../adornments/adornments";

import "./graph.scss";
import "./graph-clue-styles.scss";

interface IProps {
  graphController: GraphController
  graphRef: MutableRefObject<HTMLDivElement | null>
  dotsRef: IDotsRef
  onRegisterTileApi?: (tileApi: ITileApi, facet?: string | undefined) => void
  tileModel?: ITileModel
}

export const Graph = observer(function Graph({
  graphController, graphRef, dotsRef, onRegisterTileApi, tileModel
}: IProps) {
  const graphModel = useGraphModelContext(),
    {autoAdjustAxes, enableAnimation} = graphController,
    {plotType} = graphModel,
    instanceId = useInstanceIdContext(),
    marqueeState = useMemo<MarqueeState>(() => new MarqueeState(), []),
    dataset = useDataSetContext(),
    layout = useGraphLayoutContext(),
    xScale = layout.getAxisScale("bottom"),
    svgRef = useRef<SVGSVGElement>(null),
    plotAreaSVGRef = useRef<SVGSVGElement>(null),
    backgroundSvgRef = useRef<SVGGElement>(null),
    xAttrID = graphModel.getAttributeID('x'),
    yAttrID = graphModel.getAttributeID('y');

  const getTitle  = useCallback(() => {
    return tileModel?.title || "";
  }, [tileModel]);

  const getDotCenter = useCallback((dotId: string) => {
    const idParts = decipherDotId(dotId);
    if (!idParts) return;
    const { caseId, xAttributeId, yAttributeId } = idParts;
    if (xAttributeId !== xAttrID || yAttributeId !== yAttrID) return;
    const dataConfig = graphModel.config;
    const x = getScreenX({ caseId, dataset, layout, dataConfig });
    const y = getScreenY({ caseId, dataset, layout, dataConfig });
    return { x, y };
  }, [dataset, graphModel.config, layout, xAttrID, yAttrID]);

  useEffect(() => {
    onRegisterTileApi?.({
      exportContentAsTileJson: (options?: ITileExportOptions) => {
        return graphModel.exportJson(options);
      },
      getTitle: () => {
        return getTitle();
      },
      getObjectBoundingBox: (objectId: string, objectType?: string) => {
        if (objectType === "dot") {
          const coords = getDotCenter(objectId);
          if (!coords) return;
          const { x, y } = coords;
          const halfSide = graphModel.getPointRadius("hover-drag");
          const boundingBox = {
            height: 2 * halfSide,
            left: x - halfSide + layout.getComputedBounds("left").width,
            top: y - halfSide,
            width: 2 * halfSide
          };
          return boundingBox;
        }
      },
      getObjectButtonSVG: ({ classes, handleClick, objectId, objectType, translateTilePointToScreenPoint }) => {
        if (objectType === "dot") {
          // Find the center point
          const coords = getDotCenter(objectId);
          if (!coords) return;
          const dotCenter = translateTilePointToScreenPoint?.([coords.x, coords.y]);
          if (!dotCenter) return;
          const [ x, y ] = dotCenter;
          const cx = x + layout.getComputedBounds("left").width;
          const radius = graphModel.getPointRadius("hover-drag");

          // Return a circle at the center point
          return (
            <circle
              className={classes}
              cx={cx}
              cy={y}
              fill="transparent"
              onClick={handleClick}
              r={radius}
            />
          );
        }
      }
    });
  }, [getDotCenter, getTitle, graphModel, layout, onRegisterTileApi]);

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

  const handleChangeAttribute = (place: GraphPlace, dataSet: IDataSet, attrId: string) => {
    const computedPlace = place === 'plot' && graphModel.config.noAttributesAssigned ? 'bottom' : place;
    const attrRole = graphPlaceToAttrRole[computedPlace];
    graphModel.setAttributeID(attrRole, dataSet.id, attrId);
  };

  /**
   * Only in the case that place === 'y' and there is more than one attribute assigned to the y-axis
   * do we have to do anything special. Otherwise, we can just call handleChangeAttribute.
   */
  const handleRemoveAttribute = (place: GraphPlace, idOfAttributeToRemove: string) => {
    if (place === 'left' && graphModel.config?.yAttributeDescriptions.length > 1) {
      graphModel.config?.removeYAttributeWithID(idOfAttributeToRemove);
      const yAxisModel = graphModel.getAxis('left') as IAxisModel;
      setNiceDomain(graphModel.config.numericValuesForAttrRole('y'), yAxisModel);
    } else {
      dataset && handleChangeAttribute(place, dataset, '');
    }
  };

  // respond to assignment of new attribute ID
  useEffect(function handleNewAttributeID() {
    const disposer = graphModel && onAnyAction(graphModel, action => {
      if (isSetAttributeIDAction(action)) {
        const [role, dataSetId, attrID] = action.args,
          graphPlace = attrRoleToGraphPlace[role];
        startAnimation(enableAnimation);
        graphPlace && graphController?.handleAttributeAssignment(graphPlace, dataSetId, attrID);
      }
    });
    return () => disposer?.();
  }, [graphController, dataset, layout, enableAnimation, graphModel]);

  const handleTreatAttrAs = (place: GraphPlace, attrId: string, treatAs: AttributeType) => {
    graphModel.config.setAttributeType(graphPlaceToAttrRole[place], treatAs);
    dataset && graphController?.handleAttributeAssignment(place, dataset.id, attrId);

    const connectingLines = graphModel.adornments.find(a => a.type === "Connecting Lines");
    if (connectingLines && place === "left") {
      treatAs === 'categorical' && graphModel.hideAdornment("Connecting Lines");
      treatAs === 'numeric' && graphModel.showAdornment(connectingLines, "Connecting Lines");
    }

    // TODO: use isVisible state, set above, instead of this hack
    if (!connectingLines?.isVisible){
      const dotArea = select(dotsRef.current);
      const anyFoundPath = dotArea.selectAll("path");
      if (anyFoundPath) anyFoundPath.remove();
    }
  };

  useDataTips({dotsRef, dataset, graphModel, enableAnimation});

  const renderPlotComponent = () => {
    const props = {
        xAttrID, yAttrID, dotsRef, enableAnimation
      },
      typeToPlotComponentMap = {
        casePlot: <CaseDots {...props}/>,
        dotChart: <ChartDots {...props}/>,
        dotPlot: <DotPlotDots {...props}/>,
        scatterPlot: <ScatterDots {...props}/>
      };
    return typeToPlotComponentMap[plotType];
  };

  const renderGraphAxes = () => {
    const places = AxisPlaces.filter((place: AxisPlace) => {
      return !!graphModel.getAxis(place);
    });
    return places.map((place: AxisPlace) => {
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
        <Adornments dotsRef={dotsRef}/>
        { appConfig.getSetting("defaultSeriesLegend", "graph") &&
          <MultiLegend
            graphElt={graphRef.current}
            onChangeAttribute={handleChangeAttribute}
            onRemoveAttribute={handleRemoveAttribute}
            onTreatAttributeAs={handleTreatAttrAs}
          />
        }
      </div>
    </DataConfigurationContext.Provider>
  );
});
