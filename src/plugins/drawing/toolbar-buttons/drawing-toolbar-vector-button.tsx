import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { VectorTypePalette } from "../components/vector-palette";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPalletteValues } from "../model/drawing-content";

import LineIcon from "./../assets/line-icon.svg";

export const VectorButton = observer(({ name }: IToolbarButtonComponentProps) => {
  const drawingModel = useContext(DrawingContentModelContext);
  const isSelected = drawingModel?.selectedButton === "vector";
  const isOpen = drawingModel?.openPallette === OpenPalletteValues.Vector;

  function handleClick() {
    drawingModel.setSelectedButton(OpenPalletteValues.Vector);
    toggleOpen();
  }

  function toggleOpen() {
    if (isOpen) {
      drawingModel.setOpenPallette(OpenPalletteValues.None);
    } else {
      drawingModel.setOpenPallette(OpenPalletteValues.Vector);
    }
  }

  return (
    <TileToolbarButton name={name} title={"Vector"} onClick={handleClick} selected={isSelected}>
      <LineIcon />
      { isOpen &&
        <VectorTypePalette
          selectedVectorType={drawingModel.toolbarSettings.vectorType}
          onSelectVectorType={() => console.log("onSelectVectorType")}
          settings={drawingModel.toolbarSettings}
        />
      }
    </TileToolbarButton>
  );
});

/**
 * OK - this should actually just be copied into the color switching ones
 * The vector can do it like this but only on the traingle button
 * This one has to handle the long click or whatever to do what its doing now
 * so implement the color ones like this and then come back to this one
 * On the color ones you will have to pass through the actual state changing buttons so, yeah not sure how that will work.
 * Oh no wait I'll instantiate the pallettes that already exist so it'll work
 */
