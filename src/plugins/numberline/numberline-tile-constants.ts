export const kNumberlineTileType = "Numberline";
export const kNumberlineTileDefaultHeight = 170;

export const kNumberLineContainerHeight = 120;
export const yMidPoint = (kNumberLineContainerHeight / 2);

export const kTitleHeight = 50; // Corresponds to .numberline-title height in numberline-tile.scss
export const kContainerWidth = 0.93; // - container should take up 93% of tileWidth so that axis stretches across 90%;
                                     // - this number should match the "width" attribute in numberline-tile.scss for
                                     // the class .numberline-tool-container

//--------- Numberline Axis constants -----------------------------------------------------------------
export const kAxisWidth = 0.9;
export const kAxisStyle = "transform: translate(0px, 60px)";

export const tickWidthZero = "2px";
export const tickWidthDefault = "1.5px";
export const tickHeightDefault = "14px";
export const tickStyleDefault = "transform: translateY(-7px)";

export const tickTextTopOffsetDefault = "15px";
export const tickTextTopOffsetMinAndMax = "0px";


export const numberlineYBound = 15;  //# of pixels above and below numberline to determine if mouse is inBoundingBox
export const maxNumSelectedPoints = 1; //this may change

export const kArrowheadOffset = -17;
export const kArrowheadTop = 53;

//--------- Numberline Circle constants ---------------------------------------------------------------
export const innerPointRadius = 5;
export const outerPointRadius = 9;
export const kPointButtonRadius = 11;

//--------- Point Value Label constants ---------------------------------------------------------------
export const kValueLabelHeight = 20;
export const kValueLabelPadding = 5;
export const kValueLabelOffsetY = -43; // Distance above the point (33px + half label height)

//--------- Keyboard Accessibility constants ----------------------------------------------------------
export const kKeyboardMoveStep = 0.1; // Amount to move point per arrow key press
export const kKeyboardMoveStepLarge = 1.0; // Amount to move with Shift+arrow
