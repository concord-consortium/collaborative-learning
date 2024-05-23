import React, { useContext } from "react";
import { observer } from "mobx-react";
import { TileToolbarButton } from "../../../components/toolbar/tile-toolbar-button";
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { VectorTypePalette } from "../components/vector-palette";
import { DrawingContentModelContext } from "../components/drawing-content-context";
import { OpenPalletteValues } from "../model/drawing-content";

<<<<<<< HEAD
import LineIcon from "./../assets/line-icon.svg";
=======
import { ToolbarButtonSvg } from "./toolbar-button-svg";
import { ToolbarSettings, VectorType, getVectorTypeIcon } from "../model/drawing-basic-types";
>>>>>>> local-try-dynamic-svg-like-vector-palette

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

<<<<<<< HEAD
  return (
    <TileToolbarButton name={name} title={"Vector"} onClick={handleClick} selected={isSelected}>
      <LineIcon />
      { isOpen &&
        <VectorTypePalette
          selectedVectorType={drawingModel.toolbarSettings.vectorType}
          onSelectVectorType={() => console.log("onSelectVectorType")}
=======
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
>>>>>>> local-try-dynamic-svg-like-vector-palette
          settings={drawingModel.toolbarSettings}
        />
      }
    </TileToolbarButton>
  );
});
<<<<<<< HEAD

/**
 * OK - this should actually just be copied into the color switching ones
 * The vector can do it like this but only on the traingle button
 * This one has to handle the long click or whatever to do what its doing now
 * so implement the color ones like this and then come back to this one
 * On the color ones you will have to pass through the actual state changing buttons so, yeah not sure how that will work.
 * Oh no wait I'll instantiate the pallettes that already exist so it'll work
 */
=======
>>>>>>> local-try-dynamic-svg-like-vector-palette
