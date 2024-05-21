import React from "react";
import { TileToolbarButton } from "../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../components/toolbar/toolbar-button-manager";
import LineIcon from "./assets/line-icon.svg";

import "./drawing-toolbar.scss";

export function VectorButton({ name }: IToolbarButtonComponentProps) {
  const selected = false;
  const title = "Vector";

  function handleClick() {
    console.log("handleClick: " + name);
  }

  return (
    <TileToolbarButton name={name} title={title} selected={selected} onClick={handleClick}>
      <LineIcon />
    </TileToolbarButton>
  );
}
