import {google} from "googleapis";

// Load the service account key JSON file.
import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };

/**
 * Get a list of class keys for a base path.
 *
 * This is tricky to fetch because by the Firebase Javascript api will return all of
 * the content below a path. CLUE stores all of the documents under the class path.
 * Instead this function uses the Firebase REST api to make a "shallow" request for
 * the classes.
 *
 * @param firebaseBasePath base path for the portal or demo space to get class from
 * @returns
 */
export async function getClassKeys(firebaseBasePath: string) {
  // Define the required scopes.
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/firebase.database"
  ];

  console.log("Creating Google JWT Client");

  // Authenticate a JWT client with the service account.
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    undefined,
    serviceAccount.private_key,
    scopes
  );

  console.log("Generating an access token");

  // Use the JWT client to generate an access token.
  const accessToken = await new Promise<string|undefined>((resolve, reject) => {
    jwtClient.authorize(function(error, tokens) {
      if (error || !tokens) {
        console.log("Error making request to generate access token:", error);
        reject();
      } else if (tokens.access_token === null) {
        console.log("Provided service account does not have permission to generate access tokens");
        reject();
      } else {
        resolve(tokens.access_token);
      }
    });
  });

  const accessTime = Date.now();

  const databaseURL = "https://collaborative-learning-ec215.firebaseio.com";

  const fetchURL = `${databaseURL}${firebaseBasePath}.json?shallow=true`;
  console.log(`Fetching URL: ${fetchURL}`);

  const response = await fetch(fetchURL,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  const classKeys = await response.json() as Record<string, boolean>;
  const fetchTime = Date.now();

  console.log(`*** Found ${Object.keys(classKeys).length} classes ***`);

  return {classKeys, accessTime, fetchTime};
}
