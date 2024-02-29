import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../../components/tiles/hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../../hooks/use-stores";
import { SelectButton, PointButton, PointOpenButton, ResetButton, DeleteButton } from "./numberline-toolbar-buttons";

import "./numberline-toolbar.scss";

const defaultButtons = ["select", "point", "point-open", "reset", "delete"];

interface INumberlineToolbarProps extends IFloatingToolbarProps {
  handleClearPoints: () => void; //model - content.deleteAllPoints()
  handleDeletePoint: () => void; //deleteSelectedPoints
  handleCreatePointType: (isOpen: boolean) => void;
  pointTypeIsOpen: boolean
}

export const NumberlineToolbar: React.FC<INumberlineToolbarProps> = observer((props) => {
  const { documentContent,  tileElt, onIsEnabled,
          handleDeletePoint, handleCreatePointType, pointTypeIsOpen, ...others } = props;

  const enabled = onIsEnabled();
  const location = useFloatingToolbarLocation({
                    documentContent,
                    tileElt,
                    toolbarHeight: 38,
                    toolbarTopOffset: 2,
                    enabled,
                    ...others
                  });

  const buttonSettings = useSettingFromStores("tools", "numberline") as unknown as string[] | undefined;
  const buttons = buttonSettings || defaultButtons;

  const getToolbarButton = (toolName: string) => {
    switch (toolName) {
      case "select":
        return <SelectButton key={toolName} />;
      case "point":
        return  <PointButton
                  key={toolName}
                  onClick={() => handleCreatePointType(false)}
                  pointTypeIsOpen={pointTypeIsOpen}
                />;
      case "point-open":
        return  <PointOpenButton
                  key={toolName}
                  onClick={() => handleCreatePointType(true)}
                  pointTypeIsOpen={pointTypeIsOpen}
                />;
      case "reset":
        return <ResetButton key={toolName}  />;
      case "delete":
        return <DeleteButton key={toolName} onClick={handleDeletePoint} />;
    }
  };

  return documentContent
    ? ReactDOM.createPortal(
        <div className={`numberline-toolbar ${enabled && location ? "enabled" : "disabled"}`}
            style={location} onMouseDown={e => e.stopPropagation()}>
          {buttons.map(button => {
            return getToolbarButton(button);
          })}
        </div>, documentContent)
    : null;
});
