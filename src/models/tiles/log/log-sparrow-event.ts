

import { LogEventName } from "../../../lib/logger-types";
import { Logger } from "../../../lib/logger";

//creation
//deletion
//change label/title
//show_hide

// SPARROW_CREATION,
// SPARROW_DELETION,
// SPARROW_TITLE_CHANGE,
// SPARROW_HIDE_SHOW,

interface IContext extends Record<string, any> {
  problem: string;
  teacherGuide?: string;
}

export function logSparrowCreation(context: IContext){
  Logger.log(LogEventName.SPARROW_CREATION, context);
}

export function logSparrowHideShow(){
  Logger.log(LogEventName.SPARROW_HIDE_SHOW);
}
