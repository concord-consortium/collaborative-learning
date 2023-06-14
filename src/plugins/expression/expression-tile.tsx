import { observer } from "mobx-react";
import React, { DOMAttributes, useRef, useEffect, FormEvent } from "react";
import { onSnapshot } from "mobx-state-tree";
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
    mf.current?.addEventListener("focus", () => ui.setSelectedTileId(model.id));
    undoKeys.forEach((key: string) => {
      mf.current?.keybindings && replaceKeyBinding(mf.current.keybindings, key, "");
    });
  }, [model.id, ui]);

  useEffect(() => {
    // when we change model programatically, we need to update mathfield
    const disposer = onSnapshot((content as any), () => {
      if (mf.current?.getValue() === content.latexStr) return;
      mf.current?.setValue(content.latexStr, {silenceNotifications: true});
      if (!readOnly && mf.current) mf.current.position = trackedCursorPos.current - 1;
    });
    return () => disposer();
  }, [content, readOnly]);

  const handleChange = (e: FormEvent<MathfieldElementAttributes>) => {
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
    onInput: !readOnly ? handleChange : undefined,
    readOnly: readOnly ? "true" : undefined,
  };

  return (
    <div className="expression-tool">
      <ExpressionToolbar
        model={model}
        documentContent={documentContent}
        tileElt={tileElt}
        scale={scale}
        {...toolbarProps}
        mf={mf}
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
