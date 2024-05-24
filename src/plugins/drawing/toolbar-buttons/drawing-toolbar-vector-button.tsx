import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { VectorTypePalette } from "../components/vector-palette";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPalletteValues } from "../model/drawing-content";

import { ToolbarButtonSvg } from "./toolbar-button-svg";
import { ToolbarSettings, VectorType, getVectorTypeIcon } from "../model/drawing-basic-types";

import SmallCornerTriangle from "../../../../src/assets/icons/small-corner-triangle.svg";

export const VectorButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isSelected = drawingModel?.selectedButton === "vector";
  const isOpen = drawingModel?.openPallette === OpenPalletteValues.Vector;

  function handleClick() {
    drawingModel.setSelectedButton(OpenPalletteValues.Vector);
  }

  function toggleOpen() {
    if (isOpen) {
      drawingModel.setOpenPallette(OpenPalletteValues.None);
    } else {
      drawingModel.setOpenPallette(OpenPalletteValues.Vector);
    }
  }

  function handleVectorTypeChange(vectorType: VectorType) {
    drawingModel.setVectorType(vectorType, drawingModel.selection);
    if (!drawingModel.hasSelectedObjects) {
      // If there are no selected objects, user probably wants to create one.
      drawingModel.setSelectedButton("vector");
    }
  }

  const settings: ToolbarSettings = {
    fill: drawingModel.stroke,
    stroke: drawingModel.stroke,
    strokeDashArray: drawingModel.strokeDashArray,
    strokeWidth: drawingModel.strokeWidth,
    vectorType: drawingModel.vectorType
  };

  const vectorIcon =  getVectorTypeIcon(drawingModel.toolbarSettings.vectorType);

  return (
    <TileToolbarButton name={name} title={"Vector"} onClick={handleClick} selected={isSelected}>
      <ToolbarButtonSvg SvgIcon={vectorIcon} settings={settings}/>
      { isOpen &&
        <VectorTypePalette
          selectedVectorType={drawingModel.toolbarSettings.vectorType}
          onSelectVectorType={handleVectorTypeChange}
          settings={drawingModel.toolbarSettings}
        />
      }
      <SmallCornerTriangle
        onClick={toggleOpen}
        className="corner-triangle"
      />
    </TileToolbarButton>
  );
});
