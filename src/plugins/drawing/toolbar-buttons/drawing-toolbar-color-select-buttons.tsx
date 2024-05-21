import React from "react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import StrokeColorIcon from "../assets/color-stroke-icon.svg";
import FillColorIcon from "../assets/color-fill-icon.svg";

export function FillColorButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Fill Color";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  function handleTouchHold() {
    console.log("handleTouchHold: " + name);
  }

  return (
    <TileToolbarButton
      name={name} title={title}
      selected={selected}
      onClick={handleClick}
      onTouchHold={handleTouchHold}
    >
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

  function handleTouchHold() {
    console.log("handleTouchHold: " + name);
  }

  return (
    <TileToolbarButton
      name={name}
      title={title}
      selected={selected}
      onClick={handleClick}
      onTouchHold={handleTouchHold}
    >
      <StrokeColorIcon />
    </TileToolbarButton>
  );
}

