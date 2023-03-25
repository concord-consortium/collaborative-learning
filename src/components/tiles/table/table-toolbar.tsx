import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { Tooltip } from "react-tippy";
import SetExpressionIconSvg from "../../../clue/assets/icons/table/set-expression-icon.svg";
import { useSettingFromStores } from "../../../hooks/use-stores";
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

const defaultButtons = ["set-expression"];

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

  const buttonSettings = useSettingFromStores("tools", "table") as unknown as string[] | undefined;
  const buttons = buttonSettings || defaultButtons;

  const getToolbarButton = (toolName: string) => {
    switch (toolName) {
      case "set-expression":
        return <SetExpressionButton onClick={onSetExpression} />;
    }
  };

  return documentContent
    ? ReactDOM.createPortal(
        <div className={`table-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location} onMouseDown={e => e.stopPropagation()}>
          {buttons.map(button => {
            return getToolbarButton(button);
          })}
        </div>, documentContent)
    : null;
});
