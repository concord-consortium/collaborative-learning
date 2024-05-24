import classNames from "classnames";
import React from "react";
import { Tooltip } from "react-tippy";
import { ToolbarSettings } from "../model/drawing-basic-types";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { computeStrokeDashArray,
  ToolbarModalButton } from "../objects/drawing-object";
import { useTouchHold } from "../../../hooks/use-touch-hold";
import SmallCornerTriangle from "../../../assets/icons/small-corner-triangle.svg";

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
  openPalette?: () => void;
}
export const SvgToolbarButton: React.FC<ISvgToolbarButtonProps> = ({
  SvgIcon, buttonClass, disabled, selected, settings, title, onClick, openPalette
}) => {
  const { fill, stroke, strokeWidth, strokeDashArray } = settings || {};
  const tooltipOptions = useTooltipOptions();

  // If there is a palette that can be opened, set up touch-hold handlers
  const { didTouchHold, ...paletteHandlers }
      = useTouchHold(openPalette || function(){/*noop*/}, onClick);
  const handlers = openPalette ? paletteHandlers : { onClick };

  // Click on the small expand/collapse triangle is similar to touch-hold
  const handleExpandCollapseClick = (e: React.MouseEvent) => {
    if (openPalette && !didTouchHold()) {
      openPalette();
      e.stopPropagation();
    }
  };

  return SvgIcon
    ? <Tooltip title={title} {...tooltipOptions}>
        <button className={buttonClasses({ disabled, selected, others: `button-${buttonClass}` })}
            type="button" disabled={disabled} {...handlers} >
          <SvgIcon fill={fill} stroke={stroke} strokeWidth={strokeWidth}
              strokeDasharray={computeStrokeDashArray(strokeDashArray, strokeWidth)}/>
          { openPalette &&
            <div className="expand-collapse" onClick={handleExpandCollapseClick}>
              <SmallCornerTriangle />
            </div>
          }
        </button>
      </Tooltip>
    : null;
};
