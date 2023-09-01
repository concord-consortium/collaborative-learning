import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { Tooltip } from "react-tippy";
import { ToolbarSettings } from "../model/drawing-basic-types";
import SelectToolIcon from "../../../clue/assets/icons/select-tool.svg";
import ColorFillIcon from "../assets/color-fill-icon.svg";
import ColorStrokeIcon from "../assets/color-stroke-icon.svg";
import DuplicateIcon from "../assets/duplicate-icon.svg";
import DeleteSelectionIcon from "../../../assets/icons/delete/delete-selection-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { isLightColorRequiringContrastOffset } from "../../../utilities/color-utils";
import { computeStrokeDashArray, IToolbarButtonProps, IToolbarManager, 
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

/*
 * SvgToolModeButton
 */
interface ISvgToolModeButtonProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  toolbarManager: IToolbarManager;
  modalButton: ToolbarModalButton;
  selected?: boolean;
  settings?: Partial<ToolbarSettings>;
  title: string;
}
export const SvgToolModeButton: React.FC<ISvgToolModeButtonProps> = observer(function SvgToolModeButton({
  SvgIcon, toolbarManager, modalButton, settings, ...others
}) {
  const handleClick = () => toolbarManager.setSelectedButton(modalButton);
  const { selectedButton, toolbarSettings } = toolbarManager;
  const selected = selectedButton === modalButton;
  const _settings = settings || toolbarSettings;

  return <SvgToolbarButton SvgIcon={SvgIcon} buttonClass={modalButton} onClick={handleClick} 
    selected={selected} settings={_settings} {...others} />;
});

export const SelectToolbarButton: React.FC<IToolbarButtonProps> = ({toolbarManager}) => {
  return <SvgToolModeButton modalButton="select" title="Select"
    toolbarManager={toolbarManager} SvgIcon={SelectToolIcon} settings={{}}/>;
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

interface IDuplicateButtonProps {
  toolbarManager: IToolbarManager;
}
export const DuplicateButton: React.FC<IDuplicateButtonProps> = observer(function DuplicateButton({
  toolbarManager
}) {
  const onClick = () => {
    toolbarManager.duplicateObjects(toolbarManager.selection);
  };
  const disabled = !toolbarManager.hasSelectedObjects;

  return <SvgToolbarButton SvgIcon={DuplicateIcon} buttonClass="duplicate" title="Duplicate"
    onClick={onClick} disabled={disabled} />;
});

interface IDeleteToolButtonProps {
  toolbarManager: IToolbarManager;
}
export const DeleteButton: React.FC<IDeleteToolButtonProps> = observer(function DeleteButton({
  toolbarManager
}) {
  const onClick = () => {
    toolbarManager.deleteObjects([...toolbarManager.selection]);
  };
  const disabled = !toolbarManager.hasSelectedObjects;

  return <SvgToolbarButton SvgIcon={DeleteSelectionIcon} buttonClass="delete" title="Delete" 
    onClick={onClick} disabled={disabled} />;
});
