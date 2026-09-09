#!/usr/bin/node

// Creates the Firestore metadata documents for realtime-database documents that have none.
//
// Until 2025-06-24 the client created these with a fire-and-forget cloud-function call, so a
// document whose page navigated away before the call completed never got one. 6,240 such documents
// remain across all real spaces, of which 4,996 are in demo spaces. The cause is fixed (CLUE-647);
// this is a one-time repair.
//
// Dry run (default, writes nothing):  npx tsx scripts/metadata-repair/create-missing-document-metadata.ts
// Apply (performs the writes):        APPLY=1 npx tsx scripts/metadata-repair/create-missing-document-metadata.ts
// Limit to named spaces:              SPACES=demo/CLUE npx tsx ...
//
// Read ./README.md before running any of these: the order matters, and two of the three write.

import type { Firestore } from "firebase-admin/firestore";
import { isRtdbAddressable, type IDocumentHome } from "./lib/rtdb-document-index";
import { toolsFromDocumentNode } from "./lib/document-tools";

/** Batched writes are capped well below Firestore's 500-operation limit. */
const kBatchSize = 400;

/**
 * The types kept in an offering rather than in the class. Each needs `offeringId` plus a curriculum
 * position; `isInClassUnitContainer` reads the *absence* of `offeringId` as "class-contained", so a
 * metadata document written without one would place the document on the wrong container axis.
 *
 * The stored value for a problem publication is "publication" — `ProblemPublication` in
 * document-types.ts is the constant's name, not its value.
 */
export const kOfferingContainedTypes = ["problem", "planning", "publication", "supportPublication"];

/**
 * The types kept in the class. These carry no curriculum position, and get an explicit `unit: null`.
 *
 * Listed rather than inferred from "not offering-contained". The realtime database holds types this
 * repair has no business reconstructing, and defaulting them to class-contained would put them on the
 * wrong container axis silently:
 *
 * - `section` is deprecated and offering-contained — its schema requires an `offeringId`
 *   (`DBSectionDocumentMetadataDEPRECATED` in src/lib/db-types.ts). 108 of them have no Firestore
 *   metadata document, and no `section` metadata document exists anywhere in Firestore, so whether
 *   they should exist at all is a question for a person.
 * - `group` (and the `axes` type it is being renamed to) keeps its scope, owner, kind and title only
 *   in Firestore; the realtime database has base metadata and nothing else to rebuild from.
 * - `drivingQuestionBoard` and anything added later would otherwise be guessed at.
 */
export const kClassContainedTypes =
  ["personal", "learningLog", "personalPublication", "learningLogPublication"];

/**
 * Publication types whose `originDoc` is worth recovering, and the class-level list holding it.
 *
 * `originDoc` is established practice for exactly these two — 296 of 296 learning log publications and
 * 238 of 295 personal publications carry it in production — and no practice at all for problem
 * publications, where 0 of 14,325 do. So a problem publication is deliberately absent here.
 *
 * Nothing else is taken from these lists. `pubVersion` and `userId` appear on no Firestore document,
 * and their `groupId` names the group that *published* the document, whereas Firestore's `groupId` is
 * an owner-axis field meaning the document *belongs to* that group. See
 * docs/document-metadata/firestore-migration.md.
 */
const kOriginDocLists: Record<string, (classHash: string) => string> = {
  personalPublication: (classHash) => `classes/${classHash}/personalPublications`,
  learningLogPublication: (classHash) => `classes/${classHash}/publications`
};

export type CreateBucket =
  | "created"            // a metadata document this run would write, or did
  | "written"            // credited only once the commit resolved
  | "alreadyPresent"     // Firestore already has a metadata document for this key
  | "skippedNoContent"   // metadata without content: creating one would surface a broken document
  | "skippedUnaddressable" // a key the realtime database cannot express in a path
  | "nodeUnreadable"     // the metadata node could not be read; nothing to build from
  | "unresolvedCurriculum" // offering-contained, but its unit/investigation/problem are unknown
  | "unreadableContent"   // written, but without `tools`: its content would not parse
  | "appearedDuringRun"   // a client created it between the scan and the write; left alone
  | "ownerIsTeacher"      // created, but with a null network that cannot be reconstructed
  | "unsupportedType";    // a type on neither allowlist: which container it belongs to is unknown

export type ICreateCounts = Record<CreateBucket, number>;

const emptyCounts = (): ICreateCounts => ({
  created: 0, written: 0, alreadyPresent: 0, skippedNoContent: 0,
  skippedUnaddressable: 0, nodeUnreadable: 0, unresolvedCurriculum: 0, unreadableContent: 0,
  appearedDuringRun: 0, ownerIsTeacher: 0, unsupportedType: 0
});

/** Firestore's ALREADY_EXISTS, the one write failure that is a race rather than a fault. */
const isAlreadyExists = (err: any) => err?.code === 6;

export interface ICurriculumPosition {
  unit?: string | null;
  investigation?: string | null;
  problem?: string | null;
}

/**
 * A document the run declined, with enough about it to decide what should happen instead. `createdAt`
 * is the only timestamp these nodes reliably carry — `lastEditedAt` appears on a handful — so it is
 * the practical measure of a skipped document's age.
 */
export interface ISkippedDocument {
  key: string;
  /** The rest of the realtime-database path. A key alone addresses nothing. */
  classHash: string;
  uid: string;
  /** Which halves exist, so a follow-up knows which nodes are actually there. */
  hasContent: boolean;
  hasMetadata: boolean;
  reason: CreateBucket;
  createdAt?: number;
  type?: string;
  offeringId?: string;
}

export interface ICreateMissingResult {
  counts: ICreateCounts;
  /**
   * The same buckets split by document `type`.
   *
   * A per-space total hides the thing an operator most needs to see before thousands of writes: a type
   * nobody expected. The offering/class split is decided by a four-type allowlist, so a `section` or a
   * `group` appearing here is the signal that the allowlist needs revisiting rather than a default.
   * Documents skipped before their node was read are counted under "(unknown)".
   */
  byType: Record<string, ICreateCounts>;
  /** Documents skipped, with the reason, so a run says what it declined rather than only what it did. */
  skipped: ISkippedDocument[];
}

/** Reads one realtime-database node's value, or null when it is absent. */
export type ReadNode = (path: string) => Promise<any>;

export interface ICreateMissingDeps {
  rtdbRoot: string;
  readNode: ReadNode;
  /** Stored on every metadata document this run creates, matching what the client stamps at creation. */
  network?: string | null;
  /**
   * Last resort for an offering whose curriculum position no existing document reveals. Backed by the
   * portal API in the CLI; omitted, an unresolved offering is reported and skipped.
   */
  resolveCurriculum?: (offeringId: string) => Promise<ICurriculumPosition | undefined>;
  /**
   * Whether a document's owner teaches its class.
   *
   * `network` is a snapshot of the creating teacher's primary network, and firestore.rules reads it
   * back so teachers in that network can see each other's documents. Nothing in the realtime database
   * records it, so a reconstructed metadata document cannot carry it and is written with
   * `network: null`.
   *
   * The metadata document is still created: without one the document is reachable by nobody, while
   * one with a null network is reachable by the teachers of its class. Cross-network visibility is
   * the part that is not restored, so those are counted and reported rather than passed off as
   * complete.
   */
  isTeacherOwned?: (classHash: string, uid: string) => Promise<boolean>;
}

export interface ICreateMissingOptions {
  dryRun?: boolean;
  log?: (message: string) => void;
  pageSize?: number;
  batchSize?: number;
}

/**
 * Create a Firestore metadata document for every indexed document that lacks one.
 *
 * Only documents whose content still exists get one. A document with metadata but no content is
 * already unreachable; giving it a Firestore metadata document would promote it into Sort Work,
 * where opening it throws. That skip is the reason the index reads both realtime-database halves.
 */
export async function createMissingDocumentMetadata(
  firestore: Firestore,
  spacePath: string,
  index: Map<string, IDocumentHome>,
  { rtdbRoot, readNode, network = null, resolveCurriculum, isTeacherOwned }: ICreateMissingDeps,
  { dryRun = true, log = console.log, pageSize = 500, batchSize = kBatchSize }: ICreateMissingOptions = {}
): Promise<ICreateMissingResult> {
  const counts = emptyCounts();
  const byType: Record<string, ICreateCounts> = {};
  const skipped: ISkippedDocument[] = [];

  /** Credits a bucket to the run and to the document's type. */
  const count = (bucket: CreateBucket, type: string | undefined, amount = 1) => {
    counts[bucket] += amount;
    const forType = byType[type || "(unknown)"] ??= emptyCounts();
    forType[bucket] += amount;
  };

  /**
   * All three parts or none.
   *
   * A sibling's metadata document is another document's stored answer, and metadata documents exist
   * carrying a unit with null investigation and problem. Writing one of those through would either
   * store `undefined` — which the Firestore SDK rejects, failing the whole batch and not just the
   * offending document — or record a curriculum position missing two of its three parts, which reads
   * as a whole-unit document.
   */
  const isCompletePosition = (position: ICurriculumPosition | undefined): boolean =>
    !!position?.unit && position.investigation != null && position.problem != null;

  // One pass over Firestore serves two purposes: the ids already present, so the run writes only what
  // is genuinely absent, and a curriculum position per offering, so most of them need no portal call.
  const present = new Map<string, string | undefined>();
  const curriculumByOffering = new Map<string, ICurriculumPosition>();
  let lastDoc: any = null;
  for (;;) {
    let query: any = (firestore.collection(spacePath) as any)
      .select("type", "offeringId", "unit", "investigation", "problem").limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const doc of snapshot.docs) {
      const d = doc.data() ?? {};
      present.set(doc.id, d.type);
      const sibling = { unit: d.unit, investigation: d.investigation, problem: d.problem };
      if (d.offeringId && !curriculumByOffering.has(d.offeringId) && isCompletePosition(sibling)) {
        curriculumByOffering.set(d.offeringId, sibling);
      }
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < pageSize) break;
  }

  // Memoizes both sources, so an offering is asked about once however many documents share it.
  // Failures are cached as `undefined` too: demo spaces carry authored offering ids the portal knows
  // nothing about, and without this every document sharing one would re-query.
  const curriculumFor = async (offeringId: string): Promise<ICurriculumPosition | undefined> => {
    if (curriculumByOffering.has(offeringId)) return curriculumByOffering.get(offeringId);
    const resolved = resolveCurriculum ? await resolveCurriculum(offeringId) : undefined;
    const usable = isCompletePosition(resolved) ? resolved : undefined;
    curriculumByOffering.set(offeringId, usable as ICurriculumPosition);
    return usable;
  };

  // A publication list is shared by every publication in its class, so read each at most once.
  const listCache = new Map<string, any>();
  const originDocFor = async (type: string, classHash: string, key: string) => {
    const buildPath = kOriginDocLists[type];
    if (!buildPath) return undefined;
    const path = `${rtdbRoot}/${buildPath(classHash)}`;
    if (!listCache.has(path)) listCache.set(path, await readNode(path));
    const list = listCache.get(path);
    // Entries are keyed by their own push id; the document key is inside `self`.
    const entry = list && Object.values(list)
      .find((candidate: any) => candidate?.self?.documentKey === key);
    return (entry as any)?.originDoc;
  };

  /**
   * Metadata documents waiting to be written, held as data rather than queued onto a batch, so that
   * a batch which fails can be retried one document at a time.
   */
  let pending: Array<{ path: string; metadata: Record<string, any>; type?: string }> = [];

  /**
   * Writes with `create`, never `set`.
   *
   * The scan that decides what is missing happens once per space, and the sweep then runs for
   * minutes. A client or cloud function can create a metadata document for one of these documents in
   * that window — these are not all abandoned documents — and `set` would overwrite it, replacing one
   * written with the full creation context by one reconstructed from the realtime database. `create` refuses
   * instead, and the loser of that race is the script.
   *
   * A batch is all-or-nothing, so one such conflict fails every write queued with it. That is why the
   * retry is per document: the conflict is expected, and the rest of the batch did nothing wrong.
   */
  const commit = async () => {
    if (!pending.length) return;
    const batch = firestore.batch();
    for (const p of pending) (batch as any).create(firestore.doc(p.path), p.metadata);
    try {
      await batch.commit();
      // Credited only now, so a crash understates rather than overstates what landed.
      for (const p of pending) count("written", p.type);
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
      for (const p of pending) {
        try {
          await (firestore.doc(p.path) as any).create(p.metadata);
          count("written", p.type);
        } catch (retryErr) {
          if (!isAlreadyExists(retryErr)) throw retryErr;
          count("appearedDuringRun", p.type);
        }
      }
    }
    pending = [];
  };

  const skip = (key: string, indexed: IDocumentHome, reason: CreateBucket, node?: any) => {
    count(reason, node?.type);
    const entry: ISkippedDocument = {
      key, classHash: indexed.classHash, uid: indexed.uid,
      hasContent: indexed.hasContent, hasMetadata: indexed.hasMetadata, reason
    };
    if (node?.createdAt != null) entry.createdAt = node.createdAt;
    // Recorded for every reason, not just unresolved curriculum: the deletion script reads this report,
    // and "what kind of documents am I about to remove" is the first question to ask of it.
    if (node?.type != null) entry.type = node.type;
    if (reason === "unresolvedCurriculum") entry.offeringId = node?.offeringId;
    skipped.push(entry);
  };

  try {
  for (const [key, indexed] of index) {
    if (present.has(key)) { count("alreadyPresent", present.get(key)); continue; }
    if (!isRtdbAddressable(indexed.classHash, indexed.uid, key)) {
      skip(key, indexed, "skippedUnaddressable");
      continue;
    }

    const nodePath =
      `${rtdbRoot}/classes/${indexed.classHash}/users/${indexed.uid}/documentMetadata/${key}`;
    const node = await readNode(nodePath);
    // Read before the content check so a skipped document can still report its age.
    if (!indexed.hasContent) { skip(key, indexed, "skippedNoContent", node); continue; }
    if (!node) { skip(key, indexed, "nodeUnreadable"); continue; }

    const offeringContained = kOfferingContainedTypes.includes(node.type);
    if (!offeringContained && !kClassContainedTypes.includes(node.type)) {
      skip(key, indexed, "unsupportedType", node);
      continue;
    }

    const metadata: Record<string, any> = {
      key,
      type: node.type,
      uid: indexed.uid,
      context_id: indexed.classHash,
      createdAt: node.createdAt,
      network,
      properties: {}
    };
    // Stamped only when present, so Firestore never stores `title: undefined`.
    if (node.title != null) metadata.title = node.title;
    // The client keeps this in step from the moment a metadata document exists —
    // useDocumentSyncToFirebase finds them by query, so every toggle made while it was missing
    // updated nothing. Taking the node's value makes the metadata right now rather than at the
    // owner's next toggle, which for a document this old may never come.
    if (node.visibility != null) metadata.visibility = node.visibility;

    const originDoc = await originDocFor(node.type, indexed.classHash, key);
    if (originDoc != null) metadata.originDoc = originDoc;

    if (offeringContained) {
      const position = node.offeringId ? await curriculumFor(node.offeringId) : undefined;
      if (!position) {
        // Writing it without these would place the document on the wrong container axis and hand it
        // to the offeringId backfill as new work. Report it and leave it alone.
        skip(key, indexed, "unresolvedCurriculum", node);
        continue;
      }
      metadata.offeringId = node.offeringId;
      metadata.unit = position.unit;
      metadata.investigation = position.investigation;
      metadata.problem = position.problem;
    } else {
      // Written as an explicit null, not left out. Sort Work finds class-contained documents with
      // `where("unit", "==", null)` (sorted-documents.ts), and Firestore cannot match a field that is
      // absent — a metadata document without it is invisible under every filter but "All". This is
      // what the client's "class" container stamps, and all 19,649 class-contained metadata
      // documents in production carry it.
      metadata.unit = null;
    }

    // Read last, so the 573 documents skipped above never pull a content node. Content is the largest
    // thing in the database and this is the run's only read of it.
    const contentPath =
      `${rtdbRoot}/classes/${indexed.classHash}/users/${indexed.uid}/documents/${key}`;
    const tools = toolsFromDocumentNode(await readNode(contentPath));
    // Absent rather than `[]` when the content would not parse: an empty array asserts the document
    // has no tiles, which is a different claim from "this run could not tell".
    if (tools) metadata.tools = tools;
    else count("unreadableContent", node.type);

    if (isTeacherOwned && await isTeacherOwned(indexed.classHash, indexed.uid)) {
      count("ownerIsTeacher", node.type);
    }

    count("created", node.type);
    if (!dryRun) {
      pending.push({ path: `${spacePath}/${key}`, metadata, type: node.type });
      if (pending.length >= batchSize) await commit();
    }
  }

  await commit();
  } catch (err: any) {
    // A partial apply is exactly when the counts matter, so carry them out with the failure as well
    // as logging them below: a caller should not have to scrape stdout to reconcile.
    err.counts = counts;
    err.byType = byType;
    throw err;
  } finally {
    log(`${spacePath}: created ${counts.created}, written ${counts.written}, ` +
        `already present ${counts.alreadyPresent}, no content ${counts.skippedNoContent}, ` +
        `unaddressable ${counts.skippedUnaddressable}, unreadable ${counts.nodeUnreadable}, ` +
        `unresolved curriculum ${counts.unresolvedCurriculum}, ` +
        `unreadable content ${counts.unreadableContent}, ` +
        `appeared during run ${counts.appearedDuringRun}, ` +
        `owner is a teacher ${counts.ownerIsTeacher}, ` +
        `unsupported type ${counts.unsupportedType}`);
    // Per type, so an unexpected distribution is visible before thousands of writes are applied.
    for (const [type, forType] of Object.entries(byType).sort((a, b) => b[1].created - a[1].created)) {
      const shown = Object.entries(forType).filter(([, n]) => n > 0).map(([b, n]) => `${b} ${n}`);
      if (shown.length) log(`    ${type}: ${shown.join(", ")}`);
    }
  }

  return { counts, byType, skipped };
}

async function main() {
  // Imported lazily so the Jest test can import createMissingDocumentMetadata without loading
  // firebase-admin or the import.meta-using script-utils module.
  const admin = (await import("firebase-admin")).default;
  const nodeFs = (await import("fs")).default;
  const { getScriptRootFilePath, getProblemDetails } = await import("../lib/script-utils.js");
  const {
    createRtdbReader, kOutputDir, kSkipReportFile, listSpacePaths, parseSpacesFilter, resolveDatabaseUrl, selectSpaces
  } = await import("./lib/repair-cli");
  const { buildRtdbDocumentIndex } = await import("./lib/rtdb-document-index");
  const { createCurriculumValidator, decodeDemoOfferingId } = await import("./lib/curriculum-position");

  const serviceAccountFile = getScriptRootFilePath("serviceAccountKey.json");
  const serviceAccount = JSON.parse(nodeFs.readFileSync(serviceAccountFile, "utf8"));
  const databaseURL = resolveDatabaseUrl(serviceAccount.project_id, process.env.DATABASE_URL);
  const dryRun = process.env.APPLY !== "1";
  const filter = parseSpacesFilter(process.env.SPACES);
  // The portal is only consulted for offerings no existing document describes. Without a token the
  // run still works; those documents are reported as unresolved instead of written half-populated.
  const portal = process.env.PORTAL ?? "https://learn.concord.org";

  console.log(`- Service account: ${serviceAccount.client_email}`);
  console.log(`- Firebase project: ${serviceAccount.project_id}`);
  console.log(`- Realtime Database URL: ${databaseURL}`);
  console.log(`- Portal (curriculum fallback): ${portal}`);
  console.log(`- Spaces: ${filter ? filter.join(", ") : "all"}`);
  console.log(`- Mode: ${dryRun ? "DRY RUN" : "APPLY — will write"}`);

  const credential = admin.credential.cert(serviceAccountFile);
  admin.initializeApp({ credential, databaseURL });
  const firestore = admin.firestore();
  const reader = createRtdbReader(databaseURL, () => (credential as any).getAccessToken());

  const resolveFromPortal = async (offeringId: string) => {
    try {
      const { fetchPortalOffering } = await import("../lib/fetch-portal-entity.js");
      const offering: any = await fetchPortalOffering(portal, offeringId);
      if (!offering?.activity_url) return undefined;
      return getProblemDetails(offering.activity_url);
    } catch (err: any) {
      // An offering the portal cannot answer for is reported by the pass, not fatal to the run.
      console.log(`    portal lookup failed for offering ${offeringId}: ${err.message}`);
      return undefined;
    }
  };

  // Demo documents have no other source: nothing in the realtime database records a curriculum
  // position, so their offering id is it. Decoding splits a string into a name and a number and can
  // split in the wrong place, so every result is checked against a curriculum checkout before use.
  const curriculumRoot = process.env.CURRICULUM_ROOT ?? `${process.env.HOME}/Development/clue-curriculum`;
  // Each unit's content.json read at most once; missing units cache as undefined.
  const unitContent = new Map<string, any>();
  const readUnitContent = (unit: string) => {
    if (!unitContent.has(unit)) {
      const path = `${curriculumRoot}/curriculum/${unit}/content.json`;
      try {
        unitContent.set(unit, JSON.parse(nodeFs.readFileSync(path, "utf8")));
      } catch {
        unitContent.set(unit, undefined);
      }
    }
    return unitContent.get(unit);
  };
  const validate = createCurriculumValidator(curriculumRoot, { readUnitContent });

  // A demo session launched with no `unit` parameter leaves the unit code out of its offering id
  // while the app still loads this unit, so a bare id means this one. Read from the config rather
  // than hardcoded, so it stays true if the default changes.
  const defaultUnit = JSON.parse(
    nodeFs.readFileSync(getScriptRootFilePath("../src/clue/curriculum-config.json"), "utf8")
  ).defaultUnit;
  console.log(`- Curriculum: ${curriculumRoot} (default unit "${defaultUnit}")`);

  const resolveFromOfferingId = (offeringId: string) => {
    const decoded = decodeDemoOfferingId(offeringId, defaultUnit);
    if (!decoded) {
      console.log(`    offering ${offeringId} carries no unit code — skipped`);
      return undefined;
    }
    if (!validate(decoded)) {
      console.log(`    offering ${offeringId} decodes to ${decoded.unit} ` +
        `${decoded.investigation}.${decoded.problem}, which the curriculum does not have — skipped`);
      return undefined;
    }
    console.log(`    offering ${offeringId} -> ${decoded.unit} ${decoded.investigation}.${decoded.problem}`);
    return decoded;
  };

  const selection = selectSpaces(await listSpacePaths(firestore), filter);
  for (const { label, reason } of selection.refused) console.log(`- skipping ${label}: ${reason}`);
  for (const path of selection.unrecognized) console.log(`- unrecognized space path: ${path}`);
  for (const name of selection.filterMisses) console.log(`- SPACES named "${name}", which matches no space`);
  console.log(`- Running over ${selection.selected.length} spaces\n`);

  const totals = emptyCounts();
  const allSkipped: Record<string, number> = {};
  const everySkipped: Array<ISkippedDocument & { space: string }> = [];
  for (const space of selection.selected) {
    const { index, duplicates, classes } = await buildRtdbDocumentIndex(space.rtdbRoot, reader.readChildKeys);
    console.log(`  ${space.label}: ${classes} classes, ${index.size} indexed documents`);
    if (duplicates.length) {
      console.log(`  ${space.label}: ${duplicates.length} keys with more than one home — NOT created`);
    }
    // Which fallback applies depends on where the space's offerings came from. A demo space's
    // realtime root is `demo/<name>/portals/demo` and its offering ids are authored strings like
    // "m2s101", which learn.concord.org knows nothing about; an authed space's are portal ids, which
    // encode nothing. Either way the sibling lookup inside the pass is tried first.
    const portalBacked = space.label.startsWith("authed/");
    // A class's teacher list, read once per class. The space path ends in "/documents", and the
    // classes live alongside it.
    const classTeachers = new Map<string, string[]>();
    const isTeacherOwned = async (classHash: string, uid: string) => {
      if (!classTeachers.has(classHash)) {
        const classPath = `${space.spacePath.replace(/\/documents$/, "")}/classes/${classHash}`;
        const snapshot = await firestore.doc(classPath).get();
        classTeachers.set(classHash, (snapshot.data()?.teachers as string[]) ?? []);
      }
      return classTeachers.get(classHash)!.includes(uid);
    };

    const { counts, skipped } = await createMissingDocumentMetadata(
      firestore, space.spacePath, index,
      {
        rtdbRoot: space.rtdbRoot, readNode: reader.readNode,
        resolveCurriculum: portalBacked ? resolveFromPortal : async (id: string) => resolveFromOfferingId(id),
        isTeacherOwned
      },
      { dryRun }
    );
    for (const bucket of Object.keys(totals) as CreateBucket[]) totals[bucket] += counts[bucket];
    for (const s of skipped) {
      allSkipped[s.reason] = (allSkipped[s.reason] ?? 0) + 1;
      everySkipped.push({ ...s, space: space.label });
    }
  }

  console.log("\ndone", JSON.stringify(totals, null, 2));
  console.log("skipped by reason", JSON.stringify(allSkipped, null, 2));

  // Age of what was declined, so a decision about the residue rests on numbers rather than a guess.
  const byYear: Record<string, number> = {};
  let newest = 0;
  for (const s of everySkipped) {
    if (!s.createdAt) { byYear["(no createdAt)"] = (byYear["(no createdAt)"] ?? 0) + 1; continue; }
    const year = new Date(s.createdAt).toISOString().slice(0, 4);
    byYear[year] = (byYear[year] ?? 0) + 1;
    newest = Math.max(newest, s.createdAt);
  }
  console.log("skipped by year created", JSON.stringify(Object.fromEntries(
    Object.entries(byYear).sort()
  ), null, 2));
  if (newest) console.log(`newest skipped document: ${new Date(newest).toISOString().slice(0, 10)}`);
  // A filtered run has only seen part of the database, so its report must not sit at the path the
  // deletion script reads by default. Deleting from a partial report would under-delete rather than
  // over-delete, but silently: the run would look complete and simply not mention the rest.
  const reportPath = getScriptRootFilePath(
    filter ? kSkipReportFile.replace(/\.json$/, ".partial.json") : kSkipReportFile);
  nodeFs.mkdirSync(getScriptRootFilePath(kOutputDir), { recursive: true });
  nodeFs.writeFileSync(reportPath, JSON.stringify(everySkipped, null, 2));
  console.log(`skipped documents written to ${reportPath}`);
  if (filter) {
    console.log("This run was limited to named spaces, so the report covers only those. " +
      "Re-run without SPACES before deleting anything from it.");
  }
  if (dryRun) console.log("DRY RUN — set APPLY=1 to write");
  process.exit(0);
}

// Run only when invoked directly (via tsx), never when imported by the Jest test.
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
