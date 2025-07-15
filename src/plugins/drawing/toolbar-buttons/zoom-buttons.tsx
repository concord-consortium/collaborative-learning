import React, { useContext } from 'react';
import { observer } from 'mobx-react';

import { TileToolbarButton } from '../../../components/toolbar/tile-toolbar-button';
import { IToolbarButtonComponentProps } from "../../../components/toolbar/toolbar-button-manager";
import { DrawingContentModelContext } from '../components/drawing-content-context';
import { useDrawingAreaContext } from '../components/drawing-area-context';
import { calculateFitContent, maxZoom, minZoom, zoomStep } from "../model/drawing-utils";

import ZoomInIcon from "../../../clue/assets/icons/zoom-in-icon.svg";
import ZoomOutIcon from "../../../clue/assets/icons/zoom-out-icon.svg";
import FitViewIcon from "../../../clue/assets/icons/fit-view-icon.svg";

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
  const disabled = !drawingModel.objects.length;

  function handleClick() {
    const canvasSize = drawingAreaContext?.getVisibleCanvasSize();
    if (canvasSize) {
      const contentBoundingBox = drawingModel.objectsBoundingBox;
      const { offsetX, offsetY, zoom } = calculateFitContent({ canvasSize, contentBoundingBox });

      drawingModel.setZoom(zoom, canvasSize);
      drawingModel.setOffset(offsetX, offsetY);
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
