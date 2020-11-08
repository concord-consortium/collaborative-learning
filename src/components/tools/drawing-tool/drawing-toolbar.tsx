import classNames from "classnames";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { DrawingSettingsView } from "./drawing-settings-view";
import { DrawingStampSelection } from "./drawing-stamp-selection";
import {
  buttonClasses, DeleteButton, FillColorButton, StrokeColorButton, SvgToolModeButton
} from "./drawing-toolbar-buttons";
import { FillColorPalette } from "./fill-color-palette";
import { StrokeColorPalette } from "./stroke-color-palette";
import { useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useForceUpdate } from "../hooks/use-force-update";
import { useMobXOnChange } from "../hooks/use-mobx-on-change";
import { IRegisterToolApiProps } from "../tool-tile";
import {
  Color, colors, DrawingContentModelType, ToolbarModalButton, ToolbarSettings
} from "../../../models/tools/drawing/drawing-content";
import { ToolTileModelType } from "../../../models/tools/tool-tile";

export interface TextButtonData {
  color: string;
}

export interface PolygonButtonData {
  type: string;
  stroke?: string;
  fill?: string;
}

export interface LineButtonData {
  lineColor: Color;
}

interface IProps extends IRegisterToolApiProps {
  documentContent?: HTMLElement | null;
  toolTile?: HTMLElement | null;
  model: ToolTileModelType;
  onIsEnabled: () => boolean;
}
export const ToolbarView: React.FC<IProps> = (
              { documentContent, model, onIsEnabled, ...others }: IProps) => {
  const drawingContent = model.content as DrawingContentModelType;
  const {stamps, currentStamp} = drawingContent;
  const [showStrokeColorPalette, setShowStrokeColorPalette] = useState(false);
  const [showFillColorPalette, setShowFillColorPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStampSelection, setShowStampSelection] = useState(false);
  const isEnabled = onIsEnabled();
  const forceUpdate = useForceUpdate();
  const toolbarLocation = useFloatingToolbarLocation({
                            documentContent,
                            toolbarHeight: 29,
                            toolbarTopOffset: 2,
                            minToolContent: 22,
                            enabled: isEnabled,
                            ...others
                          });

  const modalButtonClasses = (type?: ToolbarModalButton) => {
    return buttonClasses({ selected: type && (drawingContent.selectedButton === type) });
  };

  const modalButtonProps = (type: ToolbarModalButton, settings?: Partial<ToolbarSettings>) => {
    const { selectedButton, toolbarSettings } = drawingContent;
    return { modalButton: type, selected: selectedButton === type, settings: settings || toolbarSettings };
  };

  const handleSetSelectedButton = (modalButton: ToolbarModalButton) => {
    drawingContent.setSelectedButton(modalButton);
    forceUpdate();
  };

  const handleToggleShowStrokeColorPalette = (show?: boolean) => {
    setShowStrokeColorPalette(state => show != null ? show : !state);
    setShowFillColorPalette(false);
  };

  const handleToggleShowFillColorPalette = (show?: boolean) => {
    setShowStrokeColorPalette(false);
    setShowFillColorPalette(state => show != null ? show : !state);
  };

  const handleStampListButton = () => {
    if (isEnabled) {
      setShowSettings(false);
      setShowStampSelection(state => !state);
    }
  };

  const handleSelectStamp = (stampIndex: number) => {
    if (isEnabled) {
      drawingContent.setSelectedStamp(stampIndex);
      drawingContent.setSelectedButton("stamp");
      setShowSettings(false);
      setShowStampSelection(false);
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

  const handleStrokeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    isEnabled && drawingContent.setStroke(e.target.value);
    forceUpdate();
  };
  const handleStrokeColorChange = (color: string) => {
    isEnabled && drawingContent.setStroke(color);
    setShowStrokeColorPalette(false);
  };
  const handleFillChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    isEnabled && drawingContent.setFill(e.target.value);
    forceUpdate();
  };
  const handleFillColorChange = (color: string) => {
    isEnabled && drawingContent.setFill(color);
    setShowFillColorPalette(false);
  };
  const handleStrokeDashArrayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    isEnabled && drawingContent.setStrokeDashArray(e.target.value);
    forceUpdate();
  };
  const handleStrokeWidthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    isEnabled && drawingContent.setStrokeWidth(+e.target.value);
    forceUpdate();
  };

  return documentContent
    ? ReactDOM.createPortal(
        <div className={classNames("drawing-tool-toolbar", { disabled: !isEnabled })} style={toolbarLocation}>
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
            {
              currentStamp &&
              <div
                className={"flyout-top-button " + modalButtonClasses("stamp")}
                style={{height: 30}} title="Stamp"
                onClick={() => handleSetSelectedButton("stamp")}>
                {
                  stamps.length > 1 &&
                  <div className="flyout-toggle" onClick={handleStampListButton}>
                    ▶
                  </div>
                }
                <img src={currentStamp.url} />
              </div>
            }
            <StrokeColorButton settings={drawingContent.toolbarSettings}
                  onClick={() => handleToggleShowStrokeColorPalette()} />
            <FillColorButton settings={drawingContent.toolbarSettings}
                  onClick={() => handleToggleShowFillColorPalette()} />
            <DeleteButton disabled={!drawingContent.hasSelectedObjects} onClick={handleDeleteButton} />
          </div>
          {showStrokeColorPalette
            ? <StrokeColorPalette selectedColor={drawingContent.stroke} onSelectColor={handleStrokeColorChange} />
            : null}
          {showFillColorPalette
            ? <FillColorPalette selectedColor={drawingContent.fill} onSelectColor={handleFillColorChange} />
            : null}
          {showSettings
            ? <DrawingSettingsView
                drawingContent={drawingContent}
                colors={colors}
                onStrokeChange={handleStrokeChange}
                onFillChange={handleFillChange}
                onStrokeDashArrayChange={handleStrokeDashArrayChange}
                onStrokeWidthChange={handleStrokeWidthChange} />
            : null}
          {showStampSelection
            ? <DrawingStampSelection
                drawingContent={drawingContent}
                onSelectStamp={handleSelectStamp} />
            : null}
        </div>, documentContent)
  : null;
};
