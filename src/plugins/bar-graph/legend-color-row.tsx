import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import { Button, Menu, MenuButton, MenuItem, MenuList, Portal } from '@chakra-ui/react';
import { useBarGraphModelContext } from './bar-graph-content-context';
import { displayValue, isMissingData } from './bar-graph-utils';
import { clueDataColorInfo } from '../../utilities/color-utils';

interface IProps {
  attrValue: string;
}

export const LegendColorRow = observer(function LegendColorRow ({attrValue}: IProps) {
  const model = useBarGraphModelContext();
  if (!model) return null;

  const missingData = isMissingData(attrValue);
  const display = displayValue(attrValue);
  const currentColorIndex = model.secondaryAttribute
    ? model.colorForSecondaryKey(attrValue)
    : model.colorForPrimaryKey(attrValue);
  const currentColor = clueDataColorInfo[currentColorIndex];
  const backgroundColor = currentColor.color;

  const handleColorSelect = (colorIndex: number) => {
    if (model.secondaryAttribute) {
      model.setSecondaryAttributeKeyColor(attrValue, colorIndex);
    } else {
      model.setPrimaryAttributeKeyColor(attrValue, colorIndex);
    }
  };

  const menuButtonAriaLabel =
    `Color for ${display}: ${currentColor.name}. Press Enter or Arrow to choose a color.`;

  return (
    <div key={attrValue} className="attribute-value">
      <Menu placement="auto">
        <MenuButton
          as={Button}
          unstyle="true"
          data-testid="color-menu-button"
          aria-label={menuButtonAriaLabel}
        >
          <div className="color-button">
            <div className="color-swatch" style={{ backgroundColor }} />
          </div>
        </MenuButton>
        {/* Portal renders the MenuList outside the tile DOM so our tile focus trap
            does not include its items in the parent Tab cycle when the menu is open. */}
        <Portal>
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
            {clueDataColorInfo.map((colorInfo, index) => (
              <MenuItem
                className="color-menu-list-item"
                data-testid="color-menu-list-item"
                key={colorInfo.name}
                aria-label={colorInfo.name}
                onClick={() => handleColorSelect(index)}
              >
                <div className="color-button">
                  <div className="color-swatch" style={{ backgroundColor: colorInfo.color }} />
                </div>
              </MenuItem>
            ))}
          </MenuList>
        </Portal>
      </Menu>
      <div className={classNames("attribute-value-name", { missing: missingData })}>
        {display}
      </div>
    </div>
  );
});

export default LegendColorRow;
