import React, { useContext, useMemo } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FloatingPortal } from "@floating-ui/react";
import { Tooltip } from "react-tippy";
import { useSettingFromStores, useUIStore } from "../../hooks/use-stores";
import { useTileToolbarPositioning } from "./use-tile-toolbar-positioning";
import { getToolbarButtonInfo, getToolbarDefaultButtons } from "./toolbar-button-manager";
import { ITileModel } from "../../models/tiles/tile-model";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { TileModelContext } from "../tiles/tile-api";

interface ToolbarWrapperProps {
  tileType: string,
  readOnly: boolean,
  tileElement: HTMLElement | null,
}

export const TileToolbar = observer(
  function TileToolbar({ tileType, readOnly, tileElement }: ToolbarWrapperProps) {
    /**
     * Generates a standard toolbar for a tile.
     * The buttons to be included are not specified here:
     * all potential buttons must be registered with the toolbar-button-manager and
     * then can be selected and ordered by unit or lesson configuration.
     */

    const model = useContext(TileModelContext);
    const id = model?.id;

    // Get styles to position the toolbar
    const { toolbarRefs, toolbarStyles, toolbarPlacement } = useTileToolbarPositioning(tileElement);
    const tipOptions = useTooltipOptions();

    // Determine the buttons to be shown. Avoid recalculating defaults over and over.
    const ui = useUIStore();
    const configuredButtonNames = useSettingFromStores("tools", tileType) as unknown as string[] | undefined;
    const buttonNames = useMemo(() => {
      return configuredButtonNames ?? getToolbarDefaultButtons(tileType);
    }, [configuredButtonNames, tileType]);

    // Determine if toolbar should be rendered or not.
    const enabled = !readOnly && id && ui.selectedTileIds.length === 1 && ui.selectedTileIds.includes(id);
    // TODO question: is it more efficient to short-circuit here, or render with a class to hide it?
    // Not rendering sounds faster, but if React is smart enough to just toggle the 'disabled' class attribute
    // when you click in the tile, that would be super responsive.
    if (!enabled) return(null);

    const buttons = buttonNames.map((name) => {
      const info = getToolbarButtonInfo(tileType, name);
      if (info) {
        const Button = info?.component;
        const tooltip = info.title + (info.keyHint ? ` (${info.keyHint})` : '');
        return (
          <Tooltip key={name} title={tooltip} {...tipOptions} >
            <Button model={model} />
          </Tooltip>);
      } else {
        console.warn('Did not find info for button name: ', name);
        return null;
      }
    });

    return (
      <FloatingPortal>
        <div
          ref={toolbarRefs.setFloating}
          data-testid="tile-toolbar"
          style={toolbarStyles}
          className={classNames("tile-toolbar",
            `tile-toolbar-${tileType}`,
            toolbarPlacement,
            { "disabled": !enabled })}
        >
          {buttons}
        </div>
      </FloatingPortal>);
  });
