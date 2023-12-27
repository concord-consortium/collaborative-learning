import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { ReactElement, useContext, useRef, useState } from "react";
import { Menu, MenuItem, MenuList, MenuButton, Portal } from "@chakra-ui/react";

import { ReadOnlyContext } from "../../../../components/document/read-only-context";
import DropdownCaretIcon from "../../assets/dropdown-caret.svg";

import "./legend-dropdown.scss";

interface IMenuItemInfo {
  key: string;
  label: string | ReactElement;
  onClick?: () => void;
}

interface IVariableSelectionProps {
  buttonLabel: string | ReactElement;
  icon?: ReactElement;
  menuItems: IMenuItemInfo[];
  showDropdown?: boolean;
}
export const LegendDropdown = observer(function LegendDropdown({
  buttonLabel, icon, menuItems, showDropdown
}: IVariableSelectionProps) {
  const readOnly = useContext(ReadOnlyContext);
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);
  const portalParentElt = buttonContainer?.closest('.document-content') as HTMLDivElement ?? null;
  const portalRef = useRef(portalParentElt);
  portalRef.current = portalParentElt;

  const labelClassNames = "graph-legend-label legend-dropdown-label";
  return (
    <div className="legend-dropdown">
      {icon && <div className="legend-icon">{icon}</div>}
      <Menu boundary="scrollParent">
        {({ isOpen }) => (
          <>
            <div ref={(e) => setButtonContainer(e)} className={labelClassNames}>
              <MenuButton className="legend-dropdown-button" disabled={readOnly}>
                <div className="button-content">
                  <div>{buttonLabel}</div>
                  {showDropdown &&
                    <div className={classNames("caret", { open: isOpen })}>
                      <DropdownCaretIcon />
                    </div>
                  }
                </div>
              </MenuButton>
            </div>
            <Portal containerRef={portalRef}>
              <MenuList>
                {
                  menuItems.map(menuItemInfo => {
                    return (
                      <MenuItem
                        key={menuItemInfo.key}
                        onClick={menuItemInfo.onClick}
                      >
                        {menuItemInfo.label}
                      </MenuItem>
                    );
                  })
                }
              </MenuList>
            </Portal>
          </>
        )}
      </Menu>
    </div>
  );
});
