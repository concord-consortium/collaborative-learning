import classNames from "classnames";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import {
  DeleteButton, FillColorButton, StrokeColorButton, SvgToolModeButton,
} from "./drawing-toolbar-buttons";
import { StampsPalette } from "./stamps-palette";
import { StrokeColorPalette } from "./stroke-color-palette";
import { FillColorPalette } from "./fill-color-palette";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../../components/tools/hooks/use-floating-toolbar-location";
import { useForceUpdate } from "../../../components/tools/hooks/use-force-update";
import { useMobXOnChange } from "../../../components/tools/hooks/use-mobx-on-change";
import { IRegisterToolApiProps } from "../../../components/tools/tool-tile";
import { DrawingContentModelType } from "../model//drawing-content";
import { ToolbarModalButton } from "../model/drawing-types";
import { ToolbarSettings } from "../model/drawing-basic-types";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { useVariableDialog } from "../../shared-variables/drawing/use-variable-dialog";
import { LineToolbarButton } from "../objects/line";
import { StampToolbarButton } from "../objects/image";
import { IPaletteState, IToolbarButtonProps, kClosedPalettesState, PaletteKey } from "../objects/drawing-object";
import { VectorToolbarButton } from "../objects/vector";
import { RectangleToolbarButton } from "../objects/rectangle";
import { EllipseToolbarButton } from "../objects/ellipse";

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

  const toolbarButtonProps: IToolbarButtonProps = {
    drawingContent,
    togglePaletteState,
    clearPaletteState
  };

  const buttonDefs: Record<string, React.ReactNode> = {
    "select": <SvgToolModeButton key="select" {...modalButtonProps("select", {})}
                                  title="Select" onSetSelectedButton={handleSetSelectedButton} />,
    "line": <LineToolbarButton key="line" {...toolbarButtonProps} />,
    "vector": <VectorToolbarButton key="vector" {...toolbarButtonProps} />,
    "rectangle": <RectangleToolbarButton key="rectangle" {...toolbarButtonProps} />,
    "ellipse": <EllipseToolbarButton key="ellipse" {...toolbarButtonProps} />,
    "stamp": <StampToolbarButton key="stamp" {...toolbarButtonProps} />,
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
        <div className={toolbarClasses} style={location} data-testid="drawing-toolbar">
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
