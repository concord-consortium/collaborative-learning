import React, { useContext } from "react";
import { observer } from "mobx-react";

import { TileToolbarButton } from "./tile-toolbar-button";
import { IToolbarButtonComponentProps } from "./toolbar-button-manager";

import HideNavigatorIcon from "../../assets/icons/hide-navigator-icon.svg";
import ShowNavigatorIcon from "../../assets/icons/show-navigator-icon.svg";
import { TileModelContext } from "../tiles/tile-api";

const isNavigatorSupported = (
  model: any
): model is { isNavigatorVisible: boolean; hideNavigator: () => void; showNavigator: () => void } => {
  return (
    model &&
    typeof model.isNavigatorVisible === "boolean" &&
    typeof model.hideNavigator === "function" &&
    typeof model.showNavigator === "function"
  );
};

export const NavigatorButton = observer(function NavigatorButton({ name }: IToolbarButtonComponentProps) {
  const tileContentModel = useContext(TileModelContext)?.content;
  if (!isNavigatorSupported(tileContentModel)) return null;

  const buttonTitle = tileContentModel?.isNavigatorVisible ? "Hide Navigator" : "Show Navigator";
  const ButtonIcon = tileContentModel?.isNavigatorVisible ? <HideNavigatorIcon/> : <ShowNavigatorIcon/>;

  const handleClick = () => {
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
