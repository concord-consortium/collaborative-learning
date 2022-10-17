import classNames from "classnames";
import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tippy";
import { useTooltipOptions } from "../../hooks/use-tooltip-options";
import { IFloatingToolbarProps, useFloatingToolbarLocation }
  from "../../components/tools/hooks/use-floating-toolbar-location";

import VariablesToolIcon from "../shared-variables/slate/variables.svg";
import DeleteSelectionIcon from "../../assets/icons/delete/delete-selection-icon.svg";
import "./diagram-toolbar.scss";

/*
 * SvgToolbarButton
 * Taken and modified from drawing-toolbar-buttons.tsx
 */
interface ButtonStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}
interface ISvgToolbarButtonProps {
  SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>;
  buttonClass: string;
  disabled?: boolean;
  selected?: boolean;
  style?: ButtonStyle;
  title: string;
  onClick: () => void;
}
export const SvgToolbarButton: React.FC<ISvgToolbarButtonProps> = ({
  SvgIcon, buttonClass, disabled, selected, style, title, onClick
}) => {
  const tooltipOptions = useTooltipOptions();
  const stroke = style?.stroke || "#000000";
  const fill = style?.fill || "none";
  const strokeWidth = (style && Object.hasOwn(style, "strokeWidth")) ? style.strokeWidth : 2;
  return SvgIcon
    ? <Tooltip title={title} {...tooltipOptions}>
        <button className={classNames("diagram-tool-button", { disabled, selected }, buttonClass)}
            onClick={onClick} type="button">
          <SvgIcon fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </button>
      </Tooltip>
    : null;
};

const DialogButton = () => {
  const handleClick = () => console.log("dialog!");
  return (
    <SvgToolbarButton SvgIcon={VariablesToolIcon} buttonClass="button-dialog" title="variable-dialog"
      onClick={handleClick} style={{fill: "#000000", strokeWidth: 0.1}} />
  );
};

const DeleteButton = () => {
  const handleClick = () => console.log("deleted!");
  return (
    <SvgToolbarButton SvgIcon={DeleteSelectionIcon} buttonClass="button-delete" title="delete"
      onClick={handleClick} />
  );
};

interface IProps extends IFloatingToolbarProps {
}
export const DiagramToolbar: React.FC<IProps> = observer(({
  documentContent, onIsEnabled, ...others
}) => {
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
    documentContent,
    toolbarHeight: 34,
    toolbarTopOffset: 2,
    enabled,
    ...others
  });
  return documentContent
    ? ReactDOM.createPortal(
        <div className={`image-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location}
            onMouseDown={e => e.stopPropagation()}>
          <DialogButton />
          <DeleteButton />
        </div>, documentContent)
    : null;
});
