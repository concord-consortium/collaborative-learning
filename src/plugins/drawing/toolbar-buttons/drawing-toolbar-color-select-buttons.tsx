import React, {useContext} from "react";
import { observer } from "mobx-react";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import FillColorIcon from "../assets/color-fill-icon.svg";
import StrokeColorIcon from "../assets/color-stroke-icon.svg";
import { OpenPalletteValues } from "../model/drawing-content";
import { FillColorPalette } from "../components/fill-color-palette";
import { StrokeColorPalette } from "../components/stroke-color-palette";

export const FillColorButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isOpen = drawingModel?.openPallette === OpenPalletteValues.FillColor;

  function handleClick() {
    if (isOpen) {
      drawingModel.setOpenPallette(OpenPalletteValues.None);
    } else {
      drawingModel.setOpenPallette(OpenPalletteValues.FillColor);
    }
  }

  function handleTouchHold() {
    console.log("| handleTouchHold: " + name);
  }

  function handleColorChoice(color: string) {
    drawingModel.setFill(color, drawingModel.selection);
  }

  return (
    <TileToolbarButton
      name={name}
      title={"Fill Color"}
      onClick={handleClick}
      onTouchHold={handleTouchHold}
    >
      <FillColorIcon />
      {isOpen &&
        <FillColorPalette
          selectedColor={drawingModel.fill}
          onSelectColor={handleColorChoice}
        />
      }
    </TileToolbarButton>
  );
});

export const StrokeColorButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isOpen = drawingModel?.openPallette === OpenPalletteValues.StrokeColor;

  function handleClick() {
    if (isOpen) {
      drawingModel.setOpenPallette(OpenPalletteValues.None);
    } else {
      drawingModel.setOpenPallette(OpenPalletteValues.StrokeColor);
    }
  }

  function handleTouchHold() {
    console.log("| handleTouchHold: " + name);
  }

  function handleColorChoice(color: string) {
    drawingModel.setStroke(color, drawingModel.selection);
  }

  return (
    <TileToolbarButton
      name={name}
      title={"Stroke Color"}
      onClick={handleClick}
      onTouchHold={handleTouchHold}
    >
      <StrokeColorIcon />
      {isOpen &&
        <StrokeColorPalette
          selectedColor={drawingModel.stroke}
          onSelectColor={handleColorChoice}
        />
      }
    </TileToolbarButton>
  );
});

