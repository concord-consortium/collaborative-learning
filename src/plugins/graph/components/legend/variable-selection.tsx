import { observer } from "mobx-react-lite";
import React, { useRef, useState } from "react";
import { Menu, MenuItem, MenuList, MenuButton, Portal } from "@chakra-ui/react";
import { VariableType } from "@concord-consortium/diagram-view";

import { kGraphClassSelector } from "../../graph-types";

import "./variable-selection.scss";

interface IVariableSelectionProps {
  buttonLabel: string;
  label: string;
  onSelect: (id: string) => void;
  variables: VariableType[];
}
export const VariableSelection = observer(function VariableSelection({
  buttonLabel, label, onSelect, variables
}: IVariableSelectionProps) {
  const menuListRef = useRef<HTMLDivElement>(null);
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);
  const positioningParentElt = buttonContainer?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
  const parentRef = useRef(positioningParentElt);
  parentRef.current = positioningParentElt;
  const portalParentElt = buttonContainer?.closest('.document-content') as HTMLDivElement ?? null;
  const portalRef = useRef(portalParentElt);
  portalRef.current = portalParentElt;
  const labelClassNames = "graph-legend-label variable-label";
  return (
    <>
      <div>{label}</div>
      <Menu boundary="scrollParent">
        <div ref={(e) => setButtonContainer(e)} className={labelClassNames}>
          <MenuButton className="variable-function-legend-button">
            {buttonLabel}
          </MenuButton>
        </div>
        <Portal containerRef={portalRef}>
          <MenuList ref={menuListRef}>
            {
              variables.map(variable => {
                return (
                  <MenuItem
                    key={variable.id}
                    onClick={() => onSelect(variable.id)}
                  >
                    {variable.name || "<unnamed variable>"}
                  </MenuItem>
                );
              })
            }
          </MenuList>
        </Portal>
      </Menu>
    </>
  );
});
