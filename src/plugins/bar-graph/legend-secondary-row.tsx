import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import { Button, Menu, MenuButton, MenuItem, MenuList } from '@chakra-ui/react';
import { useBarGraphModelContext } from './bar-graph-content-context';
import { displayValue, isMissingData } from './bar-graph-utils';
import { clueDataColorInfo } from '../../utilities/color-utils';

interface IProps {
  attrValue: string;
}

export const LegendSecondaryRow = observer(function LegendSecondaryRow ({attrValue}: IProps) {
  const model = useBarGraphModelContext();
  if (!model) return null;

  const missingData = isMissingData(attrValue);
  const display = displayValue(attrValue);
  const backgroundColor = model.secondaryAttribute
    ? model.colorForSecondaryKey(attrValue)
    : model.primaryAttributeColor;

  const handleColorSelect = (color: string) => {
    if (model.secondaryAttribute) {
      model.setSecondaryAttributeKeyColor(attrValue, color);
    } else {
      model.setPrimaryAttributeColor(color);
    }
  };

  return (
    <div key={attrValue} className="secondary-value">
      <Menu placement="auto">
        <MenuButton as={Button} unstyle="true" data-testid="color-menu-button">
          <div className="color-button">
            <div className="color-swatch" style={{ backgroundColor }} />
          </div>
        </MenuButton>
        <MenuList
          bg="white"
          border="none"
          borderRadius="5px"
          boxShadow="0 0 5px 0 rgba(0, 0, 0, 0.35)"
          className="color-menu-list"
          data-testid="color-menu-list"
          display="grid"
          gap={0}
          gridTemplateColumns="repeat(2, 1fr)"
          zIndex={1}
        >
          {Object.entries(clueDataColorInfo).map(([key, value]) => (
            <MenuItem
              className="color-menu-list-item"
              data-testid="color-menu-list-item"
              key={key}
              onClick={() => handleColorSelect(value.color)}
            >
              <div className="color-button">
                <div className="color-swatch" style={{ backgroundColor: value.color }} />
              </div>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
      <div className={classNames("secondary-value-name", { missing: missingData })}>
        {display}
      </div>
    </div>
  );
});

export default LegendSecondaryRow;
