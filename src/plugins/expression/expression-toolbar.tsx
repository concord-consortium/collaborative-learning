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



      const replacedLatex = (latex: string) => {
        const newLatex = latex.replace("blacksquare", "placeholder");
        const errorFreeLatex = newLatex.replace("\\error", "");
        return errorFreeLatex;
      };

      console.log("| clicked mixed fraction button |",
      "\n initial exp:        ", exp,
      "\n parsedLatex:  ",    ce.parse(exp).latex,
      "\n replacedLatex:  ",  replacedLatex(ce.parse(exp).latex),
      );

      mf.current?.executeCommand(
        ["insert", replacedLatex(ce.parse(exp).latex), {insertionMode: "replaceAll"}]
      );
    // console.log("| clicked mixed fraction button |",
    // // "\n exp:        ", exp,
    // // "\n exp.length: ", exp.length,
    // "\n pos:        ", pos,
    // "\n selStart:   ", selStart,
    // "\n selEnd:     ", selEnd,
    // "\n ... editableStatus: ", editableStatus
    // );

    // const ph = "\\placeholder{}";
    // const emptyFrac = `\\frac{${ph}}{${ph}}}`;

    // if (editableStatus === "empty"){
    //   mf.current?.executeCommand(
    //     ["insert", ph + emptyFrac, {insertionMode: "replaceAll"}]
    //   );
    // }

    // else if (editableStatus === "allSelected"){
    //   mf.current?.executeCommand(
    //     ["insert", exp + emptyFrac, {insertionMode: "replaceAll"}]
    //   );
    // }

    /**
     * cases
     *  1. cursor in middle of content: works
     *  2. cursor at end of content: __
     *  3. cursor at beginning of content: __
     */
    // else if (editableStatus === "cursorInContent"){
    //   const locale = pos === 0 ? "beginning" : (pos === exp.length ? "end" : "middle");
    //   const parsed = ce.parse(exp);
    //   console.log("| clicked mixed fraction button |",
    //     "\n initial exp:        ", exp,
    //     "\n exp.length: ", exp.length,
    //     "\n ... editableStatus: ", editableStatus,
    //     "\n pos:          ", pos,
    //     "\n selStart:     ", selStart,
    //     "\n selEnd:       ", selEnd,
    //     "\n cursorlocale: ", locale,
    //     "\n parsedLatex:  ", parsed.latex,
    //   );


    //   // works if cursor really in the middle of the content
    //   // mf.current?.executeCommand(
    //   //   ["insert", "+" + ph + emptyFrac + "+", {insertionMode: "insertAfter"}]
    //   // );
    //   //console.log("| resulting exp |", mf.current?.getValue());
    // }

    // else if (editableStatus === "someSelected"){
    //   if (mf.current?.position && isFinite(mf.current?.position)){
    //     mf.current.position = selEnd || 0;
    //     // if (mf.current?.position < exp.length){
    //     //   mf.current?.executeCommand(
    //     //     ["insert", emptyFrac + "+", {insertionMode: "insertAfter"}]
    //     //   );
    //     // } else {
    //     //   mf.current?.executeCommand(
    //     //     ["insert", emptyFrac, {insertionMode: "insertAfter"}]
    //     //   );
    //     // }
    //   }
    //   mf.current?.executeCommand(
    //     ["insert", emptyFrac + "+", {insertionMode: "insertAfter"}]
    //   );
    // }

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
