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
  mf: any;
}

export const ExpressionToolbar: React.FC<IProps> = observer((
  {model, documentContent, mf, tileElt, onIsEnabled, ...others}: IProps) => {
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

  const deleteExpression = () => {
    content.setLatexStr("");
    mf.current.focus();
  };

  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location}>
        <div className="toolbar-content">
          <button onClick={deleteExpression}>❌</button>
        </div>
      </div>, documentContent)
  : null;
});
