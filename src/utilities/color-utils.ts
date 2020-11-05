import colorString from "color-string";

export const luminanceRGB = (r: number, g: number, b: number, scale = 1) => {
  // https://en.wikipedia.org/wiki/Relative_luminance
  return (r * 0.2126 + g * 0.7152 + b * 0.0722) / scale;
};

export const luminanceColorString= (color: string) => {
  const rgb = colorString.get.rgb(color);
  return rgb && luminanceRGB(rgb[0], rgb[1], rgb[2], 255);
};
