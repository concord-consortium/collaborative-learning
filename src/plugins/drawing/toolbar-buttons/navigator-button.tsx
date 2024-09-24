import React, { useContext } from "react";
import { observer } from "mobx-react";

import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "../components/drawing-content-context";

import HideNavigatorIcon from "../../../assets/icons/hide-navigator-icon.svg";
import ShowNavigatorIcon from "../../../assets/icons/show-navigator-icon.svg";

export const NavigatorButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);
  const buttonTitle = drawingModel.isNavigatorVisible ? "Hide Navigator" : "Show Navigator";
  const ButtonIcon = drawingModel.isNavigatorVisible ? <HideNavigatorIcon/> : <ShowNavigatorIcon/>;

  function handleClick() {
    if (drawingModel.isNavigatorVisible ) {
      drawingModel.hideNavigator();
    } else {
      drawingModel.showNavigator();
    }
  }

  return (
    <TileToolbarButton name={name} onClick={handleClick} title={buttonTitle}>
      {ButtonIcon}
    </TileToolbarButton>
  );
});
