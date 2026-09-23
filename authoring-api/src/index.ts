import {runWith} from "firebase-functions";
import admin from "firebase-admin";
import express, {Request, Response, NextFunction} from "express";
import cors from "cors";
import {DecodedIdToken} from "firebase-admin/auth";
import {Octokit} from "@octokit/rest";
import {createHash} from "crypto";

import pullUnit from "./routes/pull-unit";
import getContent from "./routes/get-content";
import getRemoteBranches from "./routes/get-remote-branches";
import getRemoteUnits from "./routes/get-remote-units";
import getPulledBranches from "./routes/get-pulled-branches";
import getPulledUnits from "./routes/get-pulled-units";
import getPulledFiles from "./routes/get-pulled-files";
import putContent from "./routes/put-content";
import putImage from "./routes/put-image";
import getImageUsages from "./routes/get-image-usages";
import deleteImage from "./routes/delete-image";
import renameImage from "./routes/rename-image";
import getRawContent from "./routes/get-raw-content";
import deleteUnit from "./routes/delete-unit";
import pushUnit from "./routes/push-unit";
import generateUnitSummary from "./routes/generate-unit-summary";
import unitSummaryStatus from "./routes/unit-summary-status";

import {AuthorizedRequest} from "./helpers/express";
import {owner, repo} from "./helpers/github";

// the TypeScript type definition for DecodedIdToken does not include the name property,
// even though it is present in the actual decoded token returned by Firebase Admin SDK
type DecodedIdTokenWithName = DecodedIdToken & {
  name: string;
};

// use a real identity here so that GitHub commits have a real name associated with them
const fakeEmulatorDecodedToken = {
  name: "Doug Martin",
  email: "dmartin@concord.org",
  firebase: {
    sign_in_provider: "github.com",
  },
} as DecodedIdTokenWithName;

const tokenCache = new Map<string, {isCollaborator: boolean, expires: Date}>();

const getCacheExpirationDate = () => {
  const now = new Date();
  const tokenCacheExpirationMs = 15 * 60 * 1000; // 15 minutes
  return new Date(now.getTime() + tokenCacheExpirationMs);
};

admin.initializeApp();

// Doug's old zoopdoop.com email is what Firebase auth sets as the GitHub provider email in the
// generated auth token even though it is not used on GitHub anymore. Leslie's mit.edu and Teale's
// gmail addresses are what they each use for GitHub.
const otherCCEmailAddresses = ["doug@zoopdoop.com", "lbond@alum.mit.edu", "fristoe@gmail.com"];
const isCCEmail = (email: string): boolean =>
  email.endsWith("@concord.org") || otherCCEmailAddresses.includes(email);

const isUserAuthorized = async (decodedToken: DecodedIdToken, gitHubToken: string): Promise<boolean> => {
  const {email, firebase} = decodedToken;

  // make sure the user signed in using GitHub and has an email associated with their account
  if (firebase?.sign_in_provider !== "github.com" || !email) {
    return false;
  }

  // CC folks get access to everything
  if (isCCEmail(email)) {
    return true;
  }

  // clear out any expired cache entries to avoid unbounded growth
  const now = new Date();
  for (const [tokenHash, entry] of tokenCache) {
    if (entry.expires <= now) {
      tokenCache.delete(tokenHash);
    }
  }

  // Keyed by a hash rather than the raw token, so the token itself isn't retained in memory
  // (e.g. in a heap snapshot) any longer than the request that carried it needs. A cryptographic
  // digest, not shared/hash-string.ts's cheap djb2 -- a cache hit skips the real GitHub check, so a
  // collision here would let one token's cached result authorize a different one.
  const cacheKey = createHash("sha256").update(gitHubToken).digest("hex");

  // if we have a cached token and it is still valid (since it wasn't cleared above),
  // use that to determine authorization based on whether the user is a collaborator
  const entry = tokenCache.get(cacheKey);
  if (entry) {
    return entry.isCollaborator;
  }

  // check if the user is a collaborator in the CLUE curriculum repository
  let isCollaborator = false;
  try {
    const octokit = new Octokit({auth: gitHubToken});

    // get the username associated with the token
    const {data} = await octokit.request("GET /user");
    const username = data?.login;
    if (!username) {
      console.log("Could not get GitHub username associated with the token.");
      return false;
    }

    // This API call checks if the user is a collaborator
    // If the response status is 204 No Content, the user is a collaborator.
    // The Octokit client handles this by returning the response object
    // without throwing an error.
    const response = await octokit.rest.repos.checkCollaborator({owner, repo, username});
    isCollaborator = (response.status === 204);
  } catch (error) {
    console.log(`Error checking if user is a collaborator on GitHub: ${error}`);
    isCollaborator = false;
  }

  tokenCache.set(cacheKey, {
    isCollaborator,
    expires: getCacheExpirationDate(),
  });

  return isCollaborator;
};

export const authenticateAndAuthorize = async (req: Request, res: Response, next: NextFunction) => {
  // don't require auth for rawContent endpoint
  if (req.path.startsWith("/rawContent/")) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("Unauthorized: No authorization header provided.");
  }
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No bearer token provided in authorization header.");
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    // in order to allow using the emulator with real github tokens
    // (since the emulator can't emulate the GitHub auth flow), allow skipping auth validation
    // by setting DANGEROUSLY_SKIP_AUTH_TOKEN_VALIDATION=true in the .env.local file
    // DO NOT USE THIS IN PRODUCTION
    const decodedToken = process.env.DANGEROUSLY_SKIP_AUTH_TOKEN_VALIDATION === "true" ?
      fakeEmulatorDecodedToken :
      await admin.auth().verifyIdToken(idToken);

    const gitHubToken = req.query.gitHubToken?.toString();
    if (!gitHubToken) {
      return res.status(401).send("Unauthorized: No GitHub token provided.");
    }
    (req as AuthorizedRequest).gitHubToken = gitHubToken;

    if (await isUserAuthorized(decodedToken, gitHubToken)) {
      (req as AuthorizedRequest).decodedToken = decodedToken;
      return next();
    } else {
      return res.status(403).send("Unauthorized: You don't have authoring permissions.");
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).send("Unauthorized: Invalid or expired token.");
  }
};

// CC-staff-only. Applied directly to those routes below, not matched against req.path -- Express's
// own router decides which routes this middleware chain runs for, so it can't be bypassed by a URL
// variant (different case, a trailing slash) that still reaches the same handler.
const requireCCAccess = (req: Request, res: Response, next: NextFunction) => {
  const email = (req as AuthorizedRequest).decodedToken.email;
  if (email && isCCEmail(email)) {
    return next();
  }
  return res.status(403).send("Unauthorized: You don't have authoring permissions.");
};

const app = express();

// increase the default body size limit to 5mb to allow for large image uploads
app.use(express.json({limit: "5mb"}));

// enable CORS for all origins - we lock down access via authentication/authorization
app.use(cors());
app.use((req, res, next) => {
  // Set headers for all requests
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    return res.status(200).json({});
  }

  return next();
});
app.use(authenticateAndAuthorize);

// test endpoint to verify authentication is working
app.get("/whoami", (req, res) => res.send((req as AuthorizedRequest).decodedToken));

app.post("/pullUnit", requireCCAccess, pullUnit);
app.post("/pushUnit", pushUnit);

app.post("/deleteUnit", deleteUnit);

app.get("/getContent", getContent);
app.post("/putContent", putContent);

app.post("/putImage", putImage);
app.get("/getImageUsages", getImageUsages);
app.post("/deleteImage", deleteImage);
app.post("/renameImage", renameImage);

app.get("/getRemoteBranches", getRemoteBranches);
app.get("/getRemoteUnits", getRemoteUnits);

app.get("/getPulledBranches", getPulledBranches);
app.get("/getPulledUnits", getPulledUnits);
app.get("/getPulledFiles", getPulledFiles);

// NOTE: app.use() is used here to allow for paths with slashes (i.e. /rawContent/:branch/:unit/*)
app.use("/rawContent", getRawContent);

app.post("/generateUnitSummary", requireCCAccess, generateUnitSummary);
app.get("/unitSummaryStatus", unitSummaryStatus);

// One Express app serves every route above as one function, so this timeout, memory, and secret
// binding apply to all of them, not just the generation route that needs them. 540s is the
// 1st-gen ceiling.
export const api = runWith({
  timeoutSeconds: 540,
  memory: "512MB",
  secrets: ["OPENAI_UNIT_SUMMARY_API_KEY"],
}).https.onRequest(app);
