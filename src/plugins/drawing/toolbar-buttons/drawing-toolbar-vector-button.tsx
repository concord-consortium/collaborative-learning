import React, { useContext } from "react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { VectorTypePalette } from "../components/vector-palette";
import LineIcon from "./../assets/line-icon.svg";

import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPalletteValues } from "../model/drawing-content";

export function VectorButton({ name }: IToolbarButtonComponentProps) {
  console.log("| render Vector button!");
  const drawingModel = useContext(DrawingContentModelContext);
  const selected = drawingModel?.selectedButton === "vector"; // TODO is there an enum somewhere for this string

  function handleClick() {
    console.log("| VectorButton handleClick just before handle openPallette: ", drawingModel.openPallette);
    drawingModel.setOpenPallette(OpenPalletteValues.Vector);
    console.log("| VectorButton handleClick just after handle openPallette: ", drawingModel.openPallette);
  }

  return (
    <TileToolbarButton name={name} title={"Vector"} onClick={handleClick} selected={selected}>
      <LineIcon />
      { drawingModel.openPallette === OpenPalletteValues.Vector &&
        <VectorTypePalette
          selectedVectorType={drawingModel.toolbarSettings.vectorType}
          onSelectVectorType={() => console.log("onSelectVectorType")}
          settings={drawingModel.toolbarSettings}
        />
      }
    </TileToolbarButton>
  );
}
