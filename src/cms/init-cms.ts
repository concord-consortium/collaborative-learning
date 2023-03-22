import CMS from "netlify-cms-app";

import { JsonControl } from "./json-control";

export function initCMS() {
  CMS.registerWidget("json", JsonControl);
  CMS.init();
}
