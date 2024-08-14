import { config } from "dotenv";
import { getScriptRootFilePath } from "./script-utils.js";

config({ path: getScriptRootFilePath(".env")});
