import { observer } from "mobx-react";
import classNames from "classnames";
import React from "react";
import ReactDOM from "react-dom";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../components/tiles/hooks/use-floating-toolbar-location";
import { ExpressionContentModelType } from "./expression-content";
import { ITileModel } from "../../models/tiles/tile-model";

import "./expression-toolbar.scss";

interface IProps extends IFloatingToolbarProps {
  model: ITileModel;
  handleDeleteValue: () => void;
}

export const ExpressionToolbar: React.FC<IProps> = observer((
  {model, documentContent, tileElt, onIsEnabled, ...others}: IProps) => {
    const content = model.content as ExpressionContentModelType;
    const enabled = onIsEnabled();

    const location = useFloatingToolbarLocation({
      documentContent,
      tileElt,
      toolbarHeight: 14,
      toolbarTopOffset: 2,
      enabled,
      ...others
  });

  const toolbarClasses = classNames(
    "expression-toolbar",
    enabled && location ? "enabled" : "disabled",
  );

  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location}>
        <div className="toolbar-content">TOOLBAR</div>
      </div>, documentContent)
  : null;
});
