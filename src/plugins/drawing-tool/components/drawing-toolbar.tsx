import classNames from "classnames";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import { FillColorButton, StrokeColorButton} from "./drawing-toolbar-buttons";
import { StampsPalette } from "./stamps-palette";
import { StrokeColorPalette } from "./stroke-color-palette";
import { FillColorPalette } from "./fill-color-palette";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../../components/tools/hooks/use-floating-toolbar-location";
import { ImageUploadButton } from "../../../components/tools/image/image-toolbar";
import { IRegisterToolApiProps } from "../../../components/tools/tool-tile";
import { DrawingContentModelType } from "../model//drawing-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { IPaletteState, IToolbarButtonProps, kClosedPalettesState, PaletteKey } from "../objects/drawing-object";
import { getDrawingToolButtonComponent } from "./drawing-object-manager";

interface IProps extends IFloatingToolbarProps, IRegisterToolApiProps {
  model: ToolTileModelType;
}

const defaultButtons = ["select", "line", "vector", "rectangle", "ellipse", 
  "stamp", "stroke-color", "fill-color", "delete"];

export const ToolbarView: React.FC<IProps> = (
              { documentContent, model, onIsEnabled, ...others }: IProps) => {
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
    isEnabled && drawingContent.setStroke(color, drawingContent.selectedIds);
    clearPaletteState();
  };
  const handleFillColorChange = (color: string) => {
    isEnabled && drawingContent.setFill(color, drawingContent.selectedIds);
    clearPaletteState();
  };

  const toolbarButtonProps: IToolbarButtonProps = {
    toolbarManager: drawingContent,
    togglePaletteState,
    clearPaletteState
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
            <ImageUploadButton onUploadImageFile={file => console.log(file)} tooltipOffset={{x: 0, y: 0}} />
          </div>
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
