import React, { useContext } from "react";
import { observer } from "mobx-react";

import { TileToolbarButton } from "./tile-toolbar-button";
import { IToolbarButtonComponentProps } from "./toolbar-button-manager";
import { TileModelContext } from "../tiles/tile-api";
import { isNavigatableTileModel } from "../../models/tiles/navigatable-tile-model";

import HideNavigatorIcon from "../../assets/icons/hide-navigator-icon.svg";
import ShowNavigatorIcon from "../../assets/icons/show-navigator-icon.svg";

interface INavigatorButtonProps extends IToolbarButtonComponentProps {
  onChange?: (visible: boolean) => void;
}


/**
 * The NavigatorButton component provides toolbar button for adding or removing the Tile Navigator
 * to/from tiles that support it.
 * An "onChange" callback can be provided to take additional actions (eg, log an event) beyond just
 * setting the visibility of the navigator.
 */
export const NavigatorButton = observer(function NavigatorButton({ name, onChange }: INavigatorButtonProps) {
  const tileContentModel = useContext(TileModelContext)?.content;
  if (!isNavigatableTileModel(tileContentModel)) return null;

  const buttonTitle = tileContentModel?.isNavigatorVisible ? "Hide Navigator" : "Show Navigator";
  const ButtonIcon = tileContentModel?.isNavigatorVisible ? <HideNavigatorIcon/> : <ShowNavigatorIcon/>;

  const handleClick = () => {
    if (onChange) {
      onChange(!tileContentModel.isNavigatorVisible);
    }
    if (tileContentModel.isNavigatorVisible) {
      tileContentModel.hideNavigator();
    } else {
      tileContentModel.showNavigator();
    }
  };

  return (
    <TileToolbarButton name={name} onClick={handleClick} title={buttonTitle}>
      {ButtonIcon}
    </TileToolbarButton>
  );
});
