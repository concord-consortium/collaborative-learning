import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";

import { DeleteSelectedButton, LinkTileButton, SetExpressionButton } from "./table-toolbar-buttons";
import { MergeInButton } from "../../../plugins/data-card/components/data-card-toolbar-buttons";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { IFloatingToolbarProps, useFloatingToolbarLocation } from "../hooks/use-floating-toolbar-location";
import { useTileDataMerging } from "../../../hooks/use-tile-data-merging";
import { ITileModel } from "../../../models/tiles/tile-model";

import "./table-toolbar.scss";

const defaultButtons = ["set-expression", "link-tile", "add-data", "delete"];

interface IProps extends IFloatingToolbarProps {
  isLinkEnabled: boolean;
  model: ITileModel;
  deleteSelected: () => void;
  getLinkIndex: () => number;
  onSetExpression: () => void;
  showLinkDialog?: () => void;
}
export const TableToolbar: React.FC<IProps> = observer(({
  documentContent, isLinkEnabled, deleteSelected, getLinkIndex, onIsEnabled,
  onSetExpression, showLinkDialog, model, ...others
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

  const { isMergeEnabled, showMergeTileDialog } = useTileDataMerging({model});


  const getToolbarButton = (toolName: string) => {
    switch (toolName) {
      case "set-expression":
        return <SetExpressionButton key={toolName} onClick={onSetExpression} />;
      case "delete":
        return <DeleteSelectedButton key={toolName} onClick={deleteSelected} />;
      case "link-tile":
        return <LinkTileButton
                 key={toolName}
                 isEnabled={isLinkEnabled}
                 getLinkIndex={getLinkIndex}
                 onClick={showLinkDialog}
               />;
      case "add-data":
        return <MergeInButton onClick={showMergeTileDialog} isEnabled={isMergeEnabled} />;
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
