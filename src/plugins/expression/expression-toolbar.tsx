import { observer } from "mobx-react";
import classNames from "classnames";
import React from "react";
import ReactDOM from "react-dom";
import {
  IFloatingToolbarProps, useFloatingToolbarLocation
} from "../../components/tiles/hooks/use-floating-toolbar-location";
import { ExpressionContentModelType } from "./expression-content";
import { getCommand } from "./expression-tile-utils";
import { ITileModel } from "../../models/tiles/tile-model";

import "./expression-toolbar.scss";
import { DeleteExpressionButton, MixedFractionButton, AddMathTextButton } from "./expression-buttons";
import { MathfieldElement } from "mathlive";

interface IProps extends IFloatingToolbarProps {
  model: ITileModel;
  mf: React.RefObject<MathfieldElement> | undefined;
  trackedCursorPos: React.MutableRefObject<number>;
}

export const ExpressionToolbar: React.FC<IProps> = observer((
  { model, documentContent, mf, tileElt, onIsEnabled,
    trackedCursorPos, ...others
  }: IProps) => {
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

  const deleteButtonClasses = classNames(
    "delete-expression",
    enabled ? "enabled" : "disabled",
  );

  const mixedFractionButtonClasses = classNames(
    "mixed-fraction",
    enabled ? "enabled" : "disabled",
  );

  const addMathTextButtonClasses = (buttonName: string) => {
    return classNames(
      buttonName,
      enabled ? "enabled" : "disabled",
    );
  };

  const deleteExpression = () => {
    content.setLatexStr("");
    mf && mf.current?.focus();
  };

  const addMixedFraction = () => {
    if (!(mf && mf.current)) return;
    const c = getCommand(mf.current, "mixedFraction")
    mf.current.executeCommand(c as any);
    mf.current?.focus();
  };

  const addDivisionSymbol = () => {
    if (!(mf && mf.current)) return;
    const c = getCommand(mf.current, "divisionSymbol")
    mf.current.executeCommand(c as any);
    mf.current?.focus();
  };

  const addMathText = (buttonName: string) => {
    if (!(mf && mf.current)) return;
    const c = getCommand(mf.current, buttonName)
    mf.current.executeCommand(c as any);
    mf.current?.focus();
  };


  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location}>
        <div className="toolbar-content">
          <DeleteExpressionButton onClick={deleteExpression} className={deleteButtonClasses} />
          <MixedFractionButton onClick={addMixedFraction} className={mixedFractionButtonClasses} />
        {/* FINISH IMPLEMENTING THIS IN THE MORNING */}
          {/* <AddMathTextButton buttonName="mixedFraction" onClick={addMathText("mixedFraction") as any} className={addMathTextButtonClasses("mixedFraction")} /> */}
          <button onClick={addDivisionSymbol}>÷</button>
        </div>
      </div>, documentContent)
  : null;
});
