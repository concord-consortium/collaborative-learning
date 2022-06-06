import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { Tooltip } from "react-tippy";
import { DrawingContentModelType } from "../model/drawing-content";
import { ToolbarModalButton } from "../model/drawing-types";
import { ToolbarSettings } from "../model/drawing-basic-types";
import SelectToolIcon from "../../../clue/assets/icons/select-tool.svg";
import ColorFillIcon from "../../../clue/assets/icons/drawing/color-fill-icon.svg";
import ColorStrokeIcon from "../../../clue/assets/icons/drawing/color-stroke-icon.svg";
import DeleteSelectionIcon from "../../../assets/icons/delete/delete-selection-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { isLightColorRequiringContrastOffset } from "../../../utilities/color-utils";
import { computeStrokeDashArray, IToolbarButtonProps } from "../objects/drawing-object";

interface IButtonClasses {
  modalButton?: ToolbarModalButton;
  disabled?: boolean;
  selected?: boolean;
  others?: string;
}
export const buttonClasses = ({ modalButton, disabled, selected, others }: IButtonClasses) => {
  const modalButtonClass = modalButton ? `button-${modalButton}` : undefined;
  return classNames("drawing-tool-button", modalButtonClass, { disabled, selected }, others);
};

/*
 * SvgToolbarButton
 */
interface ISvgToolbarButtonProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  buttonClass: string;
  disabled?: boolean;
  selected?: boolean;
  settings?: Partial<ToolbarSettings>;
  title: string;
  onClick: () => void;
}
export const SvgToolbarButton: React.FC<ISvgToolbarButtonProps> = ({
  SvgIcon, buttonClass, disabled, selected, settings, title, onClick
}) => {
  const { fill, stroke, strokeWidth, strokeDashArray } = settings || {};
  const tooltipOptions = useTooltipOptions();
  return SvgIcon
    ? <Tooltip title={title} {...tooltipOptions}>
        <div className={buttonClasses({ disabled, selected, others: `button-${buttonClass}` })} onClick={onClick}>
          <SvgIcon fill={fill} stroke={stroke} strokeWidth={strokeWidth}
              strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}/>
        </div>
      </Tooltip>
    : null;
};

/*
 * SvgToolModeButton
 */
interface ISvgToolModeButtonProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  // FIXME: this causes an circular dependency
  // I thin the only thing the drawingContent is used for here is to set
  // the selected button. So this method could moved to an interface instead.
  drawingContent: DrawingContentModelType;
  modalButton: ToolbarModalButton;
  selected?: boolean;
  settings?: Partial<ToolbarSettings>;
  title: string;
}
export const SvgToolModeButton: React.FC<ISvgToolModeButtonProps> = observer(function SvgToolModeButton({
  SvgIcon, drawingContent, modalButton, settings, ...others
}) {
  const handleClick = () => drawingContent.setSelectedButton(modalButton);
  const { selectedButton, toolbarSettings } = drawingContent;
  const selected = selectedButton === modalButton;
  const _settings = settings || toolbarSettings;

  return <SvgToolbarButton SvgIcon={SvgIcon} buttonClass={modalButton} onClick={handleClick} 
    selected={selected} settings={_settings} {...others} />;
});

export const SelectToolbarButton: React.FC<IToolbarButtonProps> = ({drawingContent}) => {
  return <SvgToolModeButton modalButton="select" title="Select"
    drawingContent={drawingContent} SvgIcon={SelectToolIcon} settings={{}}/>;
};

interface IColorButtonProps {
  settings: Partial<ToolbarSettings>;
  onClick: () => void;
}
const kLightLuminanceContrastStroke = "#949494";  // $charcoal-light-1

export const FillColorButton: React.FC<IColorButtonProps> = ({ settings, onClick }) => {
  const stroke = isLightColorRequiringContrastOffset(settings.fill) ? kLightLuminanceContrastStroke : settings.fill;
  return <SvgToolbarButton SvgIcon={ColorFillIcon} buttonClass="fill-color" title="Fill color"
            settings={{ fill: settings.fill, stroke }} onClick={onClick} />;
};

export const StrokeColorButton: React.FC<IColorButtonProps> = ({ settings, onClick }) => {
  const stroke = isLightColorRequiringContrastOffset(settings.stroke) ? kLightLuminanceContrastStroke : settings.stroke;
  return <SvgToolbarButton SvgIcon={ColorStrokeIcon} buttonClass="stroke-color" title="Line/border color"
            settings={{ fill: settings.stroke, stroke }} onClick={onClick} />;
};

interface IDeleteToolButtonProps {
  drawingContent: DrawingContentModelType;
}
export const DeleteButton: React.FC<IDeleteToolButtonProps> = observer(function DeleteButton({
  drawingContent
}) {
  const onClick = () => {
    drawingContent.deleteSelectedObjects();
  };
  const disabled = !drawingContent.hasSelectedObjects;

  return <SvgToolbarButton SvgIcon={DeleteSelectionIcon} buttonClass="delete" title="Delete" 
    onClick={onClick} disabled={disabled} />;
});
