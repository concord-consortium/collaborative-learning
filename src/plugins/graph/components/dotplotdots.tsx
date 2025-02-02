import {max, range, ScaleBand, ScaleLinear, select} from "d3";
import {observer} from "mobx-react-lite";
import React, {useCallback, useRef, useState} from "react";
import {CaseData} from "../d3-types";
import {PlotProps} from "../graph-types";
import {useDragHandlers, usePlotResponders} from "../hooks/use-plot";
import {useGraphLayoutContext} from "../models/graph-layout";
import {ICase} from "../../../models/data/data-set-types";
import {
  handleClickOnDot,
  setPointCoordinates,
  setPointSelection,
  startAnimation
} from "../utilities/graph-utils";
import { useGraphModelContext } from "../hooks/use-graph-model-context";
import { useDataConfigurationContext } from "../hooks/use-data-configuration-context";
import { useGraphLayerContext } from "../hooks/use-graph-layer-context";

export const DotPlotDots = observer(function DotPlotDots(props: PlotProps) {
  const {dotsRef, enableAnimation} = props,
    graphModel = useGraphModelContext(),
    layer = useGraphLayerContext(),
    dataConfiguration = useDataConfigurationContext(),
    dataset = dataConfiguration?.dataset,
    layout = useGraphLayoutContext(),
    primaryAttrRole = dataConfiguration?.primaryRole ?? 'x',
    primaryIsBottom = primaryAttrRole === 'x',
    secondaryAttrRole = primaryAttrRole === 'x' ? 'y' : 'x',
    {pointColor, pointStrokeColor} = graphModel,
    // Used for tracking drag events
    [dragID, setDragID] = useState(''),
    currPos = useRef(0),
    didDrag = useRef(false),
    target = useRef<any>(),
    selectedDataObjects = useRef<Record<string, number>>({});

  const onDragStart = useCallback((event: any) => {
      target.current = select(event.target as SVGSVGElement);
      const aCaseData: CaseData = target.current.node().__data__;
      if (!aCaseData) return;
      dataset?.beginCaching();
      didDrag.current = false;
      const tItsID: string = aCaseData.caseID;
      if (target.current.node()?.nodeName === 'circle') {
        enableAnimation.current = false; // We don't want to animate points until end of drag
        target.current
          .property('isDragging', true)
          .transition()
          .attr('r', graphModel.getPointRadius('hover-drag'));
        setDragID(() => tItsID);
        currPos.current = primaryIsBottom ? event.clientX : event.clientY;

        handleClickOnDot(event, aCaseData, dataConfiguration);
        // Record the current values, so we can change them during the drag and restore them when done
        const { caseSelection } = dataConfiguration || {},
          primaryAttrID = dataConfiguration?.attributeID(dataConfiguration?.primaryRole ?? 'x') ?? '';
          caseSelection?.forEach(anID => {
          const itsValue = dataset?.getNumeric(anID, primaryAttrID) || undefined;
          if (itsValue != null) {
            selectedDataObjects.current[anID] = itsValue;
          }
        });
      }
    }, [graphModel, dataConfiguration, dataset, primaryIsBottom, enableAnimation]),

    onDrag = useCallback((event: MouseEvent) => {
      const primaryPlace = primaryIsBottom ? 'bottom' : 'left',
        primaryAxisScale = layout.getAxisScale(primaryPlace) as ScaleLinear<number, number> | undefined;
      if (primaryAxisScale && dragID) {
        const newPos = primaryIsBottom ? event.clientX : event.clientY,
          deltaPixels = newPos - currPos.current,
          primaryAttrID = dataConfiguration?.attributeID(primaryAttrRole) ?? '';
        currPos.current = newPos;
        if (deltaPixels !== 0) {
          didDrag.current = true;
          const delta = Number(primaryAxisScale.invert(deltaPixels)) -
              Number(primaryAxisScale.invert(0)),
            caseValues: ICase[] = [],
            { caseSelection } = dataConfiguration || {};
            caseSelection?.forEach(anID => {
            const currValue = Number(dataset?.getNumeric(anID, primaryAttrID));
            if (isFinite(currValue)) {
              caseValues.push({__id__: anID, [primaryAttrID]: currValue + delta});
            }
          });
          caseValues.length && dataset?.setCaseValues(caseValues, [primaryAttrID]);
        }
      }
    }, [dataset, dragID, primaryIsBottom, dataConfiguration, layout, primaryAttrRole]),

    onDragEnd = useCallback(() => {

      if (dragID !== '') {
        target.current
          .classed('dragging', false)
          .property('isDragging', false)
          .transition()
          .attr('r', graphModel.getPointRadius('select'));
        setDragID('');
        target.current = null;

        if (didDrag.current) {
          const caseValues: ICase[] = [],
            { caseSelection } = dataConfiguration || {};
            caseSelection?.forEach(anID => {
            caseValues.push({
              __id__: anID,
              [dataConfiguration?.attributeID(primaryAttrRole) ?? '']: selectedDataObjects.current[anID]
            });
          });
          startAnimation(enableAnimation); // So points will animate back to original positions
          caseValues.length && dataset?.setCaseValues(caseValues);
          didDrag.current = false;
        }
      }
    }, [graphModel, dataConfiguration, primaryAttrRole, dataset, dragID, enableAnimation]);

  useDragHandlers(window, {start: onDragStart, drag: onDrag, end: onDragEnd});

  const refreshPointSelection = useCallback(() => {
    dataConfiguration && setPointSelection({
      dotsRef, dataConfiguration, pointRadius: graphModel.getPointRadius(),
      pointColor, pointStrokeColor, selectedPointRadius: graphModel.getPointRadius('select')
    });
  }, [dataConfiguration, dotsRef, graphModel, pointColor, pointStrokeColor]);

  const refreshPointPositions = useCallback((selectedOnly: boolean) => {
      if (!dataConfiguration) return;

      const primaryPlace = primaryIsBottom ? 'bottom' : 'left',
        secondaryPlace = primaryIsBottom ? 'left' : 'bottom',
        extraPrimaryPlace = primaryIsBottom ? 'top' : 'rightCat',
        extraPrimaryRole = primaryIsBottom ? 'topSplit' : 'rightSplit',
        extraSecondaryPlace = primaryIsBottom ? 'rightCat' : 'top',
        extraSecondaryRole = primaryIsBottom ? 'rightSplit' : 'topSplit',
        primaryAxisScale = layout.getAxisScale(primaryPlace) as ScaleLinear<number, number>,
        extraPrimaryAxisScale = layout.getAxisScale(extraPrimaryPlace) as ScaleBand<string>,
        secondaryAxisScale = layout.getAxisScale(secondaryPlace) as ScaleBand<string>,
        extraSecondaryAxisScale = layout.getAxisScale(extraSecondaryPlace) as ScaleBand<string>,
        primaryAttrID = dataConfiguration?.attributeID(primaryAttrRole) ?? '',
        extraPrimaryAttrID = dataConfiguration?.attributeID(extraPrimaryRole) ?? '',
        numExtraPrimaryBands = Math.max(1, extraPrimaryAxisScale?.domain().length ?? 1),
        pointDiameter = 2 * graphModel.getPointRadius(),
        secondaryAttrID = dataConfiguration?.attributeID(secondaryAttrRole) ?? '',
        extraSecondaryAttrID = dataConfiguration?.attributeID(extraSecondaryRole) ?? '',
        secondaryRangeIndex = primaryIsBottom ? 0 : 1,
        secondaryMax = Number(secondaryAxisScale.range()[secondaryRangeIndex]),
        secondaryAxisExtent = Math.abs(Number(secondaryAxisScale.range()[0] -
          secondaryAxisScale.range()[1])),
        fullSecondaryBandwidth = secondaryAxisScale.bandwidth?.() ?? secondaryAxisExtent,
        numExtraSecondaryBands = Math.max(1, extraSecondaryAxisScale?.domain().length ?? 1),
        secondaryBandwidth = fullSecondaryBandwidth / numExtraSecondaryBands,
        extraSecondaryBandwidth = (extraSecondaryAxisScale.bandwidth?.() ?? secondaryAxisExtent),
        secondarySign = primaryIsBottom ? -1 : 1,
        baseCoord = primaryIsBottom ? secondaryMax : 0,
        binMap: Record<string, {
          category: string, extraCategory: string,
          extraPrimaryCategory: string, indexInBin: number
        }> = {};
      let overlap = 0;

      function computeBinPlacements() {
        const
          primaryLength = layout.getAxisLength(primaryPlace) /
            numExtraPrimaryBands,
          numBins = Math.ceil(primaryLength / pointDiameter) + 1,
          binWidth = primaryLength / (numBins - 1),
          bins: Record<string, Record<string, Record<string, string[][]>>> = {};

        if (primaryAxisScale) {
          dataConfiguration?.caseDataArray.forEach((aCaseData: CaseData) => {
            const anID = aCaseData.caseID,
              numerator = primaryAxisScale(dataset?.getNumeric(anID, primaryAttrID) ?? -1) /
                numExtraPrimaryBands,
              bin = Math.ceil((numerator ?? 0) / binWidth),
              category = dataset?.getStrValue(anID, secondaryAttrID) ?? '__main__',
              extraCategory = dataset?.getStrValue(anID, extraSecondaryAttrID) ?? '__main__',
              extraPrimaryCategory = dataset?.getStrValue(anID, extraPrimaryAttrID) ?? '__main__';
            if (!bins[category]) {
              bins[category] = {};
            }
            if (!bins[category][extraCategory]) {
              bins[category][extraCategory] = {};
            }
            if (!bins[category][extraCategory][extraPrimaryCategory]) {
              bins[category][extraCategory][extraPrimaryCategory] = range(numBins + 1).map(() => []);
            }
            if (bin >= 0 && bin <= numBins) {
              binMap[anID] = {
                category, extraCategory, extraPrimaryCategory,
                indexInBin: bins[category][extraCategory][extraPrimaryCategory][bin].length
              };
              bins[category][extraCategory][extraPrimaryCategory][bin].push(anID);
            }
          });
          // Compute the length the record in bins with the most elements
          const maxInBin = max(Object.values(bins).map(anExtraBins => {
            return max(Object.values(anExtraBins).map(aBinArray => {
              return max(Object.values(aBinArray).map(aBin => {
                return max(aBin.map(innerArray => innerArray.length)) || 0;
              })) || 0;
            })) || 0;
          })) || 0;

          const excessHeight = Math.max(0,
            maxInBin - Math.floor(secondaryBandwidth / pointDiameter)) * pointDiameter;
          overlap = excessHeight / maxInBin;
        }
      }

      computeBinPlacements();

      const computeSecondaryCoord =
        (caseInfo: { secondaryCat: string, extraSecondaryCat: string, indexInBin: number }) => {
          const {secondaryCat, extraSecondaryCat, indexInBin} = caseInfo;
          let catCoord = (!!secondaryCat && secondaryCat !== '__main__' ? secondaryAxisScale(secondaryCat) ?? 0 : 0) /
            numExtraSecondaryBands;
          let extraCoord = !!extraSecondaryCat && extraSecondaryCat !== '__main__'
            ? (extraSecondaryAxisScale(extraSecondaryCat) ?? 0) : 0;
          if (primaryIsBottom) {
            extraCoord = secondaryAxisExtent - extraSecondaryBandwidth - extraCoord;
            catCoord = extraSecondaryBandwidth - secondaryBandwidth - catCoord;
            return baseCoord - catCoord - extraCoord -
              pointDiameter / 2 - indexInBin * (pointDiameter - overlap);
          } else {
            return baseCoord + extraCoord + secondarySign * (catCoord + pointDiameter / 2 +
              indexInBin * (pointDiameter - overlap));
          }
        };

      const
        // Note that we can get null for either or both of the next two functions. It just means that we have
        // a circle for the case, but we're not plotting it.
        getPrimaryScreenCoord = (anID: string) => {
          const primaryCoord = primaryAxisScale(dataset?.getNumeric(anID, primaryAttrID) ?? -1) /
              numExtraPrimaryBands,
            extraPrimaryValue = dataset?.getStrValue(anID, extraPrimaryAttrID),
            extraPrimaryCoord = extraPrimaryValue
              ? extraPrimaryAxisScale(extraPrimaryValue ?? '__main__') ?? 0
              : 0;
          return primaryCoord + extraPrimaryCoord;
        },
        getSecondaryScreenCoord = (anID: string) => {
          if (!binMap[anID]) {
            return null; // Not NaN because NaN causes errors during transitions
          }
          const secondaryCat = binMap[anID].category,
            extraSecondaryCat = binMap[anID].extraCategory,
            indexInBin = binMap[anID].indexInBin,
            onePixelOffset = primaryIsBottom ? -1 : 1; // Separate circles from axis line by 1 pixel
          return binMap[anID]
            ? computeSecondaryCoord({secondaryCat, extraSecondaryCat, indexInBin}) + onePixelOffset
            : null;
        },
        getScreenX = primaryIsBottom ? getPrimaryScreenCoord : getSecondaryScreenCoord,
        getScreenY = primaryIsBottom ? getSecondaryScreenCoord : getPrimaryScreenCoord,
        getLegendColor = dataConfiguration?.attributeID('legend')
          ? dataConfiguration?.getLegendColorForCase : undefined;

      setPointCoordinates({
        dataConfiguration, pointRadius: graphModel.getPointRadius(),
        getColorForId: graphModel.getColorForId,
        selectedPointRadius: graphModel.getPointRadius('select'),
        dotsRef, selectedOnly, pointColor, pointStrokeColor,
        getScreenX, getScreenY, getLegendColor, enableAnimation,
        enableConnectors: false
      });
    },
    [graphModel, dataConfiguration, layout, primaryAttrRole, secondaryAttrRole, dataset, dotsRef,
      enableAnimation, primaryIsBottom, pointColor, pointStrokeColor]);

  usePlotResponders({layer, dotsRef, refreshPointPositions, refreshPointSelection, enableAnimation});

  return (
    <>
    </>
  );
});
