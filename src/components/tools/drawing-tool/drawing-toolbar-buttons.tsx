import classNames from "classnames";
import React, { useCallback, useRef } from "react";
import {
  computeStrokeDashArray, DrawingContentModelType, ToolbarModalButton
} from "../../../models/tools/drawing/drawing-content";

export const buttonClasses =
        (content: DrawingContentModelType, modalButtonOrMap?: ToolbarModalButton | Record<string, any>) => {
  const selected = typeof modalButtonOrMap === "string"
                    ? { selected: modalButtonOrMap && (modalButtonOrMap === content.selectedButton) }
                    : undefined;
  const others = typeof modalButtonOrMap !== "string" ? modalButtonOrMap : undefined;
  return classNames("drawing-tool-button", selected, others);
};

interface IBaseIconButtonProps {
  content: DrawingContentModelType;
  modalButton?: ToolbarModalButton | Record<string, any>;
  title: string;
  onSetSelectedButton?: (modalButton: ToolbarModalButton) => void;
}

/*
 * ClassIconButton
 */
interface IClassIconButtonProps extends IBaseIconButtonProps {
  iconClass: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  onSetSelectedButton?: (modalButton: ToolbarModalButton) => void;
}
export const ClassIconButton: React.FC<IClassIconButtonProps> = ({
        content, modalButton, title, iconClass, style, onClick, onSetSelectedButton }) => {
  const buttonRef = useRef<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleClick = useCallback(onClick ||
                      (() => (typeof modalButton === "string") && onSetSelectedButton?.(modalButton)),
                      []);
  return (
    <div className={buttonClasses(content, modalButton)} title={title}
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
}
export const SvgIconButton: React.FC<ISvgIconButtonProps> = ({ content, modalButton, title, onSetSelectedButton }) => {
  const handleClick = () => onSetSelectedButton?.(modalButton);
  return (
    <div className={buttonClasses(content, modalButton)} style={{height: 30}} title={title} onClick={handleClick}>
      <DrawingSvgIcon content={content} button={modalButton} />
    </div>
  );
};

/*
 * DrawingSvgIcon
 */
interface IDrawingSvgIconProps {
  content: DrawingContentModelType;
  button: ToolbarModalButton;
}
export const DrawingSvgIcon: React.FC<IDrawingSvgIconProps> = ({ content, button }) => {
  const {stroke, fill, strokeDashArray, strokeWidth} = content;
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
