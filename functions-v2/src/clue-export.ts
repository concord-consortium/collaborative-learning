import * as crypto from "crypto";
import {getDatabase} from "firebase-admin/database";
import {getFirestore} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret, defineString} from "firebase-functions/params";
import {
  ExportOwner, InnerCursor, isObject, kGroupUid, kMaxLimits, kSegment, OwnersClass, OwnersRequest, OwnerType,
  readGroupOwners, walk, WalkRequest,
} from "./clue-export-walk";

const exportBearer = defineSecret("CLUE_EXPORT_BEARER");
const exportPortals = defineString("CLUE_EXPORT_PORTALS");

const kMaxOwners = kMaxLimits.owner_limit;
const kMaxClasses = 1000;
const kMaxOfferings = 1000;
const kClassHash = /^[0-9a-f]{48}$/;
const kUserUid = /^\d+$/;
const kWalkOperations = ["documents", "history", "content"];

class InvalidRequest extends Error {}

const fail = (field: string): never => {
  throw new InvalidRequest(`${field} is invalid`);
};

const isIntegerIn = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isSegment = (value: unknown) => typeof value === "string" && kSegment.test(value);

const checkArray = (value: unknown, field: string, max: number): unknown[] =>
  Array.isArray(value) && value.length > 0 && value.length <= max ? value : fail(field);

const checkOfferings = (value: unknown, field: string) => {
  if (!Array.isArray(value) || value.length > kMaxOfferings) fail(field);
  (value as unknown[]).forEach((offering, i) => {
    if (!isIntegerIn(offering, 0, Number.MAX_SAFE_INTEGER)) fail(`${field}[${i}]`);
  });
  return value as number[];
};

const checkClassHash = (value: unknown, field: string) =>
  typeof value === "string" && kClassHash.test(value) ? value : fail(field);

const ownerTypeOf = (uid: unknown, classHash: string): OwnerType | undefined => {
  if (typeof uid !== "string") return undefined;
  if (kUserUid.test(uid)) return "user";
  if (kGroupUid.test(uid)) return "group";
  if (uid === `class_${classHash}`) return "class";
  return undefined;
};

const checkOwner = (value: unknown, field: string): ExportOwner => {
  if (!isObject(value)) return fail(field);
  const classHash = checkClassHash(value.class_hash, `${field}.class_hash`);
  const ownerType = ownerTypeOf(value.uid, classHash) ?? fail(`${field}.uid`);
  if (!isIntegerIn(value.portal_class_id, 1, Number.MAX_SAFE_INTEGER)) fail(`${field}.portal_class_id`);
  const offerings = checkOfferings(value.offerings, `${field}.offerings`);
  return {
    class_hash: classHash,
    uid: value.uid as string,
    owner_type: ownerType,
    portal_class_id: value.portal_class_id as number,
    offerings,
  };
};

const checkCursor = (value: unknown, operation: string): InnerCursor | null => {
  if (value === null) return null;
  if (!isObject(value)) return fail("inner_cursor");
  if (!isSegment(value.docId)) fail("inner_cursor.docId");
  if (operation !== "history") return {docId: value.docId as string};
  if (!isIntegerIn(value.index, 0, Number.MAX_SAFE_INTEGER)) fail("inner_cursor.index");
  if (!isSegment(value.entryId)) fail("inner_cursor.entryId");
  return {docId: value.docId as string, index: value.index as number, entryId: value.entryId as string};
};

const checkLimit = (value: unknown, field: keyof typeof kMaxLimits) =>
  isIntegerIn(value, 1, kMaxLimits[field]) ? value as number : fail(field);

export function validateRequest(body: unknown, portals: string[]): WalkRequest | OwnersRequest {
  if (!isObject(body)) return fail("body");
  const {operation, portal} = body;
  if (typeof operation !== "string" || ![...kWalkOperations, "owners"].includes(operation)) fail("operation");
  if (typeof portal !== "string" || !portals.includes(portal)) fail("portal");

  if (operation === "owners") {
    const classes: OwnersClass[] = checkArray(body.classes, "classes", kMaxClasses).map((value, i) => {
      if (!isObject(value)) return fail(`classes[${i}]`);
      return {
        class_hash: checkClassHash(value.class_hash, `classes[${i}].class_hash`),
        offerings: checkOfferings(value.offerings, `classes[${i}].offerings`),
      };
    });
    return {operation, portal: portal as string, classes};
  }

  const owners = checkArray(body.owners, "owners", kMaxOwners).map((owner, i) => checkOwner(owner, `owners[${i}]`));
  return {
    operation: operation as WalkRequest["operation"],
    portal: portal as string,
    owners,
    inner_cursor: checkCursor(body.inner_cursor, operation as string),
    limit: checkLimit(body.limit, "limit"),
    owner_limit: checkLimit(body.owner_limit, "owner_limit"),
    read_limit: checkLimit(body.read_limit, "read_limit"),
  };
}

const digest = (value: string) => new Uint8Array(crypto.createHash("sha256").update(value).digest());

const isAuthorized = (header: string | undefined) => {
  const secret = exportBearer.value();
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  return token !== "" && crypto.timingSafeEqual(digest(token), digest(secret));
};

export const clueExport = onRequest({
  serviceAccount: `clue-export-reader@${process.env.GCLOUD_PROJECT}.iam.gserviceaccount.com`,
  secrets: [exportBearer],
  invoker: "public",
  timeoutSeconds: 300,
  memory: "1GiB",
}, async (req, res) => {
  const refuse = (status: number, error: string) => {
    res.status(status).json({success: false, error});
  };

  if (req.method !== "POST") return refuse(405, "method must be POST");
  if (req.query?.bearer !== undefined || (isObject(req.body) && req.body.bearer !== undefined)) {
    return refuse(400, "bearer must be sent in the Authorization header");
  }
  if (!isAuthorized(req.get("Authorization"))) return refuse(401, "unauthorized");

  let request: WalkRequest | OwnersRequest;
  try {
    const portals = exportPortals.value().split(",").map((portal) => portal.trim()).filter(Boolean);
    request = validateRequest(req.body, portals);
  } catch (e) {
    if (e instanceof InvalidRequest) return refuse(400, e.message);
    throw e;
  }

  try {
    if (request.operation === "owners") {
      const groups = await readGroupOwners(getDatabase(), request);
      res.status(200).json({success: true, groups});
    } else {
      res.status(200).json(await walk({firestore: getFirestore(), database: getDatabase()}, request));
    }
  } catch (e) {
    const count = request.operation === "owners" ? request.classes.length : request.owners.length;
    const error = (e as {code?: string}).code ?? (e as Error).name;
    logger.error("clueExport read failed", {operation: request.operation, count, error});
    refuse(500, "read failed");
  }
});
