import React from "react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import EllipseIcon from "./../assets/ellipse-icon.svg";

export function StampButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Stamp";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <EllipseIcon />
    </TileToolbarButton>
  );
}


