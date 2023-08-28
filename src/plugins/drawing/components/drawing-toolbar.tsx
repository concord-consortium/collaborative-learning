import classNames from "classnames";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import { FillColorButton, StrokeColorButton} from "./drawing-toolbar-buttons";
import { StampsPalette } from "./stamps-palette";
import { StrokeColorPalette } from "./stroke-color-palette";
import { FillColorPalette } from "./fill-color-palette";
import { VectorTypePalette } from "./vector-palette";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../../components/tiles/hooks/use-floating-toolbar-location";
import { ImageUploadButton } from "../../../components/tiles/image/image-toolbar";
import { IRegisterTileApiProps } from "../../../components/tiles/tile-component";
import { DrawingContentModelType } from "../model/drawing-content";
import { gImageMap } from "../../../models/image-map";
import { ITileModel } from "../../../models/tiles/tile-model";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { IPaletteState, IToolbarButtonProps, kClosedPalettesState, PaletteKey } from "../objects/drawing-object";
import { getDrawingToolButtonComponent } from "./drawing-object-manager";
import { Point, VectorType } from "../model/drawing-basic-types";

interface IProps extends IFloatingToolbarProps, IRegisterTileApiProps {
  model: ITileModel;
  getVisibleCanvasSize: () => Point|undefined;
  setImageUrlToAdd: (url: string) => void;
}

const defaultButtons = ["select", "line", "vector", "rectangle", "ellipse",
  "stamp", "stroke-color", "fill-color", "text", "image-upload", "group", "ungroup", "duplicate", "delete"];

export const ToolbarView: React.FC<IProps> = (
              { documentContent, model, onIsEnabled, setImageUrlToAdd, getVisibleCanvasSize, ...others }: IProps) => {
  const drawingContent = model.content as DrawingContentModelType;
  const toolbarButtonSetting = useSettingFromStores("tools", "drawing") as unknown as string[] | undefined;
  const toolbarButtons = toolbarButtonSetting || defaultButtons;
  const { stamps, currentStampIndex } = drawingContent;
  const stampCount = stamps.length;
  const [paletteState, setPaletteState] = useState<IPaletteState>(kClosedPalettesState);
  const clearPaletteState = () => {
    setPaletteState(kClosedPalettesState);
  };
  const togglePaletteState = useCallback((palette: PaletteKey, show?: boolean) => {
    setPaletteState(state => {
      const newState = { ...kClosedPalettesState };
      newState[palette] = show != null ? show : !state[palette];
      (stampCount <= 1) && (newState.showStamps = false);
      return newState;
    });
  }, [stampCount]);
  const isEnabled = onIsEnabled();
  const { flipPalettes, ...location } = useFloatingToolbarLocation({
                                          documentContent,
                                          toolbarHeight: 38,
                                          paletteHeight: 70,
                                          toolbarTopOffset: 2,
                                          enabled: isEnabled,
                                          ...others
                                        }) || {};

  const handleToggleShowStrokeColorPalette = (show?: boolean) => {
    togglePaletteState("showStroke", show);
  };

  const handleToggleShowFillColorPalette = (show?: boolean) => {
    togglePaletteState("showFill", show);
  };

  const handleSelectStamp = (stampIndex: number) => {
    if (isEnabled) {
      drawingContent.setSelectedStamp(stampIndex);
      drawingContent.setSelectedButton("stamp");
      clearPaletteState();
    }
  };

  const handleStrokeColorChange = (color: string) => {
    isEnabled && drawingContent.setStroke(color, drawingContent.selection);
    clearPaletteState();
  };
  const handleFillColorChange = (color: string) => {
    isEnabled && drawingContent.setFill(color, drawingContent.selection);
    clearPaletteState();
  };
  const handleVectorTypeChange = (type: VectorType) => {
    isEnabled && drawingContent.setVectorType(type, drawingContent.selection);
    drawingContent.setSelectedButton("vector");
    clearPaletteState();
  };

  const toolbarButtonProps: IToolbarButtonProps = {
    toolbarManager: drawingContent,
    getVisibleCanvasSize,
    togglePaletteState,
    clearPaletteState
  };

  const uploadImage = (file: File) => {
    gImageMap.addFileImage(file)
      .then(image => {
        setImageUrlToAdd(image.contentUrl || '');
      });
  };

  const getToolbarButton = (toolName: string) => {
    const ToolButton = getDrawingToolButtonComponent(toolName);
    if (ToolButton) {
      return <ToolButton key={toolName} {...toolbarButtonProps} />;
    }

    switch (toolName) {
      case "stroke-color":
        return <StrokeColorButton key="stroke" settings={drawingContent.toolbarSettings}
          onClick={() => handleToggleShowStrokeColorPalette()} />;
      case "fill-color":
        return <FillColorButton key="fill" settings={drawingContent.toolbarSettings}
          onClick={() => handleToggleShowFillColorPalette()} />;
      case "image-upload":
        return <ImageUploadButton
          key="upload-image"
          onUploadImageFile={file => uploadImage(file)}
          tooltipOffset={{x: 0, y: 0}}
          extraClasses="drawing-tool-button"
        />;
    }
  };

  const toolbarClasses = classNames("drawing-tool-toolbar", { disabled: !isEnabled, flip: flipPalettes });
  return documentContent
    ? ReactDOM.createPortal(
        <div className={toolbarClasses} style={location} data-testid="drawing-toolbar">
          <div className="drawing-tool-buttons">
            {toolbarButtons.map(button => {
              return getToolbarButton(button);
            })}
          </div>
          {paletteState.showVectors &&
            <VectorTypePalette selectedVectorType={drawingContent.toolbarSettings.vectorType} 
            onSelectVectorType={handleVectorTypeChange} settings={drawingContent.toolbarSettings} />}
          {paletteState.showStroke &&
            <StrokeColorPalette selectedColor={drawingContent.stroke} onSelectColor={handleStrokeColorChange} />}
          {paletteState.showFill &&
            <FillColorPalette selectedColor={drawingContent.fill} onSelectColor={handleFillColorChange} />}
          {paletteState.showStamps &&
            <StampsPalette stamps={stamps}
              selectedStampIndex={currentStampIndex}
              onSelectStampIndex={handleSelectStamp} />}
        </div>, documentContent)
  : null;
};
