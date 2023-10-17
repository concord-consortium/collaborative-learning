import React, { useContext } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FloatingPortal } from "@floating-ui/react";
import { Tooltip } from "react-tippy";
import { useSettingFromStores, useUIStore } from "../../hooks/use-stores";
import { useTileToolbarPositioning } from "./use-tile-toolbar-positioning";
import { getToolbarButtonInfo, getDefaultTileToolbarConfig, IToolbarButtonInfo } from "./toolbar-button-manager";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { TileModelContext } from "../tiles/tile-api";
import { JSONValue } from "../../models/stores/settings";

interface ToolbarWrapperProps {
  tileType: string,
  readOnly: boolean,
  tileElement: HTMLElement | null,
}

type IButtonDescription = string | [string, string];
export function isValidButtonDescription(obj: JSONValue): obj is IButtonDescription {
  if (!obj) return false;
  if (typeof obj === 'string') return true;
  return (obj.constructor === Array
    && obj.length === 2
    && typeof obj[0] === 'string'
    && typeof obj[1] === 'string');
 }

function formatTooltip(desc: IButtonDescription, info: IToolbarButtonInfo) {
  let fullTitle = info.title;
  if (!(typeof desc === 'string')) {
    fullTitle = fullTitle.replaceAll(/\{([0-9]+)\}/g, (match) => {
      const i = Number(match[1]);
      if (typeof i === 'number' && i<desc.length) {
        return desc[i];
      } else {
        return match[0];
      }
    });
  }
  return fullTitle + (info.keyHint ? ` (${info.keyHint})` : '');
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
    const buttonConfiguration = useSettingFromStores("tools", tileType);
    if (buttonConfiguration?.constructor !== Array) {
      console.warn('Invalid configuration for toolbar (should be an array): ', buttonConfiguration);
      return(null);
    }

    const buttonDescriptions = buttonConfiguration ?? getDefaultTileToolbarConfig(tileType);

    // Determine if toolbar should be rendered or not.
    const enabled = !readOnly && id && ui.selectedTileIds.length === 1 && ui.selectedTileIds.includes(id);
    // TODO question: is it more efficient to short-circuit here, or render with a class to hide it?
    // Not rendering sounds faster, but if React is smart enough to just toggle the 'disabled' class attribute
    // when you click in the tile, that would be super responsive.
    if (!enabled) return(null);

    const buttons = buttonDescriptions.map((desc) => {
      if (isValidButtonDescription(desc)) {
        const buttonHasArg = !(typeof desc === 'string');
        const name = buttonHasArg ? desc[0] : desc;
        const info = getToolbarButtonInfo(tileType, name);
        if (info) {
          const Button = info?.component;
          const buttonElt = buttonHasArg ? <Button args={desc}/> : <Button/>;
          const tooltip = formatTooltip(desc, info);
          return (
            <Tooltip key={name} title={tooltip} {...tipOptions} >
              {buttonElt}
            </Tooltip>);
        } else {
          console.warn('Did not find info for button name: ', name);
          return null;
        }
      } else {
        console.warn('Invalid configuration for toolbar button: ', desc);
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
