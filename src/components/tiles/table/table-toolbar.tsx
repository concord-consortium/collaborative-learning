import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";

import { DeleteSelectedButton, LinkTileButton, SetExpressionButton } from "./table-toolbar-buttons";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { DataSetViewButton } from "../../../components/shared/data-set-view-button";

import "./table-toolbar.scss";

type IButtonSetting = string | [string, string];

const defaultButtons = ["set-expression", "link-tile", "delete"];

interface IProps extends IFloatingToolbarProps {
  isLinkEnabled: boolean;
  deleteSelected: () => void;
  onSetExpression: () => void;
  showLinkDialog?: () => void;
}
export const TableToolbar: React.FC<IProps> = observer(({
  documentContent, isLinkEnabled, deleteSelected, onIsEnabled,
  onSetExpression, showLinkDialog, ...others
}) => {
  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                    documentContent,
                    toolbarHeight: 38,
                    toolbarTopOffset: 2,
                    enabled,
                    ...others
                  });

  const buttonSettings = useSettingFromStores("tools", "table") as unknown as IButtonSetting[] | undefined;
  const buttons = buttonSettings || defaultButtons;

  const getToolbarButton = (toolName: IButtonSetting) => {
    if (typeof toolName === "string") {
      switch (toolName) {
        case "set-expression":
          return <SetExpressionButton key={toolName} onClick={onSetExpression} />;
        case "delete":
          return <DeleteSelectedButton key={toolName} onClick={deleteSelected} />;
        case "link-tile":
          return <LinkTileButton
                  key={toolName}
                  isEnabled={isLinkEnabled}
                  onClick={showLinkDialog}
                />;
      }
    } else {
      // If `toolName` is an array, the first item is the tool name.
      // The remaining items are parameters to the pass to the tool
      const realToolName = toolName[0];
      if (realToolName === "data-set-view") {
        const tileType = toolName[1];
        return <DataSetViewButton key={`${toolName[0]}_${toolName[1]}`} newTileType={tileType} />;
      }
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
