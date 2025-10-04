import {https} from "firebase-functions";
import admin from "firebase-admin";
import express, {Request, Response, NextFunction} from "express";
import cors from "cors";
import {DecodedIdToken} from "firebase-admin/auth";

import pullUnit from "./routes/pull-unit";
import getContent from "./routes/get-content";
import getRemoteBranches from "./routes/get-remote-branches";
import getRemoteUnits from "./routes/get-remote-units";
import getPulledBranches from "./routes/get-pulled-branches";
import getPulledUnits from "./routes/get-pulled-units";
import getPulledFiles from "./routes/get-pulled-files";
import putContent from "./routes/put-content";
import putImage from "./routes/put-image";

import {AuthorizedRequest} from "./helpers/express";
import {newOctoKit, owner, repo} from "./helpers/github";

const adminOnlyPaths = ["/pullUnit"];

const fakeEmulatorDecodedToken = {
  email: "test@concord.org",
  firebase: {
    sign_in_provider: "github.com",
  },
} as DecodedIdToken;

const tokenCache = new Map<string, {isCollaborator: boolean, expires: Date}>();

const getCacheExpirationDate = () => {
  const now = new Date();
  const tokenCacheExpirationMs = 15 * 60 * 1000; // 15 minutes
  return new Date(now.getTime() + tokenCacheExpirationMs);
};

admin.initializeApp();

const isUserAuthorized = async (path: string, decodedToken: DecodedIdToken, gitHubToken: string): Promise<boolean> => {
  const {email, firebase} = decodedToken;

  // make sure the user signed in using GitHub and has an email associated with their account
  if (firebase?.sign_in_provider !== "github.com" || !email) {
    return false;
  }

  // allow CC folks (with a concord.org email) access to everything and add a special exception
  // for Doug's old zoopdoop.com email that Firebase auth is setting as the GitHub provider email
  // in the generated auth token even though it is not used on GitHub anymore
  const isCCEmail = email.endsWith("@concord.org") || email === "doug@zoopdoop.com";
  if (isCCEmail) {
    return true;
  }

  // only allow CC folks to do admin-only operations
  if (!isCCEmail && adminOnlyPaths.includes(path)) {
    return false;
  }

  // clear out any expired cache entries to avoid unbounded growth
  const now = new Date();
  for (const [token, entry] of tokenCache) {
    if (entry.expires <= now) {
      tokenCache.delete(token);
    }
  }

  // if we have a cached token and it is still valid (since it wasn't cleared above),
  // use that to determine authorization based on whether the user is a collaborator
  const entry = tokenCache.get(gitHubToken);
  if (entry) {
    return entry.isCollaborator;
  }

  // check if the user is a collaborator in the CLUE curriculum repository
  let isCollaborator = false;
  try {
    const octokit = newOctoKit(gitHubToken);

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

  tokenCache.set(gitHubToken, {
    isCollaborator,
    expires: getCacheExpirationDate(),
  });

  return isCollaborator;
};

export const authenticateAndAuthorize = async (req: Request, res: Response, next: NextFunction) => {
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

    if (await isUserAuthorized(req.path, decodedToken, gitHubToken)) {
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

const tbd = (req: Request, res: Response) => res.status(501).send("Not implemented yet.");

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

app.post("/pullUnit", async (req, res) => pullUnit(req, res));
app.post("/pushUnit", tbd);

app.get("/getContent", getContent);
app.post("/putContent", putContent);

app.post("/putImage", putImage);

app.get("/getRemoteBranches", getRemoteBranches);
app.get("/getRemoteUnits", getRemoteUnits);

app.get("/getPulledBranches", getPulledBranches);
app.get("/getPulledUnits", getPulledUnits);
app.get("/getPulledFiles", getPulledFiles);

export const api = https.onRequest(app);
