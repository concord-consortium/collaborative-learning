import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { getImageData } from "./get-image-data";
import { getNetworkDocument } from "./get-network-document";
import { getNetworkResources } from "./get-network-resources";
import { publishSupport } from "./publish-support";

admin.initializeApp({
  databaseURL: "https://collaborative-learning-ec215.firebaseio.com/"
});

/*
 * getImageData
 *
 * Retrieves the image data associated with a particular internal image url.
 * The _v1 suffix allows us to version the API if necessary moving forward.
 */
export const getImageData_v1 = functions.https.onCall(getImageData);

/*
 * publishSupport
 *
 * Publishes the provided document as a multi-class support.
 * The _v1 suffix allows us to version the API if necessary moving forward.
 */
export const publishSupport_v1 = functions.https.onCall(publishSupport);

/*
 * getNetworkDocument
 *
 * Retrieves the contents of a document accessible to a teacher via the teacher network.
 * The _v1 suffix allows us to version the API if necessary moving forward.
 */
export const getNetworkDocument_v1 = functions.https.onCall(getNetworkDocument);

/*
 * getNetworkResources
 *
 * Retrieves the list of resources (documents) available to a teacher via the teacher network.
 * The _v1 suffix allows us to version the API if necessary moving forward.
 */
export const getNetworkResources_v1 = functions.https.onCall(getNetworkResources);
