import { observer } from "mobx-react";
import React from "react";
import { axisPlaceToAttrRole } from "../../graph-types";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { AddSeriesButton } from "./add-series-button";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { isSharedDataSet, SharedDataSet, SharedDataSetType } from "../../../../models/shared/shared-data-set";
import { DataConfigurationContext, useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { IGraphLayerModel } from "../../models/graph-layer-model";
import { ColorIdListFunction, ILegendHeightFunctionProps, ILegendPartProps } from "./legend-types";

import RemoveDataIcon from "../../assets/remove-data-icon.svg";
import XAxisIcon from "../../assets/x-axis-icon.svg";
import YAxisIcon from "../../assets/y-axis-icon.svg";

export const layerLegendType = "layer-legend";

const kLayerLegendHeaderHeight = 58;
const kLayerLegendRowHeight = 52;

/**
 * The Legend for a single dataset in an xy-plot
 * Contains SimpleAttributeLabel for each current yAttribute
 * Adds an Add Series button when appropriate
 * Adds unlink button to remove layer
 */
const SingleLayerLegend = observer(function SingleLayerLegend(props: ILegendPartProps) {
  let legendItems = [] as React.ReactNode[];
  const graphModel = useGraphModelContext();
  const dataConfiguration = useDataConfigurationContext();
  const readOnly = useReadOnlyContext();
  const xAttrId = dataConfiguration?.attributeID(axisPlaceToAttrRole.bottom);
  const { onChangeAttribute, onRemoveAttribute, onTreatAttributeAs } = props;
  if (!onChangeAttribute || !onRemoveAttribute || !onTreatAttributeAs) return null;

  function handleRemoveIconClick() {
    if (dataConfiguration?.dataset) {
      const removeId = dataConfiguration.dataset.id;
      const smm = getSharedModelManager(graphModel);
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

  if (dataConfiguration) {
    const yAttributes = dataConfiguration.yAttributeDescriptions;

    legendItems = yAttributes.map((description, index) =>
      <>
        <div className="legend-icon">
          <YAxisIcon />
        </div>
        <SimpleAttributeLabel
          attrId={description.attributeID}
          includePoint={true}
          key={description.attributeID}
          onChangeAttribute={onChangeAttribute}
          onRemoveAttribute={onRemoveAttribute}
          onTreatAttributeAs={onTreatAttributeAs}
          place={'left'}
        />
      </>
    );
    if (!readOnly) {
      legendItems.push(<AddSeriesButton />);
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
    const datasetId = dataConfiguration?.dataset?.id;
    const smm = getSharedModelManager(graphModel);

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
      { dataConfiguration?.dataset !== undefined &&
        <div className="legend-row legend-title-row">
          <div className="legend-cell-1">
            { !readOnly &&
              <div className="legend-icon">
                <button onClick={handleRemoveIconClick} className="remove-button" title="Unlink data provider">
                    <RemoveDataIcon />
                </button>
              </div>
            }
            <div className="legend-title">
              Data from: <strong>{getOriginString()}</strong>&nbsp;
            </div>
          </div>
          <div className="legend-cell-2">
            { xAttrId &&
              <>
                <div className="legend-icon">
                  <XAxisIcon />
                </div>
                <SimpleAttributeLabel
                  place="bottom"
                  attrId={xAttrId}
                  onChangeAttribute={onChangeAttribute}
                  onRemoveAttribute={onRemoveAttribute}
                  onTreatAttributeAs={onTreatAttributeAs}
                />
              </>
            }
          </div>
        </div>
      }
      {legendItemRows}
    </>
  );
});

export const LayerLegend = observer(function LayerLegend(props: ILegendPartProps) {
  const graphModel = useGraphModelContext();
  return (
    <>
      {
        graphModel.layers.map((layer) => {
          return (
            <DataConfigurationContext.Provider key={layer.id} value={layer.config}>
              <SingleLayerLegend {...props} />
            </DataConfigurationContext.Provider>);
          }
        )
      }
    </>
  );
});

function heightOfOneLayerLegend(layer: IGraphLayerModel) {
  if (!layer.config.dataset) return 0;

  const yAttrDescriptions = layer.config.yAttributeDescriptions.length;
  // Only include the add series button if we have unused attributes
  const attributeCount = layer.config.dataset?.attributes?.length ?? 0;
  const addSeriesButton = (yAttrDescriptions + 1) < attributeCount ? 1 : 0;
  const rows = Math.ceil((yAttrDescriptions + addSeriesButton) / 2);
  return kLayerLegendHeaderHeight + kLayerLegendRowHeight * rows;
}
export function heightOfLayerLegend({ graphModel }: ILegendHeightFunctionProps) {
  return graphModel.layers.reduce((prev, layer) => {
    return prev + heightOfOneLayerLegend(layer);
  }, 0);
}

export const colorIdsOfLayerLegend: ColorIdListFunction = function colorIdsOfLayerLegend(graphModel) {
  let ids: string[] = [];
  const sharedModelManager = getSharedModelManager(graphModel);
  if (sharedModelManager?.isReady) {
    const sharedDataSets =
      sharedModelManager.getTileSharedModelsByType(graphModel, SharedDataSet) as SharedDataSetType[];
    sharedDataSets.forEach(dataSet => {
      ids = ids.concat(Array.from(dataSet.dataSet.attributes).map(attr => attr.id));
    });
  }
  return ids;
};
