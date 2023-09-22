import { ITileModel } from "../../models/tiles/tile-model";

// The toolbar button manager registers all known buttons used on tile toolbars.
// Tiles and plugins can register buttons by specifying their basic attributes
// and the Component to render for the button.
// These buttons can make use of some basic information passed in to all buttons
// (eg, the tile model) or additional information provided through a Context in the tile.
// Each toolbar has a default set of buttons, but which buttons are actually rendered,
// and in what order, can be customized by the unit, lesson, and problem content configurations.

export interface IToolbarButtonInfo {
  name: string,  // a unique named used in configuration to identify the button
  title: string, // user-visible tooltip for the button
  keyHint?: string, // If provided, displayed to the user as the hotkey equivalent
  component: React.ComponentType<IToolbarButtonProps>, // component to render
}

export interface IToolbarButtonProps {
  /**
   * Properties that are provided to all toolbar buttons.
   */
  model: ITileModel
}

// This is the actual registry.
// Button info is looked up first by tile type, then button name.
const toolbarButtonInfos: Map<string,Map<string, IToolbarButtonInfo>> = new Map;

// Return the information for a given button
export function getToolbarButtonInfo(tile: string, buttonName: string) {
  return toolbarButtonInfos.get(tile)?.get(buttonName);
}

export function registerTileToolbarButtonInfos(
  /**
   * Register one or more buttons for a tile.
   * Generally called by tiles once when the application loads,
   * but this can also be called by plugins or other code that wants to contribute button defs.
   */
  tile: string,
  infos: IToolbarButtonInfo[]) {
    let tileButtons: Map<string, IToolbarButtonInfo>;
    const existingTileButtons = toolbarButtonInfos.get(tile);
    if (existingTileButtons) {
      tileButtons = existingTileButtons;
    } else {
      tileButtons = new Map;
      toolbarButtonInfos.set(tile, tileButtons);
    }
    infos.forEach((info) => {
      tileButtons.set(info.name, info);
    });
}
