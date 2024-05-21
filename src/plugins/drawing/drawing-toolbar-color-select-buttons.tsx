import React from "react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import StrokeColorIcon from "./assets/color-stroke-icon.svg";
import FillColorIcon from "./assets/color-fill-icon.svg";

import "./drawing-toolbar.scss";


export function FillColorButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Fill Color";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <FillColorIcon />
    </TileToolbarButton>
  );
}

export function StrokeColorButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Stroke Color";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <StrokeColorIcon />
    </TileToolbarButton>
  );
}
