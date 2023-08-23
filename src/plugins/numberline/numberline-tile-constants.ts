import { scaleLinear } from "d3";

export const kNumberlineTileType = "Numberline";
export const kNumberlineTileDefaultHeight = 170;

export const kNumberLineContainerHeight = 120;
export const kContainerWidth = 0.93; // - container should take up 93% of tileWidth so that axis stretches across 90%;
                                     // - this number should match the "width" attribute in numberline-tile.scss for
                                     // the class .numberline-tool-container

//--------- Numberline Axis constants -----------------------------------------------------------------
export const kAxisWidth = 0.9;
export const kAxisStyle = "transform: translate(0px, 60px)";

export const tickWidthZero = "3px";
export const tickWidthDefault = "1px";

export const tickHeightZero = "20px";
export const tickHeightDefault = "6px";

export const tickStyleZero = "transform: translateY(-10px)";
export const tickStyleDefault = "";

export const numberlineDomainMin = -5;  //max and min of the numberline
export const numberlineDomainMax = 5;

export const numberlineYBound = 15;  //# of pixels above and below numberline to determine if mouse is inBoundingBox
export const numberlineXHoverBound = 5; //# of pixels left and irhgt of a point to determine if it's hovering over

//--------- Numberline Circle constants ---------------------------------------------------------------
export const innerPointRadius = 5;
export const outerPointRadius = 9;


//------------Utility Functions -----------------------------------------------------------------------
export function createXScale(axisWidth: number){
  return scaleLinear()
          .domain([numberlineDomainMin, numberlineDomainMax])
          .range([0, axisWidth]);
}









