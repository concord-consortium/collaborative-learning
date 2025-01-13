export const clueDataColors = [
  '#0069ff', // blue
  '#ff9617', // orange
  '#19a90f', // green
  '#ee0000', // red
  '#cbd114', // yellow
  '#d51eff', // purple
  '#6b00d2', // indigo
  '#ffffff', // white
  '#f1d9ae', // peach
  '#a5a5a5', // gray
  '#915e3b', // brown
  '#000000'  // black
];

export const hexToRgb = (hex) => {
  hex = hex.replace(/^#/, "");
  let r, g, b, a;

  if (hex.length === 3 || hex.length === 4) {
    // shorthand hex format (#RGB or #RGBA)
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
    a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
  } else if (hex.length === 6 || hex.length === 8) {
    // standard hex format (#RRGGBB or #RRGGBBAA)
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
    a = hex.length === 8 ? parseInt(hex.substring(6, 8), 16) / 255 : 1;
  } else {
    throw new Error("Invalid hex color.");
  }

  if (a === 1) {
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }
};
