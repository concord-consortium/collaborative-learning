import React, { useContext } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FloatingPortal } from "@floating-ui/react";
import { useSettingFromStores, useUIStore } from "../../hooks/use-stores";
import { useTileToolbarPositioning } from "./use-tile-toolbar-positioning";
import { getToolbarButtonInfo } from "./toolbar-button-manager";
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

/**
 * Generates a standard toolbar for a tile.
 * The buttons to be included are not specified here: all potential buttons must
 * be registered with the toolbar-button-manager and then can be selected and
 * ordered by AppConfig, unit or lesson configuration.
 */
export const TileToolbar = observer(
  function TileToolbar({ tileType, readOnly, tileElement }: ToolbarWrapperProps) {

    const model = useContext(TileModelContext);
    const id = model?.id;

    // Get styles to position the toolbar
    const { toolbarRefs, toolbarStyles, toolbarPlacement, rootElement, hide } = useTileToolbarPositioning(tileElement);

    // Determine the buttons to be shown.
    const ui = useUIStore();
    let buttonDescriptions: JSONValue[];
    const customizedButtons = useSettingFromStores("tools", tileType);
    if (customizedButtons) {
      if (Array.isArray(customizedButtons)) {
        buttonDescriptions = customizedButtons;
      } else {
        console.warn('Invalid configuration for toolbar (should be an array): ', customizedButtons);
        return (null);
      }
    } else {
      // No buttons, no toolbar
      return null;
    }

    // Determine if toolbar should be rendered or not.
    const enabled = !readOnly && id && ui.selectedTileIds.length === 1 && ui.selectedTileIds.includes(id);
    // TODO question: is it more efficient to short-circuit here, or render with a class to hide it?
    // Not rendering sounds faster, but if React is smart enough to just toggle the 'disabled' class attribute
    // when you click in the tile, that would be super responsive.
    if (!enabled) return(null);

    const buttons = buttonDescriptions.map((desc, i) => {
      if (isValidButtonDescription(desc)) {
        const buttonHasArg = !(typeof desc === 'string');
        const name = buttonHasArg ? desc[0] : desc;
        const info = getToolbarButtonInfo(tileType, name);
        if (info) {
          const Button = info?.component;
          if (buttonHasArg) {
            return (<Button key={`${i}-${name}`} name={name} args={desc}/>);
          } else {
            return (<Button key={`${i}-${name}`} name={name}/>);
          }
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
      <FloatingPortal root={rootElement}>
        <div
          ref={toolbarRefs.setFloating}
          data-testid="tile-toolbar"
          style={{visibility: hide ? 'hidden' : 'visible', ...toolbarStyles}}
          className={classNames("tile-toolbar",
            `${tileType}-toolbar`,
            toolbarPlacement,
            { "disabled": !enabled })}
        >
          {buttons}
        </div>
      </FloatingPortal>);
  });
