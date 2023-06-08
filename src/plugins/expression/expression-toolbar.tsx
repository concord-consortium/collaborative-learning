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
import { DeleteExpressionButton, MixedFractionButton } from "./expression-buttons";
import { MathfieldElement } from "mathlive";

interface IProps extends IFloatingToolbarProps {
  model: ITileModel;
  mf: React.RefObject<MathfieldElement> | undefined;
  trackedCursorPos: React.MutableRefObject<number>;
  trackedSelection: React.MutableRefObject<string>;
}

export const ExpressionToolbar: React.FC<IProps> = observer((
  { model, documentContent, mf, tileElt, onIsEnabled,
    trackedCursorPos, trackedSelection, ...others
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

  const deleteExpression = () => {
    content.setLatexStr("");
    mf && mf.current?.focus();
  };

  const addMixedFraction = () => {
    const selected = trackedSelection.current;
    const position = trackedCursorPos.current;
    const initialPlaceholder = "\\placeholder{}";
    const emptyFrac = "\\frac{\\placeholder{}}{\\placeholder{}}";
    if (!mf) return;

    // case: field is empty of value, insert an empty mixed fraction
    if (content.latexStr.length === 0) {
      mf.current?.executeCommand([
        "insert", initialPlaceholder + emptyFrac, {insertionMode: "replaceAll"}
      ]);
    }

    // case: everything selected, put existing value in integer slot
    else if (selected.length === content.latexStr.length){
      mf.current?.executeCommand([
        "insert", selected + emptyFrac, {insertionMode: "replaceAll"}
      ]);
    }

    // case: no selection
    else if (content.latexStr.length > 0 && selected.length === 0) {
      mf.current?.executeCommand([
        "insert", initialPlaceholder + emptyFrac, {insertionMode: "insertAfter"}
      ]);
    }

    // cases something more complicated...
    else {
      console.log("| crazy cases...")
      // const splicedIn = content.latexStr.replace(selected, `{{${selected}}\\frac}`);
      // mf.current?.executeCommand([
      //   "insert", splicedIn, {insertionMode: "replaceAll"}
      // ]);
      // console.log("| splicedIn", splicedIn)
    }

    mf && mf.current?.focus();
  };

  return documentContent
    ? ReactDOM.createPortal(
      <div className={toolbarClasses} style={location}>
        <div className="toolbar-content">
          <DeleteExpressionButton onClick={deleteExpression} className={deleteButtonClasses} />
          <MixedFractionButton onClick={addMixedFraction} className={mixedFractionButtonClasses} />
        </div>
      </div>, documentContent)
  : null;
});
