import { observer } from "mobx-react";
import React, { DOMAttributes, useRef, useEffect, useState } from "react";
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
  const [trackedCursorSpot, setTrackedCursorSpot] = useState<any[] | undefined>([0,0]);

  if (mathfieldRef.current?.keybindings){
    replaceKeyBinding(mathfieldRef.current.keybindings, "cmd+z", "moveToMathfieldStart");
  }

  useEffect(() => {
    const disposer = onSnapshot((content as any), () => {
      handleSnapshot();
    });
    return () => disposer();
  }, [content]);

  const modelMatches = () => {
    return mathfieldRef.current?.getValue() === content.latexStr;
  };

  const handleSnapshot = () => {
    if (!modelMatches()) {
      mathfieldRef.current?.setValue(content.latexStr, {suppressChangeNotifications: true});
      if (mathfieldRef.current){
        console.log("| set cursor to this: ", trackedCursorSpot);
        console.log("| what shape? ", mathfieldRef.current.selection.ranges[0]);
        mathfieldRef.current.selection.ranges[0] = trackedCursorSpot as any;
      }
    }
  };

  const handleChange = (e: any) => {
    console.log("| setting trackedCursorSpot to: ", mathfieldRef.current?.selection.ranges[0])
    setTrackedCursorSpot(mathfieldRef.current?.selection.ranges[0]);
    content.setLatexStr(e.target.value);
    console.log("| but maybe it did not work:", trackedCursorSpot);
  };

  const handleKeyDown = (e: any) => {
    if ((e.ctrlKey || e.metaKey) && e.keyCode === 90) {
      //console.log("| 3 cursor?", mathfieldRef.current?.selection, e);
    }
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
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
});
ExpressionToolComponent.displayName = "ExpressionToolComponent";
