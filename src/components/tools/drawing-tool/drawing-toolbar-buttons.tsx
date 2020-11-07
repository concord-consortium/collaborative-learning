import classNames from "classnames";
import React, { useCallback, useRef } from "react";
import { Tooltip } from "react-tippy";
import {
  computeStrokeDashArray, ToolbarModalButton, ToolbarSettings
} from "../../../models/tools/drawing/drawing-content";
import ColorFillIcon from "../../../clue/assets/icons/drawing/color-fill-icon.svg";
import ColorStrokeIcon from "../../../clue/assets/icons/drawing/color-stroke-icon.svg";
import FreehandToolIcon from "../../../clue/assets/icons/drawing/freehand-icon.svg";
import EllipseToolIcon from "../../../clue/assets/icons/drawing/ellipse-icon.svg";
import LineToolIcon from "../../../clue/assets/icons/drawing/line-icon.svg";
import RectToolIcon from "../../../clue/assets/icons/drawing/rectangle-icon.svg";
import SelectToolIcon from "../../../clue/assets/icons/select-tool.svg";
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
  return classNames("drawing-tool-button", modalButtonClass, { disabled, selected });
};

interface IBaseIconButtonProps {
  disabled?: boolean;
  selected?: boolean;
  modalButton?: ToolbarModalButton;
  settings?: Partial<ToolbarSettings>;
  title: string;
  onClick?: () => void;
  onSetSelectedButton?: (modalButton: ToolbarModalButton) => void;
}

/*
 * ClassIconButton
 */
interface IClassIconButtonProps extends IBaseIconButtonProps {
  iconClass: string;
  style?: React.CSSProperties;
}
export const ClassIconButton: React.FC<IClassIconButtonProps> = ({
        disabled, selected, modalButton, title, iconClass, style, onClick, onSetSelectedButton }) => {
  const buttonRef = useRef<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleClick = useCallback(onClick ||
                      (() => (typeof modalButton === "string") && onSetSelectedButton?.(modalButton)),
                      []);
  return (
    <div className={buttonClasses({ disabled, selected })} title={title}
          ref={elt => buttonRef.current = elt} onClick={handleClick}>
      <span className={`drawing-tool-icon drawing-tool-icon-${iconClass}`} style={style} />
    </div>
  );
};

/*
 * SvgToolbarButton
 */
interface ISvgToolbarButtonProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  buttonClass: string;
  selected?: boolean;
  settings?: Partial<ToolbarSettings>;
  title: string;
  onClick: () => void;
}
export const SvgToolbarButton: React.FC<ISvgToolbarButtonProps> = ({
  SvgIcon, buttonClass, selected, settings, title, onClick
}) => {
  const { fill, stroke, strokeWidth, strokeDashArray } = settings || {};
  const kTooltipYDistance = 0;
  return SvgIcon
    ? <Tooltip title={title} position="bottom" distance={kTooltipYDistance} size="small"
              animation="fade" animateFill={false}>
        <div className={buttonClasses({ selected, others: buttonClass })} onClick={onClick}>
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
