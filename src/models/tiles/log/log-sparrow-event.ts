

import { LogEventName } from "../../../lib/logger-types";
import { Logger } from "../../../lib/logger";
import { IArrowAnnotation } from "src/models/annotations/arrow-annotation";

//creation
//deletion
//change label/title
//show_hide

// SPARROW_CREATION,
// SPARROW_DELETION,
// SPARROW_TITLE_CHANGE,
// SPARROW_HIDE_SHOW,



//1 log sparrow creation
//1.1 - tile  type for start and end points
//1 - when created log sparrow id.
// 1.1 TODO: we can change the syntax to sparrowSourceType and sparrowTargetType
//but also include the ID of the tile from source and target

function processSparrowEventParams(arrow: IArrowAnnotation){
  return {
    arrowID: arrow.id,
    sourceObject: arrow.sourceObject,
    targetObject: arrow.targetObject
  };
}

export function logSparrowCreation(event: LogEventName, arrow: IArrowAnnotation){
  console.log("logSparrowCreation with arrow:", arrow);
  const params = processSparrowEventParams(arrow);
  console.log("params:", params);
  Logger.log(event, params);
}


//Question: Should deletion and creation be the same function?

export function logSparrowHideShow(){
  Logger.log(LogEventName.SPARROW_HIDE_SHOW);
}
