const translations: Record<string, string> = {
  "DG.AxisView.emptyGraphCue": "Click here to choose data to plot",
  "DG.CellLinearAxisView.lowerPanelTooltip": "Drag to change axis lower bound",
  "DG.CellLinearAxisView.midPanelTooltip": "Drag to translate axis scale",
  "DG.CellLinearAxisView.upperPanelTooltip": "Drag to change axis upper bound",
  "DG.DataDisplayMenu.removeAttribute_x": "Remove X: %@", // %@ = attribute name
  "DG.DataDisplayMenu.removeAttribute_y": "Remove Y: %@", // %@ = attribute name
  "DG.DataDisplayMenu.removeAttribute_y2": "Remove Y: %@", // %@ = attribute name
  "DG.DataDisplayMenu.removeAttribute_legend": "Remove Legend: %@", // %@ = attribute name
  "DG.DataDisplayMenu.removeAttribute_top": "Remove Side-by-side Layout by %@", // %@ = attribute name
  "DG.DataDisplayMenu.removeAttribute_right": "Remove Vertical Layout by %@", // %@ = attribute name
  "DG.DataDisplayMenu.treatAsCategorical": "Treat as Categorical",
  "DG.DataDisplayMenu.treatAsNumeric": "Treat as Numeric"
};

// supports named variables (e.g. %{foo}) and SproutCore numbered variables (e.g. %@1)
const varRegExp = /%({\s*([^}\s]*)\s*}|@(\d*))/g;

type VarValue = string | number | undefined
interface ITranslateOptions {
  lang?: string
  count?: number
  vars?: Record<string, VarValue> | Array<VarValue> // CODAP v2 uses positional replacement
}

export const translate = (key: string, options?: ITranslateOptions) => {
  const namedVars = Array.isArray(options?.vars) ? {} : options?.vars || {};
  const posVars = Array.isArray(options?.vars) ? options?.vars || [] : [];
  // default to English if we don't have a translated string
  // default to the key if we don't have an English string
  const translation = translations[key] || key;
  // match: full match (e.g. "%{foo}", "%@", "%@1")
  // param: full match without % (e.g. "{foo}", "@", "@1")
  // varName: name in case of named variables (e.g. "foo", null, null)
  // varPos: position in case of positional variables (e.g. null, null, "1")
  let matchIndex = -1;
  function replaceFn(match: string, param: string | null, varName: string | null, varPos: string | null) {
    const valueStr = (value: VarValue) => value == null ? "" : `${value}`;
    ++matchIndex;
    if (varName) {
      !Object.prototype.hasOwnProperty.call(namedVars, varName) &&
        console.warn(`translate: no replacement for "${varName}" in "${key}"`);
      return valueStr(namedVars[varName]);
    }
    if (varPos) {
      const varIndex = +varPos - 1
      ;(varIndex >= posVars.length) &&
        console.warn(`translate: no replacement for "${varPos}" in "${key}"`);
      return valueStr(posVars[varIndex]);
    }
    if (param === "@") {
      (matchIndex >= posVars.length) &&
        console.warn(`translate: no replacement for "@" at index ${matchIndex + 1} in "${key}"`);
      return valueStr(posVars[matchIndex]);
    }
    // should only get here for pathological cases (e.g. "%{}")
    console.warn(`translate: no replacement for variable match "${match}" in "${key}"`);
    return "";
  }
  return translation.replace(varRegExp, replaceFn);
};

export default translate;
