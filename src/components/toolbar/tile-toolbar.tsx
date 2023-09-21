import { observer } from "mobx-react";
import React, { ReactElement, ReactNode } from "react";
import { useFloating, autoUpdate, FloatingPortal, flip } from "@floating-ui/react";
import { useSettingFromStores, useUIStore } from "../../hooks/use-stores";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { useTileToolbar } from "./use-tile-toolbar";
import classNames from "classnames";
import { Tooltip } from "react-tippy";
import { getToolbarButtonInfo } from "./toolbar-button-manager";
import { ITileModel } from "../../models/tiles/tile-model";
// import { useTileToolbar } from "./use-tile-toolbar";

interface ToolbarWrapperProps {
  id: string | undefined,
  tileType: string,
  tileElement: HTMLElement|null,
  defaultButtons: string[],
  model: ITileModel
}

export const TileToolbar = observer(
    function TileToolbar ({id, tileType, tileElement, defaultButtons, model }: ToolbarWrapperProps) {

  // Get styles to position the toolbar
  const { refs, toolbarStyles } = useTileToolbar(tileElement);

  // Determine the buttons to be shown
  const ui = useUIStore();
  const enabled = id && ui.selectedTileIds.length === 1 && ui.selectedTileIds.includes(id);
  const configuredButtonNames = useSettingFromStores("tools", tileType) as unknown as string[] | undefined;
  const buttonNames = configuredButtonNames || defaultButtons;

  const buttons = buttonNames.map((name) => {
    // return buttonMap[name];
    const info = getToolbarButtonInfo(tileType, name);
    if (info) {
      const Button = info?.component;
      return (
        <div key={name}>
          <Button model={model} />
        </div>);
    } else {
      console.warn('Did not find info for button name: ', name);
      return null;
    }
  });

  const Toolbar =
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={toolbarStyles}
        className={classNames("tile-toolbar", {"disabled": !enabled})}
      >
        {buttons}
      </div>
    </FloatingPortal>;

  return ( Toolbar );

});
