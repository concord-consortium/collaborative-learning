import { observer } from "mobx-react";
import React, { DOMAttributes, useRef, useEffect } from "react";
import { onSnapshot } from "mobx-state-tree";
import "mathlive"; // separate static import of library for initialization to run
// eslint-disable-next-line no-duplicate-imports
import type { MathfieldElementAttributes, MathfieldElement } from "mathlive";
import { ITileProps } from "../../components/tiles/tile-component";
import { ExpressionContentModelType } from "./expression-content";
import { CustomEditableTileTitle } from "../../components/tiles/custom-editable-tile-title";
import { replaceKeyBinding } from "./expression-utils";

import "./expression-tile.scss";

type CustomElement<T> = Partial<T & DOMAttributes<T>>;
declare global {
  namespace JSX { // eslint-disable-line @typescript-eslint/no-namespace
    interface IntrinsicElements {
      ["math-field"]: CustomElement<MathfieldElementAttributes>;
    }
  }
}

export const ExpressionToolComponent: React.FC<ITileProps> = observer((props) => {
  const content = props.model.content as ExpressionContentModelType;
  const mathfieldRef = useRef<MathfieldElement>(null);

  if (mathfieldRef.current?.keybindings){
    // TODO: this clobbers the default cmd+z binding, which is mapped to mathlive's undo.
    // This allows the field to re-render with the correct value, dervied from CLUE undo/history.
    // moveToMathField happens is the effect of re-render, not the fact that we passed it in here.
    replaceKeyBinding(mathfieldRef.current.keybindings, "cmd+z", "moveToMathFieldEnd");
  }

  const handleSnapshot = () => {
    const modelMatches = mathfieldRef.current?.getValue() === content.latexStr;
    if (!modelMatches) {
      mathfieldRef.current?.setValue(content.latexStr, {suppressChangeNotifications: true});
    }
  };

  useEffect(() => {
    const disposer = onSnapshot((content as any), () => {
      handleSnapshot();
    });
    return () => disposer();
  }, [content, handleSnapshot()]);

  const handleChange = (e: any) => {
    content.setLatexStr(e.target.value);
  };

  return (
    <div className="expression-tool">
      <div className="expression-title-area">
        <CustomEditableTileTitle
          model={props.model}
          onRequestUniqueTitle={props.onRequestUniqueTitle}
          readOnly={props.readOnly}
        />
      </div>
      <div className="expression-math-area">
        <math-field
          ref={mathfieldRef}
          value={content.latexStr}
          onInput={handleChange}
        />
      </div>
    </div>
  );
});
ExpressionToolComponent.displayName = "ExpressionToolComponent";
