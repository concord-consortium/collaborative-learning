import { observer } from "mobx-react";
import React from "react";
import ReactDOM from "react-dom";
import { IFloatingToolbarProps, useFloatingToolbarLocation
        } from "../../components/tiles/hooks/use-floating-toolbar-location";
import { useSettingFromStores } from "../../hooks/use-stores";
import { SetPlacePoint } from "./numberline-toolbar-buttons";
import "./numberline-toolbar.scss";

const defaultButtons = ["place-point"];

interface INumberlineToolbarProps extends IFloatingToolbarProps {
  onSetPlacePoint: () => void;
}

export const NumberlineToolbar: React.FC<INumberlineToolbarProps> = observer((props) => {

  const { documentContent,  tileElt, onIsEnabled, onSetPlacePoint: onSetPointPlace,  ...others
    // model?
   } = props;

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
      case "place-point":
        return <SetPlacePoint key={toolName} onClick={onSetPointPlace} />;
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
