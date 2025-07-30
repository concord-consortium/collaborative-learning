import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPaletteValues } from "../model/drawing-content";
import { ToolbarButtonSvg } from "./toolbar-button-svg";
import { useTouchHold } from "../../../hooks/use-touch-hold";
import SmallCornerTriangle from "../../../../src/assets/icons/small-corner-triangle.svg";

// Import align icon - using center align as default
import { AlignTypePalette } from "../components/align-palette";
import { AlignType, getAlignTypeIcon } from "../model/drawing-basic-types";

export const AlignButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isSelected = drawingModel?.selectedButton === "align";
  const isOpen = drawingModel?.openPallette === OpenPaletteValues.Align;
  const enabled = drawingModel.selection.length > 1;

  const { onClick } = useTouchHold(toggleOpen, alignItems);

  function alignItems() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    console.log("Aligning items");

    drawingModel.alignObjects(drawingModel.selection, drawingModel.alignType);
  }

  function handleTriangleClick(e: React.MouseEvent) {
    e.stopPropagation();
    toggleOpen();
  }

  function toggleOpen() {
    if (isOpen) {
      drawingModel.setOpenPalette(OpenPaletteValues.None);
    } else {
      drawingModel.setOpenPalette(OpenPaletteValues.Align);
    }
  }

  function handleAlignTypeChange(alignType: AlignType) {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel.setSelectedAlignType(alignType);
  }

  const icon = getAlignTypeIcon(drawingModel.toolbarSettings.alignType);
  const typesPalette = isOpen ?
    <AlignTypePalette
      selectedAlignType={drawingModel.toolbarSettings.alignType}
      onSelectAlignType={handleAlignTypeChange}
      settings={drawingModel}
    />
    : undefined;

  return (
    <TileToolbarButton
      name={name}
      title={"Align"}
      selected={isSelected}
      onClick={onClick}
      onTouchHold={toggleOpen}
      disabled={!enabled}
      extraContent={typesPalette}
    >
      <ToolbarButtonSvg SvgIcon={icon} />
      <SmallCornerTriangle
        onClick={handleTriangleClick}
        className="corner-triangle expand-collapse"
      />
    </TileToolbarButton>
  );
});
