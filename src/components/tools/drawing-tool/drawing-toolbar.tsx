import classNames from "classnames";
import React, { useState } from "react";
import ReactDOM from "react-dom";
import { DrawingSettingsView } from "./drawing-settings-view";
import { DrawingStampSelection } from "./drawing-stamp-selection";
import { buttonClasses, ClassIconButton, SvgIconButton } from "./drawing-toolbar-buttons";
import { useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useForceUpdate } from "../hooks/use-force-update";
import { useMobXOnChange } from "../hooks/use-mobx-on-change";
import { IRegisterToolApiProps } from "../tool-tile";
import {
  Color, colors, DrawingContentModelType, ToolbarModalButton
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
  const {stroke, stamps, currentStamp} = drawingContent;
  const [showSettings, setShowSettings] = useState(false);
  const [showStampSelection, setShowStampSelection] = useState(false);
  const isEnabled = onIsEnabled();
  const forceUpdate = useForceUpdate();
  const toolbarLocation = useFloatingToolbarLocation({
                            documentContent,
                            toolbarHeight: 29,
                            toolbarTopOffset: 4,
                            minToolContent: 22,
                            enabled: isEnabled,
                            ...others
                          });

  const modalButtonClasses = (type?: ToolbarModalButton) => {
    return buttonClasses({ selected: type && (drawingContent.selectedButton === type) });
  };

  const modalButtonProps = (type: ToolbarModalButton) => {
    const { selectedButton, toolbarSettings } = drawingContent;
    return { modalButton: type, selected: selectedButton === type, settings: toolbarSettings };
  };

  const handleSetSelectedButton = (modalButton: ToolbarModalButton) => {
    drawingContent.setSelectedButton(modalButton);
    forceUpdate();
  };

  const handleSettingsButton = () => {
    setShowSettings(state => !state);
    setShowStampSelection(false);
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
  const handleFillChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    isEnabled && drawingContent.setFill(e.target.value);
    forceUpdate();
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
            <ClassIconButton title="Settings" iconClass="menu" onClick={handleSettingsButton} />
            <ClassIconButton {...modalButtonProps("select")} title="Select"
                              iconClass="mouse-pointer" onSetSelectedButton={handleSetSelectedButton} />
            <ClassIconButton {...modalButtonProps("line")} title="Freehand Tool"
                              iconClass="pencil" style={{color: stroke}}
                              onSetSelectedButton={handleSetSelectedButton} />
            <SvgIconButton {...modalButtonProps("vector")} title="Line Tool"
                              onSetSelectedButton={handleSetSelectedButton} />
            <SvgIconButton {...modalButtonProps("rectangle")} title="Rectangle Tool"
                              onSetSelectedButton={handleSetSelectedButton} />
            <SvgIconButton {...modalButtonProps("ellipse")} title="Ellipse Tool"
                              onSetSelectedButton={handleSetSelectedButton} />
            {
              currentStamp &&
              <div
                className={"flyout-top-button " + modalButtonClasses("stamp")}
                style={{height: 30}} title="Coin Stamp"
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
            <ClassIconButton disabled={!drawingContent.hasSelectedObjects}
                  title="Delete" iconClass="bin" onClick={handleDeleteButton} />
          </div>
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
