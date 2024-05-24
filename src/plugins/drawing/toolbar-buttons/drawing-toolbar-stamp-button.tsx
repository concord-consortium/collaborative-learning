import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from "../components/drawing-content-context";

import { OpenPalletteValues } from "../model/drawing-content";
import { StampsPalette } from "../components/stamps-palette";
import { gImageMap } from "../../../models/image-map";

import SmallCornerTriangle from "../../../../src/assets/icons/small-corner-triangle.svg";

export const StampButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isSelected = drawingModel?.selectedButton === "stamp";
  const isOpen = drawingModel?.openPallette === OpenPalletteValues.Stamp;
  const { stamps, currentStampIndex, currentStamp } = drawingModel;
  if (!currentStamp)  return null;

  const entry = gImageMap.getImageEntry(currentStamp.url);

  function handleClick() {
    drawingModel.setSelectedButton(OpenPalletteValues.Stamp);
  }

  function toggleOpen() {
    if (isOpen) {
      drawingModel.setOpenPallette(OpenPalletteValues.None);
    } else {
      drawingModel.setOpenPallette(OpenPalletteValues.Stamp);
    }
  }

  function handleSelectStamp(stampIndex: number){
    drawingModel.setSelectedStamp(stampIndex);
    drawingModel.setSelectedButton("stamp");
    drawingModel.setOpenPallette(OpenPalletteValues.None);
  }

  return (
    <TileToolbarButton name={name} title={"Stamp"} selected={isSelected} onClick={handleClick}>
      <img height={24} src={entry?.displayUrl} draggable="false" />
      <SmallCornerTriangle
        onClick={toggleOpen}
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


