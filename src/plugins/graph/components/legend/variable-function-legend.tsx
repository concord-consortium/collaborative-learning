import React, { useRef, useState } from "react";
import { Menu, MenuItem, MenuList, MenuButton, Portal } from "@chakra-ui/react";
import { observer } from "mobx-react";
import { kGraphClassSelector } from "../../graph-types";
import { IPlottedFunctionAdornmentModel } from "../../adornments/plotted-function/plotted-function-adornment-model";

import "./variable-function-label.scss";

interface IVariableFunctionLegendProps {
  plottedFunctionAdornment: IPlottedFunctionAdornmentModel;
}

/**
 * XY Plot legend component that will control variables-based adornment.
 * Just a stub for now.
 *
 * TODO: The presence of the Adornment should actually be used to control showing the legend.
 */
export const VariableFunctionLegend = observer(function(
  { plottedFunctionAdornment }: IVariableFunctionLegendProps
) {
  const menuListRef = useRef<HTMLDivElement>(null);
  const sharedVars = plottedFunctionAdornment.sharedVariables;
  const [labelElt, setLabelElt] = useState<HTMLDivElement | null>(null);
  const positioningParentElt = labelElt?.closest(kGraphClassSelector) as HTMLDivElement ?? null;
  const parentRef = useRef(positioningParentElt);
  parentRef.current = positioningParentElt;
  const portalParentElt = labelElt?.closest('.document-content') as HTMLDivElement ?? null;
  const portalRef = useRef(portalParentElt);
  portalRef.current = portalParentElt;

  const labelClassNames = "graph-legend-label variable-label";
  if (sharedVars) {
    return (
      <>
        <div className="legend-title-row">
          <div className="legend-title">
            Variables from: <strong>{sharedVars.label}</strong>
          </div>
        </div>
        <div className="variable-row">
          <div>Y:</div>
          <Menu boundary="scrollParent">
            <div ref={(e) => setLabelElt(e)} className={labelClassNames}>
              <MenuButton className="variable-function-legend-button">
                {plottedFunctionAdornment?.yVariableName ?? "Y"}
              </MenuButton>
            </div>
            <Portal containerRef={portalRef}>
              <MenuList ref={menuListRef}>
                {
                  sharedVars.variables.map(variable => {
                    return (
                      <MenuItem key={variable.id}>
                        {variable.name}
                      </MenuItem>
                    );
                  })
                }
              </MenuList>
            </Portal>
          </Menu>
        </div>
      </>
    );
  } else {
    return null;
  }

});
