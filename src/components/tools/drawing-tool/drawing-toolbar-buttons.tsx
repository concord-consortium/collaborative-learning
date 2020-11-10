import classNames from "classnames";
import React from "react";
import { Tooltip } from "react-tippy";
import {
  computeStrokeDashArray, StampModelType, ToolbarModalButton, ToolbarSettings
} from "../../../models/tools/drawing/drawing-content";
import ColorFillIcon from "../../../clue/assets/icons/drawing/color-fill-icon.svg";
import ColorStrokeIcon from "../../../clue/assets/icons/drawing/color-stroke-icon.svg";
import DeleteSelectionIcon from "../../../assets/icons/delete/delete-selection-icon.svg";
import FreehandToolIcon from "../../../clue/assets/icons/drawing/freehand-icon.svg";
import EllipseToolIcon from "../../../clue/assets/icons/drawing/ellipse-icon.svg";
import LineToolIcon from "../../../clue/assets/icons/drawing/line-icon.svg";
import RectToolIcon from "../../../clue/assets/icons/drawing/rectangle-icon.svg";
import SelectToolIcon from "../../../clue/assets/icons/select-tool.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { useTouchHold } from "../../../hooks/use-touch-hold";
import { isLightColorRequiringContrastOffset } from "../../../utilities/color-utils";

const svgIcons: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  ellipse: EllipseToolIcon,
  line: FreehandToolIcon,
  rectangle: RectToolIcon,
  select: SelectToolIcon,
  vector: LineToolIcon
};

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
  modalButton: ToolbarModalButton;
  selected?: boolean;
  settings: Partial<ToolbarSettings>;
  title: string;
  onSetSelectedButton: (modalButton: ToolbarModalButton) => void;
}
export const SvgToolModeButton: React.FC<ISvgToolModeButtonProps> = ({
  modalButton, onSetSelectedButton, ...others
}) => {
  const SvgIcon = modalButton && svgIcons[modalButton];
  const handleClick = () => onSetSelectedButton?.(modalButton);
  return SvgIcon
    ? <SvgToolbarButton SvgIcon={SvgIcon} buttonClass={modalButton} onClick={handleClick} {...others} />
    : null;
};

interface IStampModeButtonProps {
  selected: boolean;
  stamp: StampModelType;
  title: string;
  onClick: () => void;
  onTouchHold: () => void;
}
export const StampModeButton: React.FC<IStampModeButtonProps> = ({
  selected, stamp, title, onClick, onTouchHold
}) => {
  const { didTouchHold, ...handlers } = useTouchHold(onTouchHold, onClick);
  const handleExpandCollapseClick = (e: React.MouseEvent) => {
    if (!didTouchHold()) {
      onTouchHold();
      e.stopPropagation();
    }
  };
  const tooltipOptions = useTooltipOptions();
  return (
    <Tooltip title={title} {...tooltipOptions}>
      <div className={buttonClasses({ modalButton: "stamp", selected })} {...handlers}>
        <img src={stamp.url} draggable="false" />
        <div className="expand-collapse" onClick={handleExpandCollapseClick}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7" width="7" height="7">
            <polygon points="0,7 7,7 7,0"/>
          </svg>
        </div>
      </div>
    </Tooltip>
  );
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
  disabled?: boolean;
  onClick: () => void;
}
export const DeleteButton: React.FC<IDeleteToolButtonProps> = (props) => {
  return <SvgToolbarButton SvgIcon={DeleteSelectionIcon} buttonClass="delete" title="Delete" {...props} />;
};
