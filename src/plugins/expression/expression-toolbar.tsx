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
  //trackedSelection?: React.MutableRefObject<string>;
}

export const ExpressionToolbar: React.FC<IProps> = observer((
  { model, documentContent, mf, tileElt, onIsEnabled,
    trackedCursorPos, /*trackedSelection,*/ ...others
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
    if (!mf) return;

    // collect info on state of the mathfield vis=à-vis selection and curspr
    const exp = content.latexStr;
    const selStart = mf.current?.selection.ranges[0][0];
    const selEnd = mf.current?.selection.ranges[0][1];
    const pos = mf.current?.position;

    let editableStatus: "empty" | "allSelected" | "someSelected"| "cursorInContent" | undefined;

    if (exp.length === 0 || exp === "\\placeholder" || exp === " ") editableStatus = "empty";
    else if (selStart === 0 && selEnd === exp.length) editableStatus = "allSelected";
    else if (selStart !== selEnd) editableStatus = "someSelected";
    else if (selStart === selEnd && selStart === pos) editableStatus = "cursorInContent";
    else editableStatus = undefined;

    console.log("| ",
    "\n exp:        ", exp,
    //"\n expression  ", mf.current?.expression.json,
    "\n exp.length: ", exp.length,
    "\n pos:        ", pos,
    "\n selStart:   ", selStart,
    "\n selEnd:     ", selEnd,
    "\n ... editableStatus: ", editableStatus
    );

    const ph = "\\placeholder{}";
    const emptyFrac = `\\frac{${ph}}{${ph}}}`;

    /* testing substrings has limited use here, instead we should
    consider navigating the cursor and selection among groups in the mathfield */

    if (editableStatus === "empty"){
      mf.current?.executeCommand(
        ["insert", ph + emptyFrac, {insertionMode: "replaceAll"}]
      );
    }

    else if (editableStatus === "allSelected"){
      mf.current?.executeCommand(
        ["insert", exp + emptyFrac, {insertionMode: "replaceAll"}]
      );
    }

    else if (editableStatus === "cursorInContent"){
      mf.current?.executeCommand(
        ["insert", ph + emptyFrac, {insertionMode: "insertAfter"}]
      );
    }

    else if (editableStatus === "someSelected"){
      if (mf.current?.position && isFinite(mf.current?.position)){
        mf.current.position = selEnd || 0;
        // if (mf.current?.position < exp.length){
        //   mf.current?.executeCommand(
        //     ["insert", emptyFrac + "+", {insertionMode: "insertAfter"}]
        //   );
        // } else {
        //   mf.current?.executeCommand(
        //     ["insert", emptyFrac, {insertionMode: "insertAfter"}]
        //   );
        // }
      }
      mf.current?.executeCommand(
        ["insert", emptyFrac + "+", {insertionMode: "insertAfter"}]
      );
    }

    mf.current?.focus();
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
