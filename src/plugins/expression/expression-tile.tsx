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
  const content = props.model.content as ExpressionContentModelType;
  const mf = useRef<MathfieldElement>(null);
  const toolRef = useRef<HTMLDivElement>(null);
  const trackedCursorPos = useRef<number>(0);

  if(mf.current) {
    mf.current.addEventListener("click", (e: any) => {
      console.log("| 👤 shadow click!", e);
      // Each of 3 methods below works to trigger click that is registered
      // by toolRef and body, but does not affect other tile toolbar as normal clicks do
      // 1 document.body.click();
      // 2 toolRef.current?.click();
      // 3 const mockClick = new Event("click", {bubbles: true, cancelable: true, composed: true});
      //   toolRef.current?.dispatchEvent(mockClick);
    });
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
  };

  return (
    <div className="expression-tool" ref={toolRef} onClick={() => console.log("| 🔨 toolRef click!")}>
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
