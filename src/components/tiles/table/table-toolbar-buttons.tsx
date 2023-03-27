import React from "react";
import { Tooltip, TooltipProps } from "react-tippy";
import DeleteSelectedIconSvg from "../../../assets/icons/delete/delete-selection-icon.svg";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";

import "./table-toolbar.scss";

interface ITableButtonProps {
  icon: any;
  onClick: () => void;
  tooltipOptions: TooltipProps;
}
const TableButton = ({ icon, onClick, tooltipOptions}: ITableButtonProps) => {
  const to = useTooltipOptions(tooltipOptions);
  return (
    <Tooltip {...to}>
      <button className="toolbar-button set-expression" onClick={onClick}>
        {icon}
      </button>
    </Tooltip>
  );
};
interface IDeleteSelectedProps {
  onClick: () => void;
}
export const DeleteSelectedButton = ({ onClick }: IDeleteSelectedProps) => (
  <TableButton
    icon={<DeleteSelectedIconSvg />}
    onClick={onClick}
    tooltipOptions={{ title: "Clear cell" }}
  />
);

interface ISetExpressionButtonProps {
  onClick: () => void;
}
export const SetExpressionButton = ({ onClick }: ISetExpressionButtonProps) => (
  <TableButton
    icon={<SetExpressionIconSvg />}
    onClick={onClick}
    tooltipOptions={{ title: "Set expression" }}
  />
);
