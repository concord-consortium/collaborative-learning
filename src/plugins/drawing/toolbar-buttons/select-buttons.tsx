import React, {useContext} from "react";
import { observer } from "mobx-react";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import FillColorIcon from "../assets/color-fill-icon.svg";
import StrokeColorIcon from "../assets/color-stroke-icon.svg";
import { OpenPaletteValues } from "../model/drawing-content";
import { FillColorPalette } from "../components/fill-color-palette";
import { StrokeColorPalette } from "../components/stroke-color-palette";
import { ToolbarButtonSvg } from "./toolbar-button-svg";
import { isLightColorRequiringContrastOffset, kLightLuminanceContrastStroke } from "../../../utilities/color-utils";

export const FillColorButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isOpen = drawingModel?.openPallette === OpenPaletteValues.FillColor;

  function handleClick() {
    if (isOpen) {
      drawingModel.setOpenPalette(OpenPaletteValues.None);
    } else {
      drawingModel.setOpenPalette(OpenPaletteValues.FillColor);
    }
  }

  function handleColorChoice(color: string) {
    drawingModel.setFill(color, drawingModel.selection);
  }

  const stroke = isLightColorRequiringContrastOffset(drawingModel.fill)
    ? kLightLuminanceContrastStroke
    : drawingModel.fill;

  return (
    <TileToolbarButton
      name={name}
      title={"Fill Color"}
      onClick={handleClick}
    >
      <ToolbarButtonSvg
        SvgIcon={FillColorIcon}
        settings={{ fill: drawingModel.fill, stroke }}
      />
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
  const isOpen = drawingModel?.openPallette === OpenPaletteValues.StrokeColor;

  function handleClick() {
    if (isOpen) {
      drawingModel.setOpenPalette(OpenPaletteValues.None);
    } else {
      drawingModel.setOpenPalette(OpenPaletteValues.StrokeColor);
    }
  }

  function handleColorChoice(color: string) {
    drawingModel.setStroke(color, drawingModel.selection);
  }

  const stroke = isLightColorRequiringContrastOffset(drawingModel.stroke)
  ? kLightLuminanceContrastStroke : drawingModel.stroke;

  return (
    <TileToolbarButton
      name={name}
      title={"Stroke Color"}
      onClick={handleClick}
    >
      <ToolbarButtonSvg
        SvgIcon={StrokeColorIcon}
        settings={{ fill: drawingModel.stroke, stroke }}
      />
      {isOpen &&
        <StrokeColorPalette
          selectedColor={drawingModel.stroke}
          onSelectColor={handleColorChoice}
        />
      }
    </TileToolbarButton>
  );
});

