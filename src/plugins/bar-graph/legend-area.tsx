import React from 'react';
import { observer } from 'mobx-react';
import { Menu, MenuButton, MenuItem, MenuList, Portal } from '@chakra-ui/react';
import { useBarGraphModelContext } from './bar-graph-content-context';
import { LegendSecondaryRow } from './legend-secondary-row';

import RemoveDataIcon from "../../assets/remove-data-icon.svg";
import DropdownCaretIcon from "../../assets/dropdown-caret.svg";


export const LegendArea = observer(function LegendArea () {
  const model = useBarGraphModelContext();

  function unlinkDataset() {
    if (model) {
      model.unlinkDataSet();
    }
  }

  function setSecondaryAttribute(attributeId: string|undefined) {
    if (model) {
      model.setSecondaryAttribute(attributeId);
    }
  }

  if (!model || !model.dataSet || !model.primaryAttribute) {
    return null;
  }

  const dataSet = model.dataSet.dataSet;
  const allAttributes = dataSet?.attributes || [];
  const availableAttributes = allAttributes.filter((a) => a.id !== model.primaryAttribute);
  const currentPrimary = dataSet?.attrFromID(model.primaryAttribute);
  const currentSecondary = model.secondaryAttribute ? dataSet?.attrFromID(model.secondaryAttribute) : undefined;
  const currentLabel = currentSecondary?.name || "None";

  const secondaryKeys = model.secondaryKeys;

  return (
    <div className="bar-graph-legend">
      <div className="dataset-header">
        <div className="dataset-icon">
          <a onClick={unlinkDataset} aria-label={`Unlink ${model.dataSet.name}`}>
            <RemoveDataIcon/>
          </a>
        </div>
        <div className="dataset-label">
          <span className="dataset-label-text">Data from:</span>
          <span className="dataset-name">{model.dataSet.name}</span>
        </div>
      </div>

      <div className="sort-by">
        <div>
          Sort by:
        </div>
        <Menu boundary="scrollParent">
          <MenuButton>
            <span className="button-content">
              <span className="button-text">{currentLabel}</span>
              <DropdownCaretIcon/>
            </span>
          </MenuButton>
          <Portal>
            <MenuList>
              <MenuItem onClick={() => setSecondaryAttribute(undefined)}>None</MenuItem>
              {availableAttributes.map((a) => (
                <MenuItem key={a.id} onClick={() => setSecondaryAttribute(a.id)}>{a.name}</MenuItem>
              ))}
            </MenuList>
          </Portal>
        </Menu>
      </div>

      <div className="secondary-values">
        {currentSecondary
         ? secondaryKeys.map((key) => <LegendSecondaryRow key={key} attrValue={key} />)
         : <LegendSecondaryRow attrValue={currentPrimary.name}/> }
      </div>
    </div>
  );
});

export default LegendArea;
