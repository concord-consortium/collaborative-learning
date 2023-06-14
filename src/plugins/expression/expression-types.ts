export const kExpressionTileType = "Expression";
export const kExpressionDefaultHeight = 100;

export type SelectStatus = "empty" | "all" | "some" | "cursor" | undefined;
export type InsertModeString = "replaceAll" | "insertAfter" | "replaceSelection";

const ph = "\\placeholder{}";
const divSign = "\\div";
const multSign = "\\times";
const emptyFrac = `\\frac{${ph}}{${ph}}}`;
const mixedFrac = `${ph}\\frac{${ph}}{${ph}}`;
const divisionEmpty = `${ph}${divSign}${ph}`;
const multEmpty = `${ph}${multSign}${ph}`;

export const latexStrings = {
  ph,
  emptyFrac,
  mixedFrac,
  divSign,
  divisionEmpty,
  multSign,
  multEmpty
};

// Note: #@ token replaced by any highlighted value, otherwise placeholder
export const expressionButtonsList = [
  {
    name: "divisionSymbol",
    title: "Division Symbol",
    className: "division-symbol",
    baseLatex: divSign,
    isBinaryOperator: true
  },
  {
    name: "mixedFraction",
    title: "Mixed Fraction",
    className: "mixed-fraction",
    baseLatex: `#@\\frac{${ph}}{${ph}}`,
    isBinaryOperator: false
  }
];
