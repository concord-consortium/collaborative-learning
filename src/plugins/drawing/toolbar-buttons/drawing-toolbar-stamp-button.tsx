import React, { useContext } from "react";
import { observer } from "mobx-react";
import { useTouchHold } from "../../../hooks/use-touch-hold";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPaletteValues } from "../model/drawing-content";
import { StampsPalette } from "../components/stamps-palette";
import { gImageMap } from "../../../models/image-map";
import SmallCornerTriangle from "../../../../src/assets/icons/small-corner-triangle.svg";

export const StampButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isSelected = drawingModel?.selectedButton === "stamp";
  const isOpen = drawingModel?.openPallette === OpenPaletteValues.Stamp;
  const { stamps, currentStampIndex, currentStamp } = drawingModel;
  const { onClick } = useTouchHold(toggleOpen, handleClick);
  if (!currentStamp)  return null;

  const entry = gImageMap.getImageEntry(currentStamp.url);

  function handleClick() {
    drawingModel.setOpenPalette(OpenPaletteValues.None);
    drawingModel.setSelectedButton(OpenPaletteValues.Stamp);
  }

  function handleTriangleClick(e: React.MouseEvent) {
    e.stopPropagation();
    toggleOpen();
  }

  function toggleOpen() {
    if (isOpen) {
      drawingModel.setOpenPalette(OpenPaletteValues.None);
    } else {
      drawingModel.setOpenPalette(OpenPaletteValues.Stamp);
    }
  }

  function handleSelectStamp(stampIndex: number){
    drawingModel.setSelectedStamp(stampIndex);
    drawingModel.setSelectedButton("stamp");
    drawingModel.setOpenPalette(OpenPaletteValues.None);
  }

  return (
    <TileToolbarButton
      name={name}
      title={"Stamp"}
      selected={isSelected}
      onClick={onClick}
      onTouchHold={toggleOpen}
    >
      <img height={24} src={entry?.displayUrl} draggable="false" />
      <SmallCornerTriangle
        onClick={handleTriangleClick}
        className="corner-triangle"
      />
      {isOpen &&
        <StampsPalette
          stamps={stamps}
          selectedStampIndex={currentStampIndex}
          onSelectStampIndex={handleSelectStamp}
        />
      }
    </TileToolbarButton>
  );
});
