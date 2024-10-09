import React, { useContext } from 'react';
import { observer } from 'mobx-react';

import { TileToolbarButton } from '../../../components/toolbar/tile-toolbar-button';
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from '../components/drawing-content-context';
import { useDrawingAreaContext } from '../components/drawing-area-context';

import ZoomInIcon from "../../../clue/assets/icons/zoom-in-icon.svg";
import ZoomOutIcon from "../../../clue/assets/icons/zoom-out-icon.svg";
import FitViewIcon from "../../../clue/assets/icons/fit-view-icon.svg";

const zoomFactor = 1.25;
const minZoom = 0.1;
const maxZoom = 2;

export const ZoomInButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);
  const disabled = drawingModel?.zoom >= maxZoom;

  function handleClick() {
    drawingModel?.setZoom(Math.min(maxZoom, drawingModel.zoom * zoomFactor));
  }

  return (
    <TileToolbarButton
      name={name}
      title={"Zoom In"}
      onClick={handleClick}
      disabled={disabled}
    >
      <ZoomInIcon/>
    </TileToolbarButton>
  );
});

export const ZoomOutButton = observer(function ZoomOutButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);
  const disabled = drawingModel?.zoom <= minZoom;

  function handleClick() {
    drawingModel?.setZoom(Math.max(minZoom, drawingModel.zoom / zoomFactor));
  }

  return (
    <TileToolbarButton
      name={name}
      title={"Zoom Out"}
      onClick={handleClick}
      disabled={disabled}
    >
      <ZoomOutIcon/>
    </TileToolbarButton>
  );
});

export const FitAllButton = observer(function FitAllButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);
  const drawingAreaContext = useDrawingAreaContext();
  const padding = 10;
  const disabled = !drawingModel.objects.length;

  function handleClick() {
    const canvasSize = drawingAreaContext?.getVisibleCanvasSize();
    if (canvasSize) {
      const bb = drawingModel.objectsBoundingBox;
      // Calculate the full width and height of the drawing content bounding box.
      const contentWidth = bb.se.x - bb.nw.x;
      const contentHeight = bb.se.y - bb.nw.y;
      // Find the optimal zoom level to fit the content inide the viewable area.
      const optimalZoom = Math.min((canvasSize.x - padding) / contentWidth, (canvasSize.y - padding) / contentHeight);
      const legalZoom = Math.max(minZoom, Math.min(maxZoom, optimalZoom));
      drawingModel?.setZoom(legalZoom);

      // Get the lowest x and y coordinates of all the objects and adjust the offset accordingly
      // If the lowest coordinate is negative, adjust the offset. Otherwise, set it to 0.
      const lowestYCoord = bb.nw.y;
      const lowestXCoord = bb.nw.x;
      const offsetX = drawingModel.offsetX;
      const offsetY = drawingModel.offsetY;
      const newOffsetX = lowestXCoord < 0 ? (offsetX - lowestXCoord) * legalZoom : 0;
      const newOffsetY = lowestYCoord < 0 ? (offsetY - lowestYCoord) * legalZoom : 0;
      drawingModel?.setOffset(newOffsetX, newOffsetY);
    }
  }

  return (
    <TileToolbarButton
      name={name}
      title={"Fit all"}
      onClick={handleClick}
      disabled={disabled}
    >
      <FitViewIcon/>
    </TileToolbarButton>
  );
});
