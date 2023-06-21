import { observer } from "mobx-react";
import React, { DOMAttributes, useRef, useEffect, FormEvent } from "react";
import { onSnapshot } from "mobx-state-tree";
import { pick } from "lodash";

import "mathlive"; // separate static import of library for initialization to run
// eslint-disable-next-line no-duplicate-imports
import type { MathfieldElementAttributes, MathfieldElement } from "mathlive";
import { ComputeEngine, version } from "@concord-consortium/compute-engine";
import { ITileProps } from "../../components/tiles/tile-component";
import { ExpressionContentModelType } from "./expression-content";
import { CustomEditableTileTitle } from "../../components/tiles/custom-editable-tile-title";
import { replaceKeyBinding } from "./expression-tile-utils";
import { useUIStore } from "../../hooks/use-stores";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { ExpressionToolbar } from "./expression-toolbar";
import { findMissingElements, replaceMissingElements } from "./expression-cortex-utils";

import "./expression-tile.scss";

type CustomElement<T> = Partial<T & DOMAttributes<T>>;
declare global {
  namespace JSX { // eslint-disable-line @typescript-eslint/no-namespace
    interface IntrinsicElements {
      ["math-field"]: CustomElement<MathfieldElementAttributes>;
    }
  }
}
console.log("ComputeEngine version", version);

const computeEngine = new ComputeEngine();
computeEngine.latexOptions = { preserveLatex: true };
computeEngine.jsonSerializationOptions = { metadata: ['latex'] };

function replaceLatex(mfLatex: string) {
  // parse the latex, replace missing elements with placeholders
  const mathJSON = computeEngine.latexSyntax.parse(mfLatex);
  const missingElements = findMissingElements(mathJSON);
  return replaceMissingElements(mfLatex, missingElements);
}

const undoKeys = ["cmd+z", "[Undo]", "ctrl+z"];

export const ExpressionToolComponent: React.FC<ITileProps> = observer((props) => {
  const { onRegisterTileApi, onRequestUniqueTitle, onUnregisterTileApi,
    model, readOnly, documentContent, tileElt, scale } = props;
  const content = model.content as ExpressionContentModelType;
  const mf = useRef<MathfieldElement>(null);
  const trackedCursorPos = useRef<number>(0);
  const ui = useUIStore();

  useEffect(() => {
    const handleFocus = () => ui.setSelectedTileId(model.id);
    // Save the math field so we can remove the listener from the same instance
    // even if the instance is changed for some reason
    const currentMathField = mf.current;
    currentMathField?.addEventListener("focus", handleFocus);
    undoKeys.forEach((key: string) => {
      mf.current?.keybindings && replaceKeyBinding(mf.current.keybindings, key, "");
    });
    if (mf.current) {
      // Uncomment this line to see all of the available shortcuts
      // console.log("mf.current.inlineShortcuts", mf.current.inlineShortcuts);

      // Only pick some of the default mathlive shortcuts
      const defaultShortcuts = pick(mf.current.inlineShortcuts, [
        "%"
      ]);
      // Combine those defaults with some custom shortcuts
      mf.current.inlineShortcuts = {
        ...defaultShortcuts,
        "*": "\\times"
      };
    }
    return () => currentMathField?.removeEventListener("focus", handleFocus);
  }, [model.id, ui]);

  useEffect(() => {
    // model has changed beneath UI - update mathfield, yet restore cursor position
    const disposer = onSnapshot((content as any), () => {
      if (mf.current?.getValue() === content.latexStr) return;
      mf.current?.setValue(content.latexStr, {silenceNotifications: true});
      if (!readOnly && mf.current) mf.current.position = trackedCursorPos.current - 1;
    });
    return () => disposer();
  }, [content, readOnly]);

  const handleMathfieldInput = (e: FormEvent<MathfieldElementAttributes>) => {
    const mathLiveEvent = e.nativeEvent as any;
    const mathField = e.target as MathfieldElement;

    if(mathField.mode === "latex" && mathLiveEvent.inputType === "insertText" && mathLiveEvent.data === "insertText") {
      // This is an event that happens when the user types `\`
      // this same type of event is also sent when the user is typing characters after
      // the `\` before they hit enter. After they hit enter there is another
      // insertText event which has data of what they typed, for example `\div`
      // The `mode` is "math" when the user is entering characters normally. After the
      // the user hits enter when typing in `\div` another input event sent with
      // the `mode` of "math".

      // So in this case when we are in this `\` mode, we don't want to set the value
      // of the element. We also don't need to save the value to the content because
      // the value is not changing while in this `\` mode.
      return;
    }
    const mfLatex = (e.target as MathfieldElement).value;
    const replacedLatex = replaceLatex(mfLatex);
    trackedCursorPos.current =  mf.current?.position || 0;
    if (mf.current?.value){
      mf.current.value = replacedLatex;
    }
    if (mf.current && trackedCursorPos.current != null){
      mf.current.position = trackedCursorPos?.current; //restore cursor position
    }
    content.setLatexStr(replacedLatex);
  };

  const toolbarProps = useToolbarTileApi({
    id: model.id,
    enabled: !readOnly,
    onRegisterTileApi,
    onUnregisterTileApi
  });

  const mathfieldAttributes = {
    ref: mf,
    value: content.latexStr,
    onInput: !readOnly ? handleMathfieldInput : undefined,
    readOnly: readOnly ? "true" : undefined,
  };

  return (
    <div className="expression-tool">
      <ExpressionToolbar
        model={model}
        mf={mf}
        trackedCursorPos={trackedCursorPos}
        documentContent={documentContent}
        tileElt={tileElt}
        scale={scale}
        {...toolbarProps}
      />

      <div className="expression-title-area">
        <CustomEditableTileTitle
          model={model}
          onRequestUniqueTitle={onRequestUniqueTitle}
          readOnly={readOnly}
        />
      </div>
      <div className="expression-math-area">
        <math-field {...mathfieldAttributes} />
      </div>
    </div>
  );
});
ExpressionToolComponent.displayName = "ExpressionToolComponent";
