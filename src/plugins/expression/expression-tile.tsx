import { observer } from "mobx-react";
import React, { DOMAttributes, useEffect, useRef } from "react";
import "mathlive"; // separate static import of library for initialization to run
// eslint-disable-next-line no-duplicate-imports
import type { MathfieldElementAttributes, MathfieldElement, Selection, Range } from "mathlive";
import { ITileProps } from "../../components/tiles/tile-component";
import { ExpressionContentModelType } from "./expression-content";
import { CustomEditableTileTitle } from "../../components/tiles/custom-editable-tile-title";

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

  const handleChange = (e: any) => {
    content.setLatexStr(e.target.value);
  };


  (function evaluateInputField () {
    const cursorPosition = mathfieldRef.current?.position;
    console.log(`---------evaluateInputField-------at position: ${cursorPosition}`);
    let currentChar = "";
    let leftChar = "";
    if (cursorPosition){
      currentChar = mathfieldRef.current?.getValue(cursorPosition - 1, cursorPosition);
      const leftCharStart = cursorPosition - 2;
      const leftCharEnd = cursorPosition - 1;
      // console.log("StartIndex:", leftCharStart);
      // console.log("EndIndex:", leftCharEnd);
      if (leftCharStart >= 0){
        leftChar = mathfieldRef.current?.getValue(leftCharStart, leftCharEnd);
      }
    }
    console.log("currentChar:", currentChar);
    console.log("leftChar:", leftChar);
    switch (currentChar){
      case "+":
      case "-":
      case "\\cdot":
      case "=":
        if (mathfieldRef.current?.selection){
          if (cursorPosition === 1 && leftChar === ""){
            // console.log("selection:", mathfieldRef.current.selection);
            mathfieldRef.current.selection = [0,0] as any; //TODO find a better typed way
            // mathfieldRef.current?.insert("\\placeholder", {insertionMode: "replaceSelection"});
            mathfieldRef.current?.insert("\\placeholder");
            mathfieldRef.current.selection = [2,2] as any;
            mathfieldRef.current?.insert("\\placeholder");
          } else {
            console.log("we aren't at position 1 and our left character is non empty");
            mathfieldRef.current.selection = [cursorPosition, cursorPosition] as any;
            mathfieldRef.current?.insert("\\placeholder");
          }
        }
        break;
      default:
        break;
    }
  })();





  const handleMouseUp = () => {
    console.log("------mouseUp!------");
    const selectionArray = mathfieldRef.current?.selection.ranges[0];
    if (selectionArray){
      const startIndex = selectionArray[0];
      const endIndex = selectionArray[1];
      console.log("range selected:", startIndex, "-----", endIndex);
    }
  };



  // This is an example of how we can access mathfield api
  // NOTE for future features - example usage of mathfield api
  const exampleAction = () => {
    console.log("maaaybe: ", content, mathfieldRef);
    mathfieldRef.current?.setValue(`42\\frac12`);
    mathfieldRef.current?.applyStyle({color: "red"}, { range: [0, 2] });
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
          // onMouseDown={evaluateInputField}
          // onClick={evaluateInputField}
          // onMouseUp={handleMouseUp}
        />
      </div>
    </div>
  );
});
ExpressionToolComponent.displayName = "ExpressionToolComponent";
