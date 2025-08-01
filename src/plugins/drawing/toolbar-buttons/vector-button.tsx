import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { VectorTypePalette } from "../components/vector-palette";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPaletteValues } from "../model/drawing-content";
import { ToolbarButtonSvg } from "./toolbar-button-svg";
import { ToolbarSettings, VectorType, getVectorTypeIcon } from "../model/drawing-basic-types";
import { useTouchHold } from "../../../hooks/use-touch-hold";
import SmallCornerTriangle from "../../../../src/assets/icons/small-corner-triangle.svg";

export const VectorButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isSelected = drawingModel?.selectedButton === "vector";
  const isOpen = drawingModel?.openPallette === OpenPaletteValues.Vector;
  const { onClick } = useTouchHold(toggleOpen, handleClick);

  function handleClick() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel.setSelectedButton("vector");
  }

  function handleTriangleClick(e: React.MouseEvent) {
    e.stopPropagation();
    toggleOpen();
  }

  function toggleOpen() {
    if (isOpen) {
      drawingModel.setOpenPalette(OpenPaletteValues.None);
    } else {
      drawingModel.setOpenPalette(OpenPaletteValues.Vector);
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

  const vectorIcon = getVectorTypeIcon(drawingModel.toolbarSettings.vectorType);

  const typesPalette = isOpen ?
    <VectorTypePalette
      selectedVectorType={drawingModel.toolbarSettings.vectorType}
      onSelectVectorType={handleVectorTypeChange}
      settings={settings}
    />
    : undefined;

  return (
    <TileToolbarButton
      name={name}
      title={"Vector"}
      selected={isSelected}
      onClick={onClick}
      onTouchHold={toggleOpen}
      extraContent={typesPalette}
    >
      <ToolbarButtonSvg SvgIcon={vectorIcon} settings={settings} />
      <SmallCornerTriangle
        onClick={handleTriangleClick}
        className="corner-triangle expand-collapse"
      />
    </TileToolbarButton>
  );
});
