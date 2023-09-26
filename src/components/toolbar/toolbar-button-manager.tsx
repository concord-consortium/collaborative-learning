// The toolbar button manager registers all known buttons used on tile toolbars,
// and the configuration of buttons to use by default.
//
// Tiles and plugins can register buttons by specifying their basic attributes
// and the Component to render for the button.
// These buttons are rendered as part of the tile so they can make use information provided
// through Contexts.
// Each toolbar has a default set of buttons, but which buttons are actually rendered,
// and in what order, can be customized by the unit, lesson, and problem content configurations.

export interface IToolbarButtonInfo {
  name: string,  // a unique named used in configuration to identify the button
  title: string, // user-visible tooltip for the button
  component: React.ComponentType, // component to render
  keyHint?: string, // If set, displayed to the user as the hotkey equivalent
}

// This is the actual registry.
// Button info is looked up first by tile type, then button name.
const toolbarButtonInfos: Map<string,Map<string, IToolbarButtonInfo>> = new Map;

// Return the information for a given button
export function getToolbarButtonInfo(tileType: string, buttonName: string) {
  return toolbarButtonInfos.get(tileType)?.get(buttonName);
}

function prettyPrint(info: IToolbarButtonInfo|undefined) {
  return info ? `${info.name} (${info.title})` : '[undefined]';
}

export function registerTileToolbarButtons(
  /**
   * Register one or more buttons for a tile.
   * Generally called by tiles once when the application loads,
   * but this can also be called by plugins or other code that wants to contribute button defs.
   */
  tileType: string,
  infos: IToolbarButtonInfo[]) {
    let tileButtons: Map<string, IToolbarButtonInfo>;
    const existingTileButtons = toolbarButtonInfos.get(tileType);
    if (existingTileButtons) {
      tileButtons = existingTileButtons;
    } else {
      tileButtons = new Map;
      toolbarButtonInfos.set(tileType, tileButtons);
    }
    infos.forEach((info) => {
      if (tileButtons.has(info.name)) {
        console.warn('Adding button to ', tileType, ': overriding ',
          prettyPrint(tileButtons.get(info.name)), ' with ', prettyPrint(info));
      }
      tileButtons.set(info.name, info);
    });
}

// Keep list of default buttons for each tile type
const tileToolbarConfigs: Map<string,string[]> = new Map;

// Return the names of all the default buttons for this tile.
export function getDefaultTileToolbarConfig(tileType: string) {
  return tileToolbarConfigs.get(tileType) || [];
}

// Register default buttons
export function registerTileToolbarConfig(tileType: string, config: string[]) {
  if (tileToolbarConfigs.has(tileType)) {
    console.warn('Default button config for ', tileType, ' was already set, overriding with new value');
  }
  tileToolbarConfigs.set(tileType, config);
}
