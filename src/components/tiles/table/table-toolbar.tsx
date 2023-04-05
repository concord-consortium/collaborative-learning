import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";

import { DeleteSelectedButton, SetExpressionButton } from "./table-toolbar-buttons";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";

import "./table-toolbar.scss";

const defaultButtons = ["set-expression", "delete"];

interface IProps extends IFloatingToolbarProps {
  deleteSelected: () => void;
  onSetExpression: () => void;
}
export const TableToolbar: React.FC<IProps> = observer(({
  deleteSelected, documentContent, onIsEnabled, onSetExpression, ...others
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
        return <SetExpressionButton key={toolName} onClick={onSetExpression} />;
      case "delete":
        return <DeleteSelectedButton key={toolName} onClick={deleteSelected} />;
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
