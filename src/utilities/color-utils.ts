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
