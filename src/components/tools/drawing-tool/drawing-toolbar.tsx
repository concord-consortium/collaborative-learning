import classNames from "classnames";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import {
  DeleteButton, FillColorButton, StampModeButton, StrokeColorButton, SvgToolModeButton,
} from "./drawing-toolbar-buttons";
import { StampsPalette } from "./stamps-palette";
import { StrokeColorPalette } from "./stroke-color-palette";
import { FillColorPalette } from "./fill-color-palette";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useForceUpdate } from "../hooks/use-force-update";
import { useMobXOnChange } from "../hooks/use-mobx-on-change";
import { IRegisterToolApiProps } from "../tool-tile";
import { DrawingContentModelType } from "../../../models/tools/drawing/drawing-content";
import { ToolbarModalButton, ToolbarSettings } from "../../../models/tools/drawing/drawing-types";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { useVariableDialog } from "../../../plugins/shared-variables/drawing/use-variable-dialog";

interface IPaletteState {
  showStamps: boolean;
  showStroke: boolean;
  showFill: boolean;
}
type PaletteKey = keyof IPaletteState;
const kClosedPalettesState = { showStamps: false, showStroke: false, showFill: false };

interface IProps extends IFloatingToolbarProps, IRegisterToolApiProps {
  model: ToolTileModelType;
}

const defaultButtons = ["select", "line", "vector", "rectangle", "ellipse", "delete"];

export const ToolbarView: React.FC<IProps> = (
              { documentContent, model, onIsEnabled, ...others }: IProps) => {
  const drawingContent = model.content as DrawingContentModelType;
  const toolbarButtonSetting = useSettingFromStores("tools", "drawing") as unknown as string[] | undefined;
  const toolbarButtons = toolbarButtonSetting || defaultButtons;
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

  const [showVariableDialog] = useVariableDialog({ drawingContent });

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

  const handleShowVariableDialog = (modalButton: ToolbarModalButton) => {
    drawingContent.setSelectedButton(modalButton);
    forceUpdate();
    showVariableDialog();
  };

  const handleStrokeColorChange = (color: string) => {
    isEnabled && drawingContent.setStroke(color);
    clearPaletteState();
  };
  const handleFillColorChange = (color: string) => {
    isEnabled && drawingContent.setFill(color);
    clearPaletteState();
  };

  const buttonDefs: Record<string, React.ReactNode> = {
    "select": <SvgToolModeButton key="select" {...modalButtonProps("select", {})}
                                  title="Select" onSetSelectedButton={handleSetSelectedButton} />,
    "line": <SvgToolModeButton key="line" {...modalButtonProps("line", { fill: drawingContent.stroke })}
                                  title="Freehand" onSetSelectedButton={handleSetSelectedButton} />,
    "vector": <SvgToolModeButton key="vector" {...modalButtonProps("vector")}
                                    title="Line" onSetSelectedButton={handleSetSelectedButton} />,
    "rectangle": <SvgToolModeButton key="rectangle" {...modalButtonProps("rectangle")} title="Rectangle"
                                      onSetSelectedButton={handleSetSelectedButton} />,
    "ellipse": <SvgToolModeButton key="ellipse" {...modalButtonProps("ellipse")} title="Ellipse"
                                    onSetSelectedButton={handleSetSelectedButton} />,
    "stamp": currentStamp
                ? <StampModeButton key="stamp" stamp={currentStamp} stampCount={stampCount} title="Stamp"
                          selected={drawingContent.isSelectedButton("stamp")}
                          onClick={handleStampsButtonClick} onTouchHold={handleStampsButtonTouchHold} />
                : null,
    "stroke-color": <StrokeColorButton key="stroke" settings={drawingContent.toolbarSettings}
                                        onClick={() => handleToggleShowStrokeColorPalette()} />,
    "fill-color": <FillColorButton key="fill" settings={drawingContent.toolbarSettings}
                                    onClick={() => handleToggleShowFillColorPalette()} />,
    "delete": <DeleteButton key="delete" disabled={!drawingContent.hasSelectedObjects} onClick={handleDeleteButton} />,
    "variable": <SvgToolModeButton key="variable" {...modalButtonProps("variable")} title="Variable"
                                    onSetSelectedButton={handleShowVariableDialog} />,
  };

  const toolbarClasses = classNames("drawing-tool-toolbar", { disabled: !isEnabled, flip: flipPalettes });
  return documentContent
    ? ReactDOM.createPortal(
        <div className={toolbarClasses} style={location}>
          <div className="drawing-tool-buttons">
            {toolbarButtons.map(button => {
              return buttonDefs[button];
            })}
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
