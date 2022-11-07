import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tippy";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import { useTooltipOptions } from "../../../hooks/use-tooltip-options";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";

import "./table-toolbar.scss";

interface ISetExpressionButtonProps {
  onClick: () => void;
}
const SetExpressionButton: React.FC<ISetExpressionButtonProps> = ({ onClick }) => {
  const tooltipOptions = useTooltipOptions({ title: "Set expression", distance: -34, offset: -19 });
  return (
    <Tooltip {...tooltipOptions}>
      <div className="toolbar-button set-expression" onClick={onClick}>
        <SetExpressionIconSvg />
      </div>
    </Tooltip>
  );
};

interface IProps extends IFloatingToolbarProps {
  onSetExpression: () => void;
}
export const TableToolbar: React.FC<IProps> = observer(({
  documentContent, onIsEnabled, onSetExpression, ...others
}) => {
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                    documentContent,
                    toolbarHeight: 38,
                    toolbarTopOffset: 2,
                    enabled,
                    ...others
                  });
  return documentContent
    ? ReactDOM.createPortal(
        <div className={`table-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location} onMouseDown={e => e.stopPropagation()}>
          <SetExpressionButton onClick={onSetExpression} />
        </div>, documentContent)
    : null;
});
