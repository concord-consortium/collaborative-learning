import React, { useCallback, useContext, useRef, useState, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FloatingPortal } from "@floating-ui/react";
import { useSettingFromStores, useUIStore } from "../../hooks/use-stores";
import { useTileToolbarPositioning } from "./use-tile-toolbar-positioning";
import { getToolbarButtonInfo } from "./toolbar-button-manager";
import { TileApiInterfaceContext, TileModelContext, RegisterToolbarContext } from "../tiles/tile-api";
import { JSONValue } from "../../models/stores/settings";
import { getTileContentInfo } from "../../models/tiles/tile-content-info";
import { useCanvasMethodsContext } from "../document/canvas-methods-context";
import { getPixelWidthFromCSSStyle } from "../../utilities/js-utils";
import { useRovingTabindex } from "../../hooks/use-roving-tabindex";
import styles from "../vars.scss";


const buttonWidth = getPixelWidthFromCSSStyle(styles.toolbarButtonWidth) || 1;
const buttonMargin = getPixelWidthFromCSSStyle(styles.toolbarButtonMargin) || 1;
const dividerWidth = getPixelWidthFromCSSStyle(styles.toolbarDividerWidth) || 1;

const SCROLLBAR_WIDTH = 25; // Not a CSS property, but an allowance to cover scrollbar and container borders

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
    const tileApiInterface = useContext(TileApiInterfaceContext);
    const registerToolbar = useContext(RegisterToolbarContext);
    const canvasMethods = useCanvasMethodsContext();
    const id = model?.id;

    // Keep tile API accessible in native event listeners via ref
    const tileApiInterfaceRef = useRef(tileApiInterface);
    tileApiInterfaceRef.current = tileApiInterface;

    // Get styles to position the toolbar
    const { toolbarRefs, toolbarStyles, toolbarPlacement, rootElement, hide } = useTileToolbarPositioning(tileElement);

    // Roving tabindex for keyboard navigation within toolbar
    const toolbarContainerRef = useRef<HTMLDivElement | null>(null);
    const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null);
    const { handleKeyDown: handleRovingKeyDown } = useRovingTabindex(toolbarContainerRef);

    // Combine floating ref with our container ref
    const setToolbarRef = useCallback((el: HTMLDivElement | null) => {
      toolbarRefs.setFloating(el);
      toolbarContainerRef.current = el;
      setToolbarContainer(el); // trigger re-render so useEffect picks up the element
    }, [toolbarRefs]);

    // Register toolbar element with tile-component via context callback
    useEffect(() => {
      if (toolbarContainer) {
        registerToolbar?.(toolbarContainer);
        return () => registerToolbar?.(null);
      }
    }, [toolbarContainer, registerToolbar]);

    // Handle Tab/Escape from toolbar for focus trap cycling.
    // Uses native DOM listener (capture phase) to intercept Tab before browser processes it.
    // NOTE: This focus routing must stay in sync with tile-component.tsx's handleTabKeyDown.
    // The toolbar is in a FloatingPortal outside the tile DOM, so it has its own Tab/Escape
    // handling that mirrors the tile's focus trap logic. Changes to one should be reviewed
    // against the other.
    useEffect(() => {
      const container = toolbarContainer;
      if (!container || !id) return;

      const handleTabEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (tileElement) {
            // Signal tile-component that escape was used to exit the focus trap.
            // Custom event is needed because FloatingPortal renders outside the tile DOM.
            tileElement.dispatchEvent(new CustomEvent('toolbar-escape', { bubbles: false }));
            tileElement.focus();
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }

        if (e.key === "Tab") {
          if (!tileElement) return;

          // Use tile API to get focusable elements (tile-type-agnostic)
          const tileApi = tileApiInterfaceRef.current?.getTileApi(id);
          const focusable = tileApi?.getFocusableElements?.();
          const contentElement = focusable?.contentElement;
          const titleElement = focusable?.titleElement;
          const focusContentFn = focusable?.focusContent;

          // Helper to focus content, preferring tile's custom focus method (e.g., Slate)
          const tryFocusContent = () => {
            if (focusContentFn?.()) return true;
            if (contentElement) {
              contentElement.focus();
              return document.activeElement === contentElement;
            }
            return false;
          };

          // Try candidates in order, skipping any that can't actually receive focus
          // (e.g., a plain div title element without tabindex).
          if (e.shiftKey) {
            // Shift+Tab: toolbar → title → content → tile
            if (titleElement) { titleElement.focus(); }
            if (document.activeElement !== titleElement) {
              if (!tryFocusContent()) { tileElement.focus(); }
            }
          } else {
            // Tab: toolbar → content → title → tile
            if (!tryFocusContent()) {
              if (titleElement) { titleElement.focus(); }
              if (document.activeElement !== titleElement) { tileElement.focus(); }
            }
          }
          e.preventDefault();
          e.stopPropagation();
        }
      };

      container.addEventListener("keydown", handleTabEscape, true); // capture phase
      return () => container.removeEventListener("keydown", handleTabEscape, true);
    }, [id, tileElement, toolbarContainer]);

    // Handle arrow keys via React event (roving tabindex)
    const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent) => {
      // ArrowUp from toolbar exits focus trap to tile container.
      // Must intercept before roving tabindex handles it as button navigation.
      if (e.key === "ArrowUp") {
        if (tileElement) {
          tileElement.focus();
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      // Only delegate arrow keys, Home/End to roving tabindex (Tab/Escape handled natively above)
      if (e.key !== "Tab" && e.key !== "Escape") {
        handleRovingKeyDown(e);
      }
    }, [handleRovingKeyDown, tileElement]);

    // How many buttons and dividers fit in the first row?
    const [itemsInFirstRow, setItemsInFirstRow] = useState<number | undefined>(undefined);

    const canvasWidth = canvasMethods?.getWidth?.() || 0;

    // Determine the buttons to be shown.
    const ui = useUIStore();
    const customizedButtons = useSettingFromStores("tools", tileType);
    const buttonDescriptions = useMemo(() => {
      if (customizedButtons) {
        if (Array.isArray(customizedButtons)) {
          return customizedButtons;
        } else {
          console.warn('Invalid configuration for toolbar (should be an array): ', customizedButtons);
          return undefined;
        }
      }
      return undefined;
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
          const itemWidth = (desc === '|' ? dividerWidth : buttonWidth) + buttonMargin;
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
          ref={setToolbarRef}
          data-testid="tile-toolbar"
          data-tile-id={id}
          role="toolbar"
          aria-label={`${getTileContentInfo(tileType)?.displayName || tileType} tile toolbar`}
          style={{ visibility: hide ? 'hidden' : 'visible', ...toolbarStyles}}
          onKeyDown={handleToolbarKeyDown}
          // "focusable" here so that useTileSelectionPointerEvents won't absorb toolbar clicks
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
