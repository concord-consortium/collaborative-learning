import { observer } from "mobx-react";
import React, { useContext } from "react";
import { AttributeType } from "../../../../models/data/attribute";
import { IDataSet } from "../../../../models/data/data-set";
import { GraphPlace } from "../../imports/components/axis-graph-shared";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { AddSeriesButton } from "./add-series-button";
import { IGraphLayerModel } from "../../models/graph-layer-model";
import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import { useGraphModelContext } from "../../models/graph-model";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { isSharedDataSet, SharedDataSet } from "../../../../models/shared/shared-data-set";

import RemoveDataIcon from "../../assets/remove-data-icon.svg";

interface ILayerLegendProps {
  layer: IGraphLayerModel;
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
}

export const LayerLegend = observer(function LayerLegend(props: ILayerLegendProps) {
  let legendItems = [] as React.ReactNode[];
  const { layer, onChangeAttribute, onRemoveAttribute, onTreatAttributeAs } = props;
  const graphModel = useGraphModelContext();
  const readOnly = useContext(ReadOnlyContext);

  function handleRemoveIconClick() {
    if (layer.config.dataset) {
      const removeId = layer.config.dataset.id;
      const smm = getSharedModelManager(layer);
      if (smm && smm.isReady) {
        const sharedDataSets = smm.getTileSharedModelsByType(graphModel, SharedDataSet);
        const layerSharedDataSet = sharedDataSets.find((sds) => {
          return isSharedDataSet(sds) && sds.dataSet.id === removeId; });
        if (layerSharedDataSet) {
          smm.removeTileSharedModel(graphModel, layerSharedDataSet);
        }
      }
    }
  }

  const dataConfiguration = layer.config;
  if (dataConfiguration) {
    const yAttributes = dataConfiguration.yAttributeDescriptions;

    legendItems = yAttributes.map((description, index) =>
      <SimpleAttributeLabel
        layer={layer}
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

  const hasDataset = layer.config.dataset !== undefined;

  return (
    <>
      {hasDataset &&
        <div className="legend-title-row">
          <div className="legend-title">
            Data from: <strong>{dataConfiguration?.dataset?.name}</strong>&nbsp;
          </div>
          <div className="legend-icon">
            <button onClick={handleRemoveIconClick} className="remove-button">
              <RemoveDataIcon />
            </button>
          </div>
        </div>
      }
      {legendItemRows}
    </>
  );

});