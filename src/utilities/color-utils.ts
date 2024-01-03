import colorString from "color-string";

export const lightenColor = (color: string, pct = 0.5) => {
  const rgb = colorString.get.rgb(color);
  if (!rgb || !isFinite(pct) || (pct < 0) || (pct > 1)) return color;
  rgb[0] += Math.round(pct * (255 - rgb[0]));
  rgb[1] += Math.round(pct * (255 - rgb[1]));
  rgb[2] += Math.round(pct * (255 - rgb[2]));
  return colorString.to.hex(rgb);
};

export const luminanceRGB = (r: number, g: number, b: number, scale = 1) => {
  // https://en.wikipedia.org/wiki/Relative_luminance
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) / scale;
};

export const luminanceColorString = (color: string) => {
  const rgb = colorString.get.rgb(color);
  return rgb && luminanceRGB(rgb[0], rgb[1], rgb[2], 255);
};

export const isLightColorRequiringContrastOffset = (color?: string) => {
  const kLightLuminanceThreshold = 0.85;
  const luminance = color && luminanceColorString(color);
  return (luminance != null) && (luminance >= kLightLuminanceThreshold);
};

export const kGraphDataBlue = "#0069ff";
export const kGraphDataOrange = "#ff9617";
export const kGraphDataGreen = "#19a90f";
export const kGraphDataRed = "#e00";
export const kGraphDataYellow = "#cbd114";
export const kGraphDataPurple = "#d51eff";
export const kGraphDataIndigo = "#6b00d2";
export const clueGraphColors = [
  kGraphDataBlue, kGraphDataOrange, kGraphDataGreen, kGraphDataRed,
  kGraphDataYellow, kGraphDataPurple, kGraphDataIndigo
];

/*
  The following list of 20 colors are maximally visually distinct from each other.
  See http://eleanormaclure.files.wordpress.com/2011/03/colour-coding.pdf
  and https://stackoverflow.com/questions/470690/how-to-automatically-generate-n-distinct-colors

  The first seven are also visually distinct for people with defective color vision
*/
export const kellyColors = [
  '#FF6800', '#803E75', '#A6BDD7', '#FFB300',
  '#C10020', '#CEA262', '#817066', '#007D34',
  '#00538A', '#F13A13', '#53377A', '#FF8E00',
  '#B32851', '#F4C800', '#7F180D', '#93AA00',
  '#593315', '#232C16', '#FF7A5C', '#F6768E'
];

export const defaultPointColor = '#E6805B';
export const defaultStrokeWidth = 1;
export const missingColor = '#888888';
export const defaultStrokeColor = '#FFFFFF';
export const defaultBackgroundColor = '#FFFFFF';

export const selectedStrokeWidth = 1; //1 for now - may change such that the stroke-width increases when selected
export const selectedOuterCircleFillColor = "#14F49E";
export const selectedOuterCircleStrokeColor = "#FFFFFF";

