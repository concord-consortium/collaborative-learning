import React, { useContext } from 'react';
import { observer } from 'mobx-react';

import { TileToolbarButton } from '../../../components/toolbar/tile-toolbar-button';
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from '../components/drawing-content-context';
import { useDrawingAreaContext } from '../components/drawing-area-context';

import ZoomInIcon from "../../../clue/assets/icons/zoom-in-icon.svg";
import ZoomOutIcon from "../../../clue/assets/icons/zoom-out-icon.svg";
import FitViewIcon from "../../../clue/assets/icons/fit-view-icon.svg";

const zoomStep = 0.1;
const minZoom = 0.1;
const maxZoom = 2;

export const ZoomInButton = observer(function ZoomInButton({ name }: IToolbarButtonComponentProps) {
  const drawingModel = useContext(DrawingContentModelContext);
  const disabled = drawingModel?.zoom >= maxZoom;
  const drawingAreaContext = useDrawingAreaContext();

  function handleClick() {
    const roundedZoom = Math.round((drawingModel.zoom + zoomStep) * 10) / 10;
    const canvasSize = drawingAreaContext?.getVisibleCanvasSize();
    drawingModel?.setZoom(Math.min(maxZoom, roundedZoom), canvasSize);
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
  const drawingAreaContext = useDrawingAreaContext();

  function handleClick() {
    const roundedZoom = Math.round((drawingModel.zoom - zoomStep) * 10) / 10;
    const canvasSize = drawingAreaContext?.getVisibleCanvasSize();
    drawingModel?.setZoom(Math.max(minZoom, roundedZoom), canvasSize);
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
      const contentWidth = bb.se.x - bb.nw.x;
      const contentHeight = bb.se.y - bb.nw.y;
      const optimalZoom = Math.min(
        (canvasSize.x - padding) / contentWidth,
        (canvasSize.y - padding) / contentHeight
      );
      const legalZoom = Math.max(minZoom, Math.min(maxZoom, optimalZoom));

      // Adjust the offset so the content is centered with the new zoom level.
      const newOffsetX = (canvasSize.x / 2 - (bb.nw.x + contentWidth / 2) * legalZoom);
      const newOffsetY = (canvasSize.y / 2 - (bb.nw.y + contentHeight / 2) * legalZoom);

      drawingModel.setZoom(legalZoom, canvasSize);
      drawingModel.setOffset(newOffsetX, newOffsetY);
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
