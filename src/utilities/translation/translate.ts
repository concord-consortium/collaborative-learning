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

export const t = (key: string, params?: Record<string, unknown>) => {
  const translation = translations[key] || key;
  return translation;
};

export default t;
