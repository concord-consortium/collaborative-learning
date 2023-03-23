import CMS from "netlify-cms-app";

import { ClueControl } from "./clue-control";
import { JsonControl } from "./json-control";

export function initCMS() {
  CMS.registerWidget("clue", ClueControl);
  CMS.registerWidget("json", JsonControl);
  CMS.init();
}
