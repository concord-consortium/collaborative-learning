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

export interface AuthorizedRequest extends Request{
  decodedToken: DecodedIdToken;
}

const adminEmails = ["dmartin@concord.org", "lbondaryk@concord.org"];
const adminOnlyPaths = ["/pullUnit"];

admin.initializeApp();

const isUserAuthorized = (path: string, decodedToken: DecodedIdToken): boolean => {
  const {email, email_verified: emailVerified} = decodedToken;

  // only allow admins to pull units (the email check should be changed to a role check later)
  if (adminOnlyPaths.includes(path) && !adminEmails.includes(email ?? "")) {
    return false;
  }

  // for now just allow anyone with a verified concord.org email have access
  return !!(emailVerified && /concord\.org$/.test(email ?? ""));
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
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (isUserAuthorized(req.path, decodedToken)) {
      (req as AuthorizedRequest).decodedToken = decodedToken;
      return next();
    } else {
      return res.status(403).send("Unauthorized: You don't have authoring permissions.");
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return res.status(401).send("Unauthorized: Invalid or expired token.");
  }
};

const tbd = (req: Request, res: Response) => res.status(501).send("Not implemented yet.");

const app = express();

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

app.get("/getRemoteBranches", getRemoteBranches);
app.get("/getRemoteUnits", getRemoteUnits);

app.get("/getPulledBranches", getPulledBranches);
app.get("/getPulledUnits", getPulledUnits);
app.get("/getPulledFiles", getPulledFiles);

export const api = https.onRequest(app);
