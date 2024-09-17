import React from 'react';
import { observer } from 'mobx-react';
import { Menu, MenuButton, MenuItem, MenuList, Portal } from '@chakra-ui/react';
import { useBarGraphModelContext } from './bar-graph-content-context';
import { LegendSecondaryRow } from './legend-secondary-row';

import RemoveDataIcon from "../../assets/remove-data-icon.svg";
import DropdownCaretIcon from "../../assets/dropdown-caret.svg";
import { useReadOnlyContext } from '../../components/document/read-only-context';
import { logBarGraphEvent } from './bar-graph-utils';
import { logSharedModelDocEvent } from '../../models/document/log-shared-model-document-event';
import { LogEventName } from '../../lib/logger-types';
import { useTileModelContext } from '../../components/tiles/hooks/use-tile-model-context';
import { getSharedModelManager } from '../../models/tiles/tile-environment';

interface IProps {
  legendRef: React.RefObject<HTMLDivElement>;
}

export const LegendArea = observer(function LegendArea ({legendRef}: IProps) {
  const { tile } = useTileModelContext();
  const model = useBarGraphModelContext();
  const readOnly = useReadOnlyContext();

  function unlinkDataset() {
    const sharedModel = model?.sharedModel;
    if (!readOnly && sharedModel) {
      model.unlinkDataSet();
      if (tile) {
        const sharedTiles = getSharedModelManager()?.getSharedModelProviders(sharedModel) || [];
        logSharedModelDocEvent(LogEventName.TILE_UNLINK, tile, sharedTiles, sharedModel);
      }
    }
  }

  function setSecondaryAttribute(attributeId: string|undefined) {
    if (model) {
      model.setSecondaryAttribute(attributeId);
      logBarGraphEvent(model, "setSecondaryAttribute", { attributeId });
    }
  }

  if (!model || !model.sharedModel || !model.primaryAttribute) {
    return null;
  }

  const dataSet = model.sharedModel.dataSet;
  const dataSetName = model.sharedModel.name;
  const allAttributes = dataSet?.attributes || [];
  const availableAttributes = allAttributes.filter((a) => a.id !== model.primaryAttribute);
  const currentPrimary = dataSet?.attrFromID(model.primaryAttribute);
  const currentSecondary = model.secondaryAttribute ? dataSet?.attrFromID(model.secondaryAttribute) : undefined;
  const currentLabel = currentSecondary?.name || "None";

  const secondaryKeys = model.secondaryKeys;

  return (
    <div className="bar-graph-legend">
      <div className="inner-container" ref={legendRef}>
        <div className="dataset-header">
          <div className="dataset-icon">
            <a onClick={unlinkDataset} aria-label={`Unlink ${dataSetName}`}>
              <RemoveDataIcon />
            </a>
          </div>
          <div className="dataset-label">
            <span className="dataset-label-text">Data from:</span>
            <span className="dataset-name">{dataSetName}</span>
          </div>
        </div>

        <div className="sort-by">
          <span>
            Sort by:
          </span>
          <Menu boundary="scrollParent">
            <MenuButton>
              <span className="button-content">
                <span className="button-text">{currentLabel}</span>
                <DropdownCaretIcon />
              </span>
            </MenuButton>
            <Portal>
              <MenuList>
                <MenuItem isDisabled={readOnly} onClick={() => setSecondaryAttribute(undefined)}>None</MenuItem>
                {availableAttributes.map((a) => (
                  <MenuItem key={a.id} isDisabled={readOnly} onClick={() => setSecondaryAttribute(a.id)}>
                    {a.name}
                  </MenuItem>
                ))}
              </MenuList>
            </Portal>
          </Menu>
        </div>

        <div className="secondary-values">
          {currentSecondary
            ? secondaryKeys.map((key) => <LegendSecondaryRow key={key} attrValue={key} />)
            : <LegendSecondaryRow attrValue={currentPrimary?.name} />}
        </div>
      </div>
    </div>
  );
});

export default LegendArea;
