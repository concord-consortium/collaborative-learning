import { observer } from "mobx-react";
import React, { useContext } from "react";
import { AttributeType } from "../../../../models/data/attribute";
import { IDataSet } from "../../../../models/data/data-set";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { AddSeriesButton } from "./add-series-button";
import { IGraphLayerModel } from "../../models/graph-layer-model";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";

interface ILayerLegendProps {
  layer: IGraphLayerModel;
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
}

export const LayerLegend = observer(function LayerLegend(props: ILayerLegendProps) {

  let legendItems = [] as React.ReactNode[];
  const { layer, onChangeAttribute, onRemoveAttribute, onTreatAttributeAs } = props;
  const readOnly = useContext(ReadOnlyContext);

  const dataConfiguration = layer.config;
  if (dataConfiguration) {
    const yAttributes = dataConfiguration.yAttributeDescriptions;

    legendItems = yAttributes.map((description, index) =>
      <SimpleAttributeLabel
        key={description.attributeID}
        place={'left'}
        index={index}
        attrId={description.attributeID}
        onChangeAttribute={onChangeAttribute}
        onRemoveAttribute={onRemoveAttribute}
        onTreatAttributeAs={onTreatAttributeAs}
      />);
    if (!readOnly) {
      legendItems.push(<AddSeriesButton layer={layer} />);
    }
  }
  // Make rows with two legend items in each row
  const legendItemRows = [] as React.ReactNode[];
  let i = 0;
  while (legendItems.length) {
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
    <>
      Data from: <strong>{dataConfiguration?.dataset?.name}</strong>&nbsp;
      {legendItemRows}
    </>
  );

});
