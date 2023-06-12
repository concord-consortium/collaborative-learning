import { observer } from "mobx-react";
import { ComputeEngine } from "@cortex-js/compute-engine";
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
}

const ce = new ComputeEngine();

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

    const locale = pos === 0 ? "beginning" : (pos === exp.length || (pos === selEnd && pos === selStart) ? "end" : "middle");
    const parsedJson = ce.parse(exp).json;
    const parsedLatex = ce.parse(exp).latex;
    const isAllNumerals = /^\d+$/.test(exp);

    const ph = "\\placeholder{}";
    const emptyFrac = `\\frac{${ph}}{${ph}}}`;

    console.log("| handle cursorInMiddle - not all numerals |",
    "\n CONTENT:",
    "\n   initial exp:    ", exp,
    "\n   parsedJson:     ", parsedJson,
    "\n   parsedLatex:    ", parsedLatex,
    "\n SELECTION: ",
    "\n   selStart:       ", selStart,
    "\n   selEnd:         ", selEnd,
    "\n   pos:            ", pos,
    "\n DERIVED: ",
    "\n   isAllNumerals:  ", isAllNumerals,
    "\n   editableStatus: ", editableStatus,
    "\n   cLocale:        ", locale
    )

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

    // 1 DOES SOME SELECTED ALWAYS WORK, PROBABLY NOT
    else if (editableStatus === "someSelected"){

        if (isAllNumerals){
          mf.current?.executeCommand(
            ["insert", "+" + ph + emptyFrac + "+", {insertionMode: "insertAfter"}]
          );
        }

        else {
          mf.current?.executeCommand(
            ["insert", "+" + ph + emptyFrac + "+", {insertionMode: "replaceSelected"}]
          );
        }
      // if (mf.current?.position && isFinite(mf.current?.position)){
      //   mf.current.position = selEnd || 0;
      //   if (mf.current?.position < exp.length){
      //     mf.current?.executeCommand(
      //       ["insert", emptyFrac + "+", {insertionMode: "insertAfter"}]
      //     );
      //   } else {
      //     mf.current?.executeCommand(
      //       ["insert", emptyFrac, {insertionMode: "insertAfter"}]
      //     );
      //   }
      // }
      // mf.current?.executeCommand(
      //   ["insert", emptyFrac + "+", {insertionMode: "insertAfter"}]
      // );
    }

    // 2 DOES CURSOR IN CONTENT ALWAYS WORK, PROBABLY NOT
    else if (editableStatus === "cursorInContent"){
      if(locale === "end"){
        mf.current?.executeCommand(
          ["insert", "+" + ph + emptyFrac, {insertionMode: "insertAfter"}]
        );
      }

      else if(locale === "beginning"){
        mf.current?.executeCommand(
          ["insert", ph + emptyFrac + "+", {insertionMode: "insertBefore"}]
        );
      }

      else {

        if (!pos) return;
        // const charBeforeCursor = exp[pos - 1];
        // const charAfterCursor = exp[pos];
        // const isNumeralBeforeCursor = /^\d+$/.test(charBeforeCursor);
        // const isNumeralAfterCursor = /^\d+$/.test(charAfterCursor);
        // const isNumeralAfterCursor = /^\d+$/.test(exp.slice(pos));
        //const safeToInsert = isNumeralBeforeCursor && isNumeralAfterCursor;
        if (isAllNumerals){
          mf.current?.executeCommand(
            ["insert", "+" + ph + emptyFrac + "+", {insertionMode: "insertAfter"}]
          );
        }

        else {

          // mf.current?.executeCommand(
          //   ["moveToPreviousWord", {extendSelection: true}]
          // );
          // mf.current?.executeCommand(
          //   ["insert", "+" + ph + emptyFrac, {insertionMode: "insertAfter"}]
          // );
        }
      }
    }
    mf.current?.focus();
  };

  /*
  an addition to this approach could be to check the math json/evaluation if possible for errors
  and insert a placeholder if there is an error
  however that would break the plan, so put it in a separate function
  in fact all this insertion should be abstracted to a function so it can happen with other buttons

  */
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
