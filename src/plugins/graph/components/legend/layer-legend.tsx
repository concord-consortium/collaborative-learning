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
import { isSharedDataSet, SharedDataSet, SharedDataSetType } from "../../../../models/shared/shared-data-set";

import RemoveDataIcon from "../../assets/remove-data-icon.svg";

interface ILayerLegendProps {
  layer: IGraphLayerModel;
  onChangeAttribute: (place: GraphPlace, dataSet: IDataSet, attrId: string, oldAttrId?: string) => void;
  onRemoveAttribute: (place: GraphPlace, attrId: string) => void;
  onTreatAttributeAs: (place: GraphPlace, attrId: string, treatAs: AttributeType) => void;
}

/**
 * The Legend for a single dataset in an xy-plot
 * Contains SimpleAttributeLabel for each current yAttribute
 * Adds an Add Series button when appropriate
 * Adds unlink button to remove layer
 */
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

  // FIXME: down the road we will use persistent human-readable dataset names: PT-186549943
  // At the moment, however, we look for the name of the tile that originally spawned the dataset
  // In the case that the original tile was deleted we show "unknown data source"
  function getOriginString() {
    const tempUnknownString = "unknown data source";
    const datasetId = layer.config.dataset?.id;
    const smm = getSharedModelManager(layer);

    if (datasetId && smm?.isReady) {
      const sharedModels = smm.getTileSharedModels(graphModel);
      const foundSharedModel = sharedModels?.find((sharedModel) => {
        return isSharedDataSet(sharedModel) && sharedModel.dataSet.id === datasetId;
      });
      const foundProviderId = (foundSharedModel as SharedDataSetType)?.providerId;
      const foundTile = smm.getSharedModelTiles(foundSharedModel)?.find(tile => tile.id === foundProviderId);
      return foundTile?.title ?? tempUnknownString;
    }
    return tempUnknownString;
  }

  return (
    <>
      { layer.config.dataset !== undefined &&
        <div className="legend-title-row">
          <div className="legend-title">
            Data from: <strong>{getOriginString()}</strong>&nbsp;
          </div>
          <div className="legend-icon">
            <button onClick={handleRemoveIconClick} className="remove-button" title="Unlink data provider">
              <RemoveDataIcon />
            </button>
          </div>
        </div>
      }
      {legendItemRows}
    </>
  );
});