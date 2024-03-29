import classNames from "classnames";
import { observer } from "mobx-react-lite";
import React, { ReactElement, useRef, useState } from "react";
import { Menu, MenuItem, MenuList, MenuButton, Portal } from "@chakra-ui/react";

import { useReadOnlyContext } from "../../../../components/document/read-only-context";
import { kGraphPortalClass } from "../../graph-types";
import DropdownCaretIcon from "../../assets/dropdown-caret.svg";

import "./legend-dropdown.scss";

interface IMenuItemInfo {
  ariaLabel?: string;
  key: string;
  label: string | ReactElement;
  onClick?: () => void;
}

interface ILegendDropdownProps {
  buttonAriaLabel?: string;
  buttonContentClass?: string;
  buttonLabel: string | ReactElement;
  icon?: ReactElement;
  labelClass?: string;
  menuItems: IMenuItemInfo[];
  menuListClass?: string;
  showCaret?: boolean;
}
export const LegendDropdown = observer(function LegendDropdown({
  buttonAriaLabel, buttonContentClass, buttonLabel, icon, labelClass, menuItems, menuListClass, showCaret
}: ILegendDropdownProps) {
  const readOnly = useReadOnlyContext();
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);
  const portalParentElt = buttonContainer?.closest(kGraphPortalClass) as HTMLDivElement ?? null;
  const portalRef = useRef(portalParentElt);
  portalRef.current = portalParentElt;

  const labelClassNames = classNames("graph-legend-label legend-dropdown-label", labelClass);
  return (
    <div className="legend-dropdown">
      {icon && <div className="legend-icon">{icon}</div>}
      <Menu boundary="scrollParent">
        {({ isOpen }) => (
          <>
            <div ref={(e) => setButtonContainer(e)} className={labelClassNames}>
              <MenuButton aria-label={buttonAriaLabel} className="legend-dropdown-button" disabled={readOnly}>
                <div className={classNames("button-content", buttonContentClass)}>
                  <div className="button-label">{buttonLabel}</div>
                  {showCaret &&
                    <div className={classNames("caret", { open: isOpen })}>
                      <DropdownCaretIcon />
                    </div>
                  }
                </div>
              </MenuButton>
            </div>
            <Portal containerRef={portalRef}>
              <MenuList className={menuListClass}>
                {
                  menuItems.map(menuItemInfo => {
                    return (
                      <MenuItem
                        aria-label={menuItemInfo.ariaLabel}
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
