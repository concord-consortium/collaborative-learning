import classNames from "classnames";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import {
  DeleteButton, FillColorButton, StampModeButton, StrokeColorButton, SvgToolModeButton
} from "./drawing-toolbar-buttons";
import { StampsPalette } from "./stamps-palette";
import { StrokeColorPalette } from "./stroke-color-palette";
import { FillColorPalette } from "./fill-color-palette";
import { useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useForceUpdate } from "../hooks/use-force-update";
import { useMobXOnChange } from "../hooks/use-mobx-on-change";
import { IRegisterToolApiProps } from "../tool-tile";
import {
  DrawingContentModelType, ToolbarModalButton, ToolbarSettings
} from "../../../models/tools/drawing/drawing-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";

interface IPaletteState {
  showStamps: boolean;
  showStroke: boolean;
  showFill: boolean;
}
type PaletteKey = keyof IPaletteState;
const kClosedPalettesState = { showStamps: false, showStroke: false, showFill: false };

interface IProps extends IRegisterToolApiProps {
  documentContent?: HTMLElement | null;
  toolTile?: HTMLElement | null;
  model: ToolTileModelType;
  onIsEnabled: () => boolean;
}
export const ToolbarView: React.FC<IProps> = (
              { documentContent, model, onIsEnabled, ...others }: IProps) => {
  const drawingContent = model.content as DrawingContentModelType;
  const { stamps, currentStamp, currentStampIndex } = drawingContent;
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
  const forceUpdate = useForceUpdate();
  const { flipPalettes, ...location } = useFloatingToolbarLocation({
                                          documentContent,
                                          toolbarHeight: 38,
                                          paletteHeight: 70,
                                          toolbarTopOffset: 2,
                                          enabled: isEnabled,
                                          ...others
                                        }) || {};

  const modalButtonProps = (type: ToolbarModalButton, settings?: Partial<ToolbarSettings>) => {
    const { selectedButton, toolbarSettings } = drawingContent;
    return { modalButton: type, selected: selectedButton === type, settings: settings || toolbarSettings };
  };

  const handleSetSelectedButton = (modalButton: ToolbarModalButton) => {
    drawingContent.setSelectedButton(modalButton);
    forceUpdate();
  };

  const handleToggleShowStrokeColorPalette = (show?: boolean) => {
    togglePaletteState("showStroke", show);
  };

  const handleToggleShowFillColorPalette = (show?: boolean) => {
    togglePaletteState("showFill", show);
  };

  const handleStampsButtonClick = useCallback(() => {
    drawingContent.setSelectedButton("stamp");
    togglePaletteState("showStamps", false);
    forceUpdate();
  }, [drawingContent, forceUpdate, togglePaletteState]);

  const handleStampsButtonTouchHold = useCallback(() => {
    drawingContent.setSelectedButton("stamp");
    togglePaletteState("showStamps");
    forceUpdate();
  }, [drawingContent, forceUpdate, togglePaletteState]);

  const handleSelectStamp = (stampIndex: number) => {
    if (isEnabled) {
      drawingContent.setSelectedStamp(stampIndex);
      drawingContent.setSelectedButton("stamp");
      clearPaletteState();
    }
  };

  // update toolbar when object selection changes
  useMobXOnChange(
    () => drawingContent.hasSelectedObjects,
    () => forceUpdate()
  );

  const handleDeleteButton = () => {
    drawingContent.deleteSelectedObjects();
  };

  const handleStrokeColorChange = (color: string) => {
    isEnabled && drawingContent.setStroke(color);
    clearPaletteState();
  };
  const handleFillColorChange = (color: string) => {
    isEnabled && drawingContent.setFill(color);
    clearPaletteState();
  };

  const toolbarClasses = classNames("drawing-tool-toolbar", { disabled: !isEnabled, flip: flipPalettes });
  return documentContent
    ? ReactDOM.createPortal(
        <div className={toolbarClasses} style={location}>
          <div className="drawing-tool-buttons">
            <SvgToolModeButton {...modalButtonProps("select", {})}
                                title="Select" onSetSelectedButton={handleSetSelectedButton} />
            <SvgToolModeButton {...modalButtonProps("line", { fill: drawingContent.stroke })}
                                title="Freehand" onSetSelectedButton={handleSetSelectedButton} />
            <SvgToolModeButton {...modalButtonProps("vector")}
                                title="Line" onSetSelectedButton={handleSetSelectedButton} />
            <SvgToolModeButton {...modalButtonProps("rectangle")} title="Rectangle"
                                onSetSelectedButton={handleSetSelectedButton} />
            <SvgToolModeButton {...modalButtonProps("ellipse")} title="Ellipse"
                                onSetSelectedButton={handleSetSelectedButton} />
            {currentStamp &&
              <StampModeButton stamp={currentStamp} stampCount={stampCount} title="Stamp"
                                selected={drawingContent.isSelectedButton("stamp")}
                                onClick={handleStampsButtonClick} onTouchHold={handleStampsButtonTouchHold} />}
            <StrokeColorButton settings={drawingContent.toolbarSettings}
                  onClick={() => handleToggleShowStrokeColorPalette()} />
            <FillColorButton settings={drawingContent.toolbarSettings}
                  onClick={() => handleToggleShowFillColorPalette()} />
            <DeleteButton disabled={!drawingContent.hasSelectedObjects} onClick={handleDeleteButton} />
          </div>
          {paletteState.showStroke
            ? <StrokeColorPalette selectedColor={drawingContent.stroke} onSelectColor={handleStrokeColorChange} />
            : null}
          {paletteState.showFill
            ? <FillColorPalette selectedColor={drawingContent.fill} onSelectColor={handleFillColorChange} />
            : null}
          {paletteState.showStamps
            ? <StampsPalette
                stamps={stamps}
                selectedStampIndex={currentStampIndex}
                onSelectStampIndex={handleSelectStamp} />
            : null}
        </div>, documentContent)
  : null;
};
