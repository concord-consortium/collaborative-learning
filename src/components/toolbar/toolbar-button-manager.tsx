import { ITileModel } from "../../models/tiles/tile-model";

export interface IToolbarButtonInfo {
  name: string,
  // label: string,
  component: React.ComponentType<IToolbarButtonProps>,
}

export interface IToolbarButtonProps {
  model: ITileModel
}

// export type IToolbarButtonComponent = ({info} : IToolbarButtonProps) => JSX.Element;

// Button info is looked up first by tile type, then button name.
const toolbarButtonInfos: Map<string,Map<string, IToolbarButtonInfo>> = new Map;

// Return the information for a given button
export function getToolbarButtonInfo(tile: string, buttonName: string) {
  return toolbarButtonInfos.get(tile)?.get(buttonName);
}

// Tiles call this to register their toolbar buttons.
// It can be called more than once if buttons are defined in different code locations.
// The actual buttons and their order is defined in the curriculum.
export function registerTileToolbarButtonInfos(
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
