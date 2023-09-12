export const kNumberlineTileType = "Numberline";
export const kNumberlineTileDefaultHeight = 170;

export const kNumberLineContainerHeight = 120;
export const yMidPoint = (kNumberLineContainerHeight / 2);

export const kTitleHeight = 50; // Corresponds to .numberline-title height in numberline-tile.scss
export const kContainerWidth = 0.93; // - container should take up 93% of tileWidth so that axis stretches across 90%;
                                     // - this number should match the "width" attribute in numberline-tile.scss for
                                     // the class .numberline-tool-container

export const kBoundingBoxOffset = -1;

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

export const maxNumSelectedPoints = 1; //this may change

export const kArrowheadOffset = -3;
export const kArrowheadTop = 53;

//--------- Numberline Circle constants ---------------------------------------------------------------
export const innerPointRadius = 5;
export const outerPointRadius = 9;
export const kPointButtonRadius = 16;
