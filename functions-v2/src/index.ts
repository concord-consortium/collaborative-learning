import * as admin from "firebase-admin";
export {onUserDocWritten} from "./on-user-doc-written";
export {atMidnight} from "./at-midnight";
export {onAnalyzableDocWritten} from "./on-analyzable-doc-written";

admin.initializeApp();
