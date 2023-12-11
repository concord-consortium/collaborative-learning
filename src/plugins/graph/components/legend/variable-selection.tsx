import { observer } from "mobx-react-lite";
import React, { ReactElement, useRef, useState } from "react";
import { Menu, MenuItem, MenuList, MenuButton, Portal } from "@chakra-ui/react";
import { VariableType } from "@concord-consortium/diagram-view";


import "./variable-selection.scss";

function variableDisplay(variable: VariableType) {
  const namePart = variable.name || "<no name>";
  const unitPart = variable.computedUnit ? ` (${variable.computedUnit})` : "";
  return `${namePart}${unitPart}`;
}

interface IVariableSelectionProps {
  alternateButtonLabel: string;
  icon: ReactElement;
  onSelect: (id: string) => void;
  selectedVariable?: VariableType;
  variables: VariableType[];
}
export const VariableSelection = observer(function VariableSelection({
  alternateButtonLabel, icon, onSelect, selectedVariable, variables
}: IVariableSelectionProps) {
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);
  const portalParentElt = buttonContainer?.closest('.document-content') as HTMLDivElement ?? null;
  const portalRef = useRef(portalParentElt);
  portalRef.current = portalParentElt;

  const labelClassNames = "graph-legend-label variable-label";
  const buttonLabel = selectedVariable ? variableDisplay(selectedVariable) : alternateButtonLabel;
  return (
    <div className="variable-selection">
      <div className="variable-icon">{icon}</div>
      <Menu boundary="scrollParent">
        <div ref={(e) => setButtonContainer(e)} className={labelClassNames}>
          <MenuButton className="variable-function-legend-button">
            {buttonLabel}
          </MenuButton>
        </div>
        <Portal containerRef={portalRef}>
          <MenuList>
            {
              variables.map(variable => {
                return (
                  <MenuItem
                    key={variable.id}
                    onClick={() => onSelect(variable.id)}
                  >
                    {variableDisplay(variable)}
                  </MenuItem>
                );
              })
            }
          </MenuList>
        </Portal>
      </Menu>
    </div>
  );
});
