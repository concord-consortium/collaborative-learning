import { observer } from "mobx-react";
import React, { DOMAttributes, useRef, useEffect, FormEvent } from "react";
import { onSnapshot } from "mobx-state-tree";
import "mathlive"; // separate static import of library for initialization to run
// eslint-disable-next-line no-duplicate-imports
import type { MathfieldElementAttributes, MathfieldElement } from "mathlive";
import { ITileProps } from "../../components/tiles/tile-component";
import { ExpressionContentModelType } from "./expression-content";
import { CustomEditableTileTitle } from "../../components/tiles/custom-editable-tile-title";
import { replaceKeyBinding } from "./expression-tile-utils";
import { useUIStore } from "../../hooks/use-stores";
import { useToolbarTileApi } from "../../components/tiles/hooks/use-toolbar-tile-api";
import { ExpressionToolbar } from "./expression-toolbar";
import { MathfieldElement as MFE } from "mathlive";
import "./expression-tile.scss";

type CustomElement<T> = Partial<T & DOMAttributes<T>>;
declare global {
  namespace JSX { // eslint-disable-line @typescript-eslint/no-namespace
    interface IntrinsicElements {
      ["math-field"]: CustomElement<MathfieldElementAttributes>;
    }
  }
}

const undoKeys = ["cmd+z", "[Undo]", "ctrl+z"];

export const ExpressionToolComponent: React.FC<ITileProps> = observer((props) => {
  const { onRegisterTileApi, onUnregisterTileApi } = props;
  const content = props.model.content as ExpressionContentModelType;
  const mf = useRef<MathfieldElement>(null);
  const trackedCursorPos = useRef<number>(0);
  const ui = useUIStore();

  if(mf.current && ui) {
    mf.current.addEventListener("focus", () => ui.setSelectedTileId(props.model.id));
  }

  if (mf.current?.keybindings){
    undoKeys.forEach((key: string) => {
      mf.current && replaceKeyBinding(mf.current.keybindings, key, "");
    });
  }

  useEffect(() => {
    // when we change model via undo button, we need to update mathfield
    const disposer = onSnapshot((content as any), () => {
      if (mf.current?.getValue() === content.latexStr) return;
      mf.current?.setValue(content.latexStr, {suppressChangeNotifications: true});
      if (mf.current?.position) mf.current.position = trackedCursorPos.current - 1;
    });
    return () => disposer();
  }, [content]);

  const handleChange = (e: FormEvent<MathfieldElementAttributes>) => {

    trackedCursorPos.current =  mf.current?.position || 0;
    content.setLatexStr((e.target as any).value);
    // console.log("| handleChange! 🤷🏽‍♂️\n", "\n\n frames.MathfieldElement", frames.MathfieldElement, "\n\nmf value:\n", mf.current?.getValue(), "\n\nlatexStr:\n", content.latexStr, "\n\nthe element:\n", e.target, "\n\nthe event target value:\n", (e.target as any).value, "\n\nthe mf element:\n", mf.current);
    /**
     * OK SO we may have to progmatically swap in a new mathfield element with the correct values
     * with something like this:
     * let mfe = new MathfieldElement();
     * // set the value
     * // swap it in
     * // but we only want to do that if
     * // and we are in the iframe (and maybe if the value is different?)
     * // so lets do this
     * 1. check if we are in the iframe
     * 2. swap in a new mathfield
     */

    // test frames.location for the substring "cms-editor.html?"
    const isEditor = frames.location.href.includes("cms-editor.html?");
    if (isEditor) {
      const mmf = document.querySelector("math-field") as MathfieldElement;
      console.log("| math-field found in dom:\n", mmf);
      console.log("| math-field shadow dom:", mmf?.shadowRoot);
      mmf.executeCommand(['insert', '(#0)']); // interestingly, this works
    }
  };

  const toolbarProps = useToolbarTileApi({
    id: props.model.id,
    enabled: !props.readOnly,
    onRegisterTileApi,
    onUnregisterTileApi
  });

  return (
    <div className="expression-tool">
      <ExpressionToolbar
        model={props.model}
        documentContent={props.documentContent}
        tileElt={props.tileElt}
        {...toolbarProps}
        mf={mf}
      />
      <div className="expression-title-area">
        <CustomEditableTileTitle
          model={props.model}
          onRequestUniqueTitle={props.onRequestUniqueTitle}
          readOnly={props.readOnly}
        />
      </div>
      <div className="expression-math-area">
        <math-field
          ref={mf}
          value={content.latexStr}
          onInput={handleChange}
          // MathLive only interprets undefined as false
          readOnly={props.readOnly === true ? true : undefined}
        />
      </div>
    </div>
  );
});
ExpressionToolComponent.displayName = "ExpressionToolComponent";
