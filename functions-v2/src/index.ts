import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

export const updateClassDocNetworksOnUserChange =
  onDocumentWritten("{root}/{space}/users/{userId}", (event) => {
    logger.info("User updated", event.document);
  });
