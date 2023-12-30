import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { AttributeType } from "../../../../models/data/attribute";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { useGraphLayoutContext } from "../../models/graph-layout";
import { IDataSet } from "../../../../models/data/data-set";

import { useGraphSettingsContext } from "../../hooks/use-graph-settings-context";
import { useInstanceIdContext } from "../../imports/hooks/use-instance-id-context";
import { kGraphDefaultHeight } from "../../graph-types";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
import { multiLegendParts } from "./legend-registration";

import "./multi-legend.scss";

interface IMultiLegendProps {
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
  onRequestRowHeight?: (id: string, size: number) => void;
}

export const MultiLegend = observer(function MultiLegend(props: IMultiLegendProps) {
  const { onRequestRowHeight } = props;
  const layout = useGraphLayoutContext();
  const legendBounds = layout.computedBounds.legend;
  const transform = `translate(${legendBounds.left}, ${legendBounds.top})`;
  const multiLegendRef = useRef<HTMLDivElement>(null);
  const graphModel = useGraphModelContext();
  const instanceId = useInstanceIdContext();
  const { defaultSeriesLegend } = useGraphSettingsContext();

  useEffect(() => {
    const legendTransform = `translateY(${-layout.computedBounds.legend.height}px)`;
    if (!multiLegendRef.current) return;
    multiLegendRef.current.style.transform = legendTransform;
    multiLegendRef.current.style.width = `${layout.graphWidth}px`;
    multiLegendRef.current.style.height = `${legendBounds.height}px`;
  }, [layout.computedBounds.legend.height, layout.graphWidth, legendBounds, transform]);

  const heightFunctionProps = { graphModel };
  // TODO Remove this extra buffer space to make sure the whole legend can be seen before refactoring height calculation
  const extraHeight = 100;
  const totalHeight = multiLegendParts.reduce((prev, part) => {
    return prev + part.getHeight(heightFunctionProps);
  }, extraHeight);

  useEffect(function RespondToLayoutChange() {
    layout.setDesiredExtent("legend", totalHeight);
    onRequestRowHeight?.(instanceId, kGraphDefaultHeight + totalHeight);
  }, [instanceId, layout, onRequestRowHeight, totalHeight]);

  return (
    <div className="multi-legend" ref={ multiLegendRef }>
      {
        multiLegendParts.map(part => {
          const Component = part.component;
          return <Component {...props} key={part.type} />;
        })
      }
    </div>
  );
});
