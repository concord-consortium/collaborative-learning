import classNames from "classnames";
import React, { useCallback, useRef } from "react";
import {
  computeStrokeDashArray, ToolbarModalButton, ToolbarSettings
} from "../../../models/tools/drawing/drawing-content";

interface IButtonClasses {
  disabled?: boolean;
  selected?: boolean;
}
export const buttonClasses = ({ disabled, selected }: IButtonClasses) => {
  return classNames("drawing-tool-button", { disabled, selected });
};

interface IBaseIconButtonProps {
  disabled?: boolean;
  selected?: boolean;
  modalButton?: ToolbarModalButton;
  settings?: ToolbarSettings;
  title: string;
  onSetSelectedButton?: (modalButton: ToolbarModalButton) => void;
}

/*
 * ClassIconButton
 */
interface IClassIconButtonProps extends IBaseIconButtonProps {
  iconClass: string;
  style?: React.CSSProperties;
  onClick?: () => void;
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
 * SvgIconButton
 */
interface ISvgIconButtonProps extends IBaseIconButtonProps {
  modalButton: ToolbarModalButton;
  settings: ToolbarSettings;
}
export const SvgIconButton: React.FC<ISvgIconButtonProps> = ({
  selected, modalButton, settings, title, onSetSelectedButton
}) => {
  const handleClick = () => onSetSelectedButton?.(modalButton);
  return (
    <div className={buttonClasses({ selected })}
          style={{height: 30}} title={title} onClick={handleClick}>
      <DrawingSvgIcon settings={settings} button={modalButton} />
    </div>
  );
};

/*
 * DrawingSvgIcon
 */
interface IDrawingSvgIconProps {
  settings: ToolbarSettings;
  button: ToolbarModalButton;
}
export const DrawingSvgIcon: React.FC<IDrawingSvgIconProps> = ({ settings, button }) => {
  const {stroke, fill, strokeDashArray, strokeWidth} = settings;
  let iconElement: JSX.Element|null = null;
  const iconSize = 30;
  const iconMargin = 5;
  const elementSize = iconSize - (2 * iconMargin);
  const elementHalfSize = elementSize / 2;

  switch (button) {
    case "rectangle":
      iconElement = <rect width={elementSize} height={elementSize} />;
      break;
    case "ellipse":
      iconElement = <ellipse cx={elementHalfSize} cy={elementHalfSize} rx={elementHalfSize} ry={elementHalfSize} />;
      break;
    case "vector":
      iconElement = <line x1={0} y1={elementSize} x2={elementSize} y2={0} />;
      break;
  }

  return (
    <svg width={iconSize} height={iconSize}>
      <g transform={`translate(${iconMargin},${iconMargin})`} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
          strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}>
        {iconElement}
      </g>
    </svg>
  );
};
