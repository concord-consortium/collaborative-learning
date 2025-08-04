import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPaletteValues } from "../model/drawing-content";
import { ToolbarButtonSvg } from "./toolbar-button-svg";
import { useTouchHold } from "../../../hooks/use-touch-hold";
import SmallCornerTriangle from "../../../../src/assets/icons/small-corner-triangle.svg";
import { AlignTypePalette } from "../components/align-palette";
import { AlignType } from "../model/drawing-basic-types";
import { getAlignTypeIcon, getAlignTypeTooltip } from "../model/drawing-icons";

export const AlignButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isOpen = drawingModel?.openPallette === OpenPaletteValues.Align;
  const enabled = drawingModel.selection.length > 1;

  const { onClick } = useTouchHold(toggleOpen, alignItems);

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

  function alignItems() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel.alignObjects(drawingModel.selection, drawingModel.alignType);
  }

  function handleAlignTypeChange(alignType: AlignType) {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel.setSelectedAlignType(alignType);
  }

  const icon = getAlignTypeIcon(drawingModel.alignType);
  const tooltip = getAlignTypeTooltip(drawingModel.alignType);

  const typesPalette = isOpen ?
    <AlignTypePalette
      selectedAlignType={drawingModel.alignType}
      onSelectAlignType={handleAlignTypeChange}
      settings={drawingModel}
    />
    : undefined;

  return (
    <TileToolbarButton
      name={name}
      title={tooltip}
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
