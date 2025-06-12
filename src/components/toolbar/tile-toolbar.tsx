import React, { useContext, useState, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FloatingPortal } from "@floating-ui/react";
import { useSettingFromStores, useUIStore } from "../../hooks/use-stores";
import { useTileToolbarPositioning } from "./use-tile-toolbar-positioning";
import { getToolbarButtonInfo } from "./toolbar-button-manager";
import { TileModelContext } from "../tiles/tile-api";
import { JSONValue } from "../../models/stores/settings";
import { useCanvasMethodsContext } from "../document/canvas-methods-context";

const BUTTON_WIDTH = 36;
const BUTTON_BORDER_WIDTH = 1;
const SCROLLBAR_WIDTH = 25;

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
    const canvasMethods = useCanvasMethodsContext();
    const id = model?.id;

    // Get styles to position the toolbar
    const { toolbarRefs, toolbarStyles, toolbarPlacement, rootElement, hide } = useTileToolbarPositioning(tileElement);

    // How many buttons and dividers fit in the first row?
    const [itemsInFirstRow, setItemsInFirstRow] = useState<number | undefined>(undefined);

    const canvasWidth = canvasMethods?.getWidth?.() || 0;

    // Determine the buttons to be shown.
    const ui = useUIStore();
    const customizedButtons = useSettingFromStores("tools", tileType);
    const buttonDescriptions = useMemo(() => {
      if (customizedButtons && Array.isArray(customizedButtons)) {
        return customizedButtons;
      } else {
        console.warn('Invalid configuration for toolbar (should be an array): ', customizedButtons);
        return [];
      }
    }, [customizedButtons]);

    // Calculate what fits in the first row.
    useEffect(() => {
      if (!rootElement || !buttonDescriptions) {
        setItemsInFirstRow(undefined);
        return;
      }
      if (canvasWidth && buttonDescriptions.length > 0) {
        const availableWidth = canvasWidth - SCROLLBAR_WIDTH;
        let totalWidth = 0;
        let itemsThatFit = 0;
        for (let i = 0; i < buttonDescriptions.length; ++i) {
          const desc = buttonDescriptions[i];
          const itemWidth = (desc === '|' ? 0 : BUTTON_WIDTH) + BUTTON_BORDER_WIDTH;
          if (totalWidth + itemWidth > availableWidth) break;
          totalWidth += itemWidth;
          itemsThatFit++;
        }
        setItemsInFirstRow(itemsThatFit);
      } else {
        setItemsInFirstRow(undefined);
      }
    }, [rootElement, buttonDescriptions, canvasWidth]);

    if (!buttonDescriptions || buttonDescriptions.length === 0) {
      // No buttons, no toolbar
      return null;
    }

    // Determine if toolbar should be rendered or not.
    const enabled = !readOnly && id && ui.selectedTileIds.length === 1 && ui.selectedTileIds.includes(id);
    if (!enabled) return(null);

    // Split buttonDescriptions into rows
    const firstRowCount = itemsInFirstRow ?? buttonDescriptions.length;
    const firstRow = buttonDescriptions.slice(0, firstRowCount);
    const secondRow = buttonDescriptions.slice(firstRowCount);

    const renderButtons = (descriptions: JSONValue[], rowKey: string) =>
      descriptions.map((desc, i) => {
        if (isValidButtonDescription(desc)) {
          if (desc === '|') {
            return (<div key={`${rowKey}-${i}-divider`} className="divider"/>);
          }
          const buttonHasArg = !(typeof desc === 'string');
          const name = buttonHasArg ? desc[0] : desc;
          const info = getToolbarButtonInfo(tileType, name);
          if (info) {
            const Button = info?.component;
            if (buttonHasArg) {
              return (<Button key={`${rowKey}-${i}-${name}`} name={name} args={desc}/>);
            } else {
              return (<Button key={`${rowKey}-${i}-${name}`} name={name}/>);
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
          style={{ visibility: hide ? 'hidden' : 'visible', ...toolbarStyles}}
          className={classNames("tile-toolbar", "focusable",
            `${tileType}-toolbar`,
            toolbarPlacement,
            { "disabled": !enabled })}
        >
          <div className="toolbar-row">
            {renderButtons(firstRow, "row1")}
          </div>
          {secondRow.length > 0 && (
            <div className="toolbar-row">
              {renderButtons(secondRow, "row2")}
            </div>
          )}
        </div>
      </FloatingPortal>);
  });
