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

  function handleClick() {
    const roundedZoom = Math.round((drawingModel.zoom + zoomStep) * 10) / 10;
    drawingModel?.setZoom(Math.min(maxZoom, roundedZoom));
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
    const roundedZoom = Math.round((drawingModel.zoom - zoomStep) * 10) / 10;
    drawingModel?.setZoom(Math.max(minZoom, roundedZoom));
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
      const optimalZoom = Math.min((canvasSize.x - padding) / contentWidth, (canvasSize.y - padding) / contentHeight);
      const legalZoom = Math.max(minZoom, Math.min(maxZoom, optimalZoom));
      const requiredOffsetX = Math.abs(bb.nw.x * legalZoom);
      const requiredOffsetY = Math.abs(bb.nw.y * legalZoom);

      drawingModel?.setZoom(legalZoom);
      drawingModel?.setOffset(requiredOffsetX, requiredOffsetY);
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
