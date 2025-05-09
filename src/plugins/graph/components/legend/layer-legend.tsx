import { observer } from "mobx-react";
import React from "react";
import { axisPlaceToAttrRole } from "../../graph-types";
import { SimpleAttributeLabel } from "../simple-attribute-label";
import { AddSeriesButton } from "./add-series-button";
import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { useGraphModelContext } from "../../hooks/use-graph-model-context";
import { getSharedModelManager } from "../../../../models/tiles/tile-environment";
import { isSharedDataSet, SharedDataSet } from "../../../../models/shared/shared-data-set";
import { clueDataColorInfo } from "../../../../utilities/color-utils";
import { DataConfigurationContext, useDataConfigurationContext } from "../../hooks/use-data-configuration-context";
import { IGraphLayerModel } from "../../models/graph-layer-model";
import { LegendDropdown } from "./legend-dropdown";
import { LegendIdListFunction, ILegendHeightFunctionProps, ILegendPartProps } from "./legend-types";
import { logSharedModelDocEvent } from "../../../../models/document/log-shared-model-document-event";
import { LogEventName } from "../../../../lib/logger-types";
import { useTileModelContext } from "../../../../components/tiles/hooks/use-tile-model-context";
import { EditableLabelWithButton } from "../../../../components/utilities/editable-label-with-button";
import { GraphLayerContext, useGraphLayerContext } from "../../hooks/use-graph-layer-context";

import RemoveDataIcon from "../../../../assets/remove-data-icon.svg";
import XAxisIcon from "../../assets/x-axis-icon.svg";
import YAxisIcon from "../../assets/y-axis-icon.svg";

export const layerLegendType = "layer-legend";

const kLayerLegendHeaderHeight = 58;
const kLayerLegendRowHeight = 52;

interface IColorKeyProps {
  color: string;
}
function ColorKey({ color }: IColorKeyProps) {
  const colorKeyStyle = { backgroundColor: color };
  return (
    <div className="symbol-container">
      <div className="attr-symbol" style={colorKeyStyle}></div>
    </div>
  );
}

/**
 * The Legend for a single dataset in an xy-plot
 * Contains SimpleAttributeLabel for each current yAttribute
 * Adds an Add Series button when appropriate
 * Adds unlink button to remove layer
 */
const SingleLayerLegend = observer(function SingleLayerLegend(props: ILegendPartProps) {
  let legendItems = [] as React.ReactNode[];
  const graphModel = useGraphModelContext();
  const layer = useGraphLayerContext();
  const dataConfiguration = useDataConfigurationContext();
  const readOnly = useReadOnlyContext();
  const { tile } = useTileModelContext();
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
          const sharedTiles = smm.getSharedModelProviders(layerSharedDataSet);
          if (tile){
            logSharedModelDocEvent(LogEventName.TILE_UNLINK, tile , sharedTiles, layerSharedDataSet);
          }
        }
      }
    }
  }


  const dataSetName = dataConfiguration?.dataset?.name || "Unknown";

  function handleSetDataSetName (value: string) {
    if (value) {
      dataConfiguration?.dataset?.setName(value);
    }
  }

  const layerName =
  <span className="layer-name">
    {layer.editable
      ? <EditableLabelWithButton defaultValue={dataSetName} onSubmit={handleSetDataSetName}/>
      : dataSetName
    }
  </span>;

  if (dataConfiguration) {
    const yAttributes = dataConfiguration.yAttributeDescriptions;

    legendItems = yAttributes.map((description, index) =>
      <>
        <LegendDropdown
          buttonAriaLabel={`Color: ${graphModel.getColorNameForId(description.attributeID)}`}
          buttonLabel={<ColorKey color={graphModel.getColorForId(description.attributeID)} />}
          menuItems={
            clueDataColorInfo.map((color, colorIndex) => ({
              ariaLabel: color.name,
              key: color.color,
              label: <ColorKey color={color.color} />,
              onClick: () => graphModel.setColorForId(description.attributeID, colorIndex)
            }))
          }
        />
        <div className="legend-icon">
          <YAxisIcon />
        </div>
        <SimpleAttributeLabel
          attrId={description.attributeID}
          hideRemoveOption={yAttributes.length <= 1}
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
              Data from: {layerName}
            </div>
          </div>
          <div className="legend-cell-2">
            { xAttrId &&
              <>
                <div className="legend-icon">
                  <XAxisIcon />
                </div>
                <SimpleAttributeLabel
                  hideRemoveOption={true}
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
            <GraphLayerContext.Provider key={layer.id} value={layer}>
              <DataConfigurationContext.Provider value={layer.config}>
                <SingleLayerLegend {...props} />
              </DataConfigurationContext.Provider>
            </GraphLayerContext.Provider>
          );
        })
      }
    </>
  );
});

function heightOfOneLayerLegend(layer: IGraphLayerModel) {
  if (!layer.config.dataset) return 0;

  const yAttrDescriptions = layer.config.yAttributeDescriptions.length;
  // The extra 1 is for the add series button, which is present but disabled if there are no more attributes to add
  const rows = Math.ceil((yAttrDescriptions + 1) / 2);
  return kLayerLegendHeaderHeight + kLayerLegendRowHeight * rows;
}
export function heightOfLayerLegend({ graphModel }: ILegendHeightFunctionProps) {
  return graphModel.layers.reduce((prev, layer) => {
    return prev + heightOfOneLayerLegend(layer);
  }, 0);
}

export const getLayerLegendIdList: LegendIdListFunction = function getLayerLegendIdList(graphModel) {
  let ids: string[] = [];
  graphModel.layers?.forEach(layer => {
    ids = ids.concat(layer.config.yAttributeDescriptions.map(description => description.attributeID));
  });
  return ids;
};
