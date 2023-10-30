/**
 * @file The toolbar button manager registers buttons for tile toolbars.
 *
 * Tiles and plugins register their known buttons by specifying a name and a
 * component to render for each. These buttons are rendered as part of the tile
 * so they can make use of information provided through Contexts. Each tile
 * toolbar will render some or all of these buttons, as determined by the
 * AppConfig and any applicable unit, lesson, and problem content
 * configurations.
*/

export interface IToolbarButtonComponentProps {
  name: string;
  args?: string[];
}

export interface IToolbarButtonInfo {
  name: string,  // a unique named used in configuration to identify the button
  component: React.ComponentType<IToolbarButtonComponentProps>, // component to render
}

// This is the actual registry.
// Button info is looked up first by tile type, then button name.
const toolbarButtonInfos: Map<string,Map<string, IToolbarButtonInfo>> = new Map;

/**
 * Look up a toolbar button by name and tile type.
 * @param tileType
 * @param buttonName
 * @returns {IToolbarButtonInfo} the name and Component for the button
 */
//
export function getToolbarButtonInfo(tileType: string, buttonName: string) {
  return toolbarButtonInfos.get(tileType)?.get(buttonName);
}

/**
 * Register one or more buttons for a tile.
 * Generally called by tiles once when the application loads,
 * but this can also be called by plugins or other code that wants to contribute button defs.
 */
export function registerTileToolbarButtons(
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
        console.warn('Adding button ', info.name, ' to ', tileType, 'overrides previous definition');
      }
      tileButtons.set(info.name, info);
    });
}

