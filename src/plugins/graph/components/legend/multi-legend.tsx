import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import {AttributeType} from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";
import { useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { AddSeriesButton } from "./add-series-button";
import { useInstanceIdContext } from "../../imports/hooks/use-instance-id-context";
import { kGraphDefaultHeight } from "../../graph-types";

export const kMultiLegendMenuHeight = 30;
export const kMultiLegendPadding = 20;
export const kMultiLegendVerticalGap = 10;

import "./multi-legend.scss";

interface IMultiLegendProps {
  graphElt: HTMLDivElement | null;
  readOnly: boolean;
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
  onRequestRowHeight?: (id: string, size: number) => void;
}

export const MultiLegend = observer(function MultiLegend(props: IMultiLegendProps) {
  const {readOnly, onChangeAttribute, onRemoveAttribute, onTreatAttributeAs, onRequestRowHeight} = props;
  const layout = useGraphLayoutContext();
  const legendBounds = layout.computedBounds.legend;
  const transform = `translate(${legendBounds.left}, ${legendBounds.top})`;
  const multiLegendRef = useRef<HTMLDivElement>(null);
  const dataConfiguration = useDataConfigurationContext();
  const instanceId = useInstanceIdContext();

  const yAttributeCount = dataConfiguration?.yAttributeDescriptions.length || 0;

  useEffect(() =>{
    const legendTransform = `translateY(${-layout.computedBounds.legend.height}px)`;
    if (!multiLegendRef.current) return;
    multiLegendRef.current.style.transform = legendTransform;
    multiLegendRef.current.style.width = `${layout.graphWidth}px`;
    multiLegendRef.current.style.height = `${legendBounds.height}px`;
  }, [layout.computedBounds.legend.height, layout.graphWidth, legendBounds, transform]);

  useEffect(function RespondToLayoutChange() {
    const legendRows = Math.ceil((yAttributeCount+1)/2);
    const legendHeight = kMultiLegendPadding * 2
      + kMultiLegendMenuHeight  * legendRows
      + kMultiLegendVerticalGap * (legendRows-1);
    layout.setDesiredExtent("legend", legendHeight);
    onRequestRowHeight?.(instanceId, kGraphDefaultHeight + legendHeight);
  }, [instanceId, layout, onRequestRowHeight, yAttributeCount]);

  let legendItems = [] as React.ReactNode[];
  if (dataConfiguration) {
    const yAttributes = dataConfiguration.yAttributeDescriptions;

    legendItems = yAttributes.map((description, index) =>
      <SimpleAttributeLabel
        key={description.attributeID}
        place={'left'}
        index={index}
        attrId={description.attributeID}
        readOnly={readOnly}
        onChangeAttribute={onChangeAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />);
    if (!readOnly) {
      legendItems.push(<AddSeriesButton/>);
    }
  }
  // Make rows with two legend items in each row
  const legendItemRows = [] as React.ReactNode[];
  let i=0;
  while(legendItems.length) {
    legendItemRows.push(
      <div key={i++} className="legend-row">
        <div className="legend-cell-1">
          {legendItems?.shift()}
        </div>
        <div className="legend-cell-2">
          {legendItems?.shift() || null}
        </div>
      </div>
    );
  }

  return (
    <div className="multi-legend" ref={ multiLegendRef }>
      {legendItemRows}
    </div>
  );
});

// MultiLegend.displayName = "MultiLegend";
