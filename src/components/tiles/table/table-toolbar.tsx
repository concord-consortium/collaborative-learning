import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { DeleteSelectedButton, LinkTileButton, LinkGraphButton,
         SetExpressionButton, TableMergeInButton } from "./table-toolbar-buttons";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { DataSetViewButton } from "../../../components/shared/data-set-view-button";

import "./table-toolbar.scss";

type IButtonSetting = string | [string, string];

const defaultButtons: IButtonSetting[] = ["set-expression", "link-tile", "link-graph", "merge-in",
  ["data-set-view", "DataCard"], "delete"];

const simpleButtons: Record<string, React.ComponentType | undefined> = {
  "set-expression": SetExpressionButton,
  "delete": DeleteSelectedButton,
  "link-tile": LinkTileButton,
  "merge-in": TableMergeInButton,
  "link-graph": LinkGraphButton,
};
interface IParameterButtonProps {
  args: string[];
}
const parameterButtons: Record<string, React.ComponentType<IParameterButtonProps> | undefined> = {
  "data-set-view": DataSetViewButton,
};

export const TableToolbar: React.FC<IFloatingToolbarProps> = observer(({
  documentContent, onIsEnabled, ...others
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
  console.log("\t🔪 buttonSettings TABLE:", buttonSettings);

  const getToolbarButton = (toolName: IButtonSetting) => {
    if (typeof toolName === "string") {
      const Button = simpleButtons[toolName];
      return Button && <Button key={toolName} />;
    } else {
      // If `toolName` is an array, the first item is the tool name.
      // The remaining items are parameters to the pass to the tool
      const realToolName = toolName[0];
      const Button = parameterButtons[realToolName];
      return Button && <Button key={toolName.join("_")} args={toolName} />;
    }
  };


  // console.log("buttons:", buttons);

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
