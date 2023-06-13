export const kExpressionTileType = "Expression";
export const kExpressionDefaultHeight = 100;

export type SelectStatus = "empty" | "all" | "some" | "cursor" | undefined;
export type InsertModeString = "replaceAll" | "insertAfter" | "replaceSelection";

const ph = "\\placeholder{}";
const emptyFrac = `\\frac{${ph}}{${ph}}}`;
const mixedFrac = `${ph}\\frac{${ph}}{${ph}}`;
const divSign = "\\div";
const multSign = "\\times";
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

// TODO - how to define icons here without extra map step, see "icon" below
export const expressionButtonsList = [
  {
    name: "divisionSymbol",
    title: "Division Symbol",
    className: "division-symbol",
    baseLatex: divSign
  },
  {
    name: "mixedFraction",
    title: "Mixed Fraction",
    className: "mixed-fraction",
    baseLatex: mixedFrac,
    // icon: MixedFractionIcon // can't seem to pass this
  },
  {
    name: "mixedFractionSmart",
    title: "Mixed Fraction Smart",
    className: "mixed-fraction-smart",
    baseLatex: `$#@\\frac{${ph}}{${ph}}`
    // icon: MixedFractionIcon // can't seem to pass this
  },
];
