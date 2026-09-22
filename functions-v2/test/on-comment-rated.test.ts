import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {clearFirestoreData} from "firebase-functions-test/lib/providers/firestore";
import {kAnalyzerUserParams} from "../../shared/shared";
import {onCommentRated} from "../src/on-comment-rated";
import {AiAgreement} from "../src/summary-types";
import {getSummaryPath} from "../src/utils";
import {initialize, projectConfig} from "./initialize";

jest.mock("firebase-functions/logger");

const {fft, cleanup} = initialize();

const kRoot = "demo";
const kSpace = "test";
// Deliberately different from each other: a legacy metadata document's id carries a uid or network
// prefix, so both writers derive the summary path from the `key` field rather than the id. Every
// test here runs against that mismatch, so a trigger reaching for the id would look up a summary
// that does not exist and record nothing.
const kDocumentId = "metadata-doc-1";
const kDocumentKey = "doc-key-1";
const kCommentId = "comment-1";
const kOtherCommentId = "comment-2";
const kAdaUid = kAnalyzerUserParams.id;
const kSummaryPath = getSummaryPath(kRoot, kSpace, kDocumentKey);

// Two event times, so a test can deliver events out of the order they happened.
const kEarly = "2026-08-31T12:00:00.000Z";
const kLate = "2026-08-31T12:10:00.000Z";

type Data = admin.firestore.DocumentData;

const wrapped = fft.wrap(onCommentRated);
const firestore = () => admin.firestore();
const commentPath = (commentId = kCommentId) =>
  `${kRoot}/${kSpace}/documents/${kDocumentId}/comments/${commentId}`;

// The state the trigger reads: the comment as it stands right now, whatever any event says.
async function setComment(data: Data, commentId = kCommentId) {
  await firestore().doc(commentPath(commentId)).set(data);
}

async function deleteComment(commentId = kCommentId) {
  await firestore().doc(commentPath(commentId)).delete();
}

// `omit` leaves a field off the record entirely, which is how the older records in the collection
// differ from the ones the pipeline writes now.
async function seedSummary(fields: Data = {}, omit: string[] = []) {
  const summary: Data = {
    key: kDocumentKey,
    summary: "A summary of the document",
    numAiAgreements: 0,
    numAgreements: 0,
    aiAgreements: {},
    ...fields,
  };
  omit.forEach((field) => delete summary[field]);
  await firestore().doc(kSummaryPath).set(summary);
}

async function readSummary(): Promise<Data | undefined> {
  return (await firestore().doc(kSummaryPath).get()).data();
}

// The event payload. `{}` stands for a document that does not exist, which is how
// firebase-functions-test spells creation and deletion; passing `undefined` gets an example
// document instead.
async function deliver(
  {before = {}, after = {}, commentId = kCommentId, time = kEarly}:
  {before?: Data; after?: Data; commentId?: string; time?: string}
) {
  await wrapped({
    data: {before, after},
    params: {root: kRoot, space: kSpace, documentId: kDocumentId, commentId},
    time,
  });
}

function adaComment(ratings: Data = {}, overrides: Data = {}) {
  return {uid: kAdaUid, content: "Ada's comment", tags: ["user"], ratings, ...overrides};
}

function humanComment(ratings: Data = {}, overrides: Data = {}) {
  return {uid: "student-2", content: "A classmate's comment", tags: [], ratings, ...overrides};
}

function v1Entry(value: string, content = "an old comment"): AiAgreement {
  return {version: 1, value, content, tags: []} as AiAgreement;
}

describe("onCommentRated", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearFirestoreData(projectConfig);
    await firestore().doc(`${kRoot}/${kSpace}/documents/${kDocumentId}`).set({key: kDocumentKey});
  });

  afterAll(async () => {
    await cleanup();
  });

  describe("recording a rating", () => {
    test("records a rating of an Ada comment as a version-2 agreement", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      expect(await readSummary()).toEqual(expect.objectContaining({
        numAiAgreements: 1,
        numAgreements: 1,
        aiAgreements: {
          [`${kCommentId}_student-1`]: {
            version: 2,
            value: "yes",
            raterUid: "student-1",
            commentId: kCommentId,
            commentUid: kAdaUid,
            isAiComment: true,
            content: "Ada's comment",
            tags: ["user"],
            updatedAt: Date.parse(kEarly),
          },
        },
      }));
    });

    test("records a rating of a classmate's comment, but not as an AI agreement", async () => {
      await seedSummary();
      await setComment(humanComment({"student-1": "no"}));

      await deliver({before: humanComment(), after: humanComment({"student-1": "no"})});

      const summary = await readSummary();
      expect(summary?.aiAgreements[`${kCommentId}_student-1`]).toEqual(expect.objectContaining({
        isAiComment: false,
        commentUid: "student-2",
        value: "no",
      }));
      expect(summary?.numAiAgreements).toBe(0);
      expect(summary?.numAgreements).toBe(1);
    });

    test("records one entry per rater", async () => {
      await seedSummary();
      const ratings = {"student-1": "yes", "student-2": "notSure"};
      await setComment(adaComment(ratings));

      await deliver({before: adaComment({"student-1": "yes"}), after: adaComment(ratings)});

      const summary = await readSummary();
      expect(Object.keys(summary?.aiAgreements).sort())
        .toEqual([`${kCommentId}_student-1`, `${kCommentId}_student-2`]);
      expect(summary?.numAiAgreements).toBe(2);
    });

    test("leaves the entries of other comments alone", async () => {
      const otherEntry = {
        version: 2, value: "yes", raterUid: "student-1", commentId: kOtherCommentId,
        commentUid: kAdaUid, isAiComment: true, content: "another", tags: [],
        updatedAt: Date.parse(kEarly),
      };
      await seedSummary({
        numAiAgreements: 1,
        numAgreements: 1,
        aiAgreements: {[`${kOtherCommentId}_student-1`]: otherEntry},
      });
      await setComment(adaComment({"student-1": "no"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "no"})});

      const summary = await readSummary();
      expect(Object.keys(summary?.aiAgreements).sort())
        .toEqual([`${kCommentId}_student-1`, `${kOtherCommentId}_student-1`]);
      // Not merely still present: unchanged, down to the timestamp.
      expect(summary?.aiAgreements[`${kOtherCommentId}_student-1`]).toEqual(otherEntry);
      expect(summary?.numAiAgreements).toBe(2);
    });

    test("keys entries safely when the comment id contains a dot", async () => {
      const dottedId = "comment.with.dots";
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}), dottedId);

      await deliver({
        before: adaComment(), after: adaComment({"student-1": "yes"}), commentId: dottedId,
      });

      const summary = await readSummary();
      expect(Object.keys(summary?.aiAgreements)).toEqual([`${dottedId}_student-1`]);
      expect(summary?.aiAgreements[`${dottedId}_student-1`].commentId).toBe(dottedId);
    });

    test("a newly posted comment does not touch the summary", async () => {
      // A comment is created with no ratings on it: Ada's comments and students' both. This is the
      // event the trigger sees most often, and it must come to nothing. The analysis pipeline
      // relies on it — it writes the summary before posting Ada's comment, which is only safe if
      // posting a comment cannot itself write to `summaries`.
      await seedSummary();
      const posted = adaComment();
      await setComment(posted);
      const beforePosting = await readSummary();

      // A creation event: there is no `before` document at all, rather than one whose ratings map
      // is empty.
      await deliver({after: posted});

      expect(await readSummary()).toEqual(beforePosting);
      // Nothing is logged because the function returns on the ratings diff, before reading anything.
      expect(logger.info).not.toHaveBeenCalled();
    });

    test("stores empty tags and content for a comment that has neither", async () => {
      await seedSummary();
      await setComment({uid: kAdaUid, ratings: {"student-1": "yes"}});

      await deliver({
        before: {uid: kAdaUid}, after: {uid: kAdaUid, ratings: {"student-1": "yes"}},
      });

      const summary = await readSummary();
      expect(summary?.aiAgreements[`${kCommentId}_student-1`])
        .toEqual(expect.objectContaining({tags: [], content: ""}));
    });
  });

  describe("reconciling with the comment", () => {
    test("updates an entry whose rating changed", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));
      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      await setComment(adaComment({"student-1": "no"}, {content: "Ada's edited comment"}));
      await deliver({
        before: adaComment({"student-1": "yes"}),
        after: adaComment({"student-1": "no"}),
        time: kLate,
      });

      const summary = await readSummary();
      expect(summary?.aiAgreements[`${kCommentId}_student-1`]).toEqual(expect.objectContaining({
        value: "no",
        content: "Ada's edited comment",
        updatedAt: Date.parse(kLate),
      }));
      expect(summary?.numAiAgreements).toBe(1);
    });

    test("removes an entry when the rating is toggled off, and keeps the summary", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));
      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      await setComment(adaComment({}));
      await deliver({
        before: adaComment({"student-1": "yes"}), after: adaComment({}), time: kLate,
      });

      const summary = await readSummary();
      expect(summary).toBeDefined();
      expect(summary?.aiAgreements).toEqual({});
      expect(summary?.numAiAgreements).toBe(0);
      expect(summary?.numAgreements).toBe(0);
    });

    test("adds, changes, and removes in one reconciliation", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes", "student-2": "yes"}));
      await deliver({before: adaComment(), after: adaComment({"student-1": "yes", "student-2": "yes"})});

      // Everything moved at once, which is what a run of missed events looks like from here.
      await setComment(adaComment({"student-2": "no", "student-3": "notSure"}));
      await deliver({
        before: adaComment({"student-1": "yes", "student-2": "yes"}),
        after: adaComment({"student-2": "no", "student-3": "notSure"}),
        time: kLate,
      });

      const summary = await readSummary();
      // student-1 removed, student-2 changed, student-3 added.
      expect(Object.keys(summary?.aiAgreements).sort())
        .toEqual([`${kCommentId}_student-2`, `${kCommentId}_student-3`]);
      expect(summary?.aiAgreements[`${kCommentId}_student-2`].value).toBe("no");
      expect(summary?.aiAgreements[`${kCommentId}_student-3`]).toEqual(expect.objectContaining({
        value: "notSure",
        raterUid: "student-3",
        updatedAt: Date.parse(kLate),
      }));
      expect(summary?.numAiAgreements).toBe(2);
    });

    test("ignores a rating value outside the enum", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "maybe", "student-2": "yes"}));

      await deliver({
        before: adaComment(),
        after: adaComment({"student-1": "maybe", "student-2": "yes"}),
      });

      const summary = await readSummary();
      expect(Object.keys(summary?.aiAgreements)).toEqual([`${kCommentId}_student-2`]);
      expect(summary?.numAiAgreements).toBe(1);
    });

    test("ignores a ratings field that is an array rather than a map", async () => {
      // `ratings` is client-writable in the open realms, so its type is not guaranteed. An array
      // would otherwise enumerate as {"0": "yes"} and forge an entry for a rater named "0".
      await seedSummary();
      await setComment(adaComment(["yes"] as unknown as Data));

      await deliver({
        before: adaComment(),
        after: adaComment(["yes"] as unknown as Data),
      });

      expect((await readSummary())?.aiAgreements).toEqual({});
    });

    test("writes nothing when the ratings map did not change", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));
      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});
      const afterFirstRating = await readSummary();

      jest.clearAllMocks();
      // A content edit that leaves the ratings alone.
      await setComment(adaComment({"student-1": "yes"}, {content: "edited"}));
      await deliver({
        before: adaComment({"student-1": "yes"}),
        after: adaComment({"student-1": "yes"}, {content: "edited"}),
        time: kLate,
      });

      expect(await readSummary()).toEqual(afterFirstRating);
      // Nothing is logged because the function returns on the ratings diff, before it reads
      // anything at all.
      expect(logger.info).not.toHaveBeenCalled();
    });

    test("skips a comment that has no uid", async () => {
      await seedSummary();
      await setComment({content: "no author", ratings: {"student-1": "yes"}});

      await deliver({before: {content: "no author"}, after: {content: "no author", ratings: {"student-1": "yes"}}});

      expect((await readSummary())?.aiAgreements).toEqual({});
      // The reason matters: an empty map is also what every other skip leaves behind.
      expect(logger.info).toHaveBeenCalledWith(
        "ON COMMENT RATED:", "Comment has no uid; leaving the summary alone:", commentPath()
      );
    });
  });

  describe("duplicate and out-of-order delivery", () => {
    test("a repeated event changes nothing", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));
      const event = {before: adaComment(), after: adaComment({"student-1": "yes"})};

      await deliver(event);
      const afterFirst = await readSummary();

      jest.clearAllMocks();
      await deliver(event);

      expect(await readSummary()).toEqual(afterFirst);
      // Writing the same values again would leave the same data behind, so the log line is what
      // distinguishes "recognized there was nothing to do" from "did it all over again".
      expect(logger.info).toHaveBeenCalledWith(
        "ON COMMENT RATED:", "Summary already agrees with the comment; nothing to write.", kSummaryPath
      );
    });

    test("a stale event reconciles to the comment without rewinding it", async () => {
      await seedSummary();
      // The rating went yes, then no. Only the later event is delivered first.
      await setComment(adaComment({"student-1": "no"}));
      await deliver({
        before: adaComment({"student-1": "yes"}),
        after: adaComment({"student-1": "no"}),
        time: kLate,
      });

      // The earlier event turns up afterwards.
      await deliver({
        before: adaComment(), after: adaComment({"student-1": "yes"}), time: kEarly,
      });

      const entry = (await readSummary())?.aiAgreements[`${kCommentId}_student-1`];
      expect(entry.value).toBe("no");
      expect(entry.updatedAt).toBe(Date.parse(kLate));
    });

    test("a later event repairs a timestamp left behind by a stale one", async () => {
      await seedSummary();
      // The stale event arrives first and reconciles to the current value, dating it too early.
      await setComment(adaComment({"student-1": "yes"}));
      await deliver({
        before: adaComment(), after: adaComment({"student-1": "yes"}), time: kEarly,
      });
      expect((await readSummary())?.aiAgreements[`${kCommentId}_student-1`].updatedAt)
        .toBe(Date.parse(kEarly));

      // The event that actually set the current value follows, and moves the timestamp forward.
      await deliver({
        before: adaComment({"student-1": "no"}),
        after: adaComment({"student-1": "yes"}),
        time: kLate,
      });

      expect((await readSummary())?.aiAgreements[`${kCommentId}_student-1`].updatedAt)
        .toBe(Date.parse(kLate));
    });

    test("an agreeing stale event does not rewind the timestamp", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));
      // The rating ended up back at "yes", and the event that put it there arrives first.
      await deliver({
        before: adaComment({"student-1": "no"}),
        after: adaComment({"student-1": "yes"}),
        time: kLate,
      });

      // An older event that also says "yes". It agrees with the comment, so it is allowed to
      // repair the timestamp — but only forwards.
      await deliver({
        before: adaComment(), after: adaComment({"student-1": "yes"}), time: kEarly,
      });

      expect((await readSummary())?.aiAgreements[`${kCommentId}_student-1`].updatedAt)
        .toBe(Date.parse(kLate));
    });

    test("a stale event that disagrees with the comment leaves the timestamp alone", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));
      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"}), time: kEarly});

      // This event says the rating became "no", but the comment says "yes", so it is describing a
      // state the comment has already moved on from. It must not date the surviving "yes" to its
      // own time.
      await deliver({
        before: adaComment({"student-1": "yes"}),
        after: adaComment({"student-1": "no"}),
        time: kLate,
      });

      const entry = (await readSummary())?.aiAgreements[`${kCommentId}_student-1`];
      expect(entry.value).toBe("yes");
      expect(entry.updatedAt).toBe(Date.parse(kEarly));
    });

    test("an event that arrives after the comment is deleted resurrects nothing", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));
      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      await deleteComment();
      await deliver({
        before: adaComment(),
        after: adaComment({"student-1": "yes"}),
        time: kLate,
      });

      const summary = await readSummary();
      expect(summary?.aiAgreements).toEqual({});
      expect(summary?.numAiAgreements).toBe(0);
    });
  });

  describe("comment deletion", () => {
    test("removes every entry for the deleted comment and no others", async () => {
      await seedSummary();
      await setComment(adaComment({"student-1": "yes", "student-2": "no"}));
      await deliver({
        before: adaComment(),
        after: adaComment({"student-1": "yes", "student-2": "no"}),
      });
      await setComment(adaComment({"student-3": "yes"}), kOtherCommentId);
      await deliver({
        before: adaComment(),
        after: adaComment({"student-3": "yes"}),
        commentId: kOtherCommentId,
      });

      await deleteComment();
      await deliver({
        before: adaComment({"student-1": "yes", "student-2": "no"}), time: kLate,
      });

      const summary = await readSummary();
      expect(Object.keys(summary?.aiAgreements)).toEqual([`${kOtherCommentId}_student-3`]);
      expect(summary?.numAiAgreements).toBe(1);
      expect(summary?.numAgreements).toBe(1);
    });

    test("removes the version-1 entry of a deleted legacy comment", async () => {
      // A comment from the retired agreeWithAi flow: no ratings map, and an entry keyed by its author.
      await seedSummary({
        numAiAgreements: 1,
        numAgreements: 1,
        aiAgreements: {"student-1": v1Entry("yes")},
      });

      await deliver({
        before: {uid: "student-1", content: "an old comment", agreeWithAi: {version: 1, value: "yes"}},
        time: kLate,
      });

      const summary = await readSummary();
      expect(summary).toBeDefined();
      expect(summary?.aiAgreements).toEqual({});
      expect(summary?.numAiAgreements).toBe(0);
    });

    test("ignores the deletion of a comment that was never rated", async () => {
      await seedSummary({numAiAgreements: 1, numAgreements: 1, aiAgreements: {"student-1": v1Entry("yes")}});
      const before = await readSummary();

      await deliver({before: {uid: "student-9", content: "just a comment"}, time: kLate});

      expect(await readSummary()).toEqual(before);
      // Nothing is logged because the function returns on the deletion filter, before reading
      // anything. Without that, it would reach the transaction and find nothing to do — which
      // leaves the same data behind, so only the absence of a log tells the two apart.
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe("counts", () => {
    test("counts version-1 entries as AI agreements and backfills numAgreements", async () => {
      // A record written before numAgreements existed.
      await seedSummary(
        {numAiAgreements: 1, aiAgreements: {"student-9": v1Entry("yes")}},
        ["numAgreements"]
      );
      await setComment(adaComment({"student-1": "yes"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      const summary = await readSummary();
      expect(summary?.numAiAgreements).toBe(2);
      expect(summary?.numAgreements).toBe(2);
    });

    test("treats an aiAgreements field that is an array as an empty map", async () => {
      // Not reachable from a client — no rule grants `summaries` — but the guard is what stops a
      // malformed record from spreading into entries keyed "0", "1" and counted as agreements.
      await seedSummary({
        numAiAgreements: 1,
        numAgreements: 1,
        aiAgreements: [v1Entry("yes")] as unknown as Data,
      });
      await setComment(adaComment({"student-1": "yes"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      const summary = await readSummary();
      expect(Object.keys(summary?.aiAgreements)).toEqual([`${kCommentId}_student-1`]);
      expect(summary?.numAiAgreements).toBe(1);
      expect(summary?.numAgreements).toBe(1);
    });

    test("handles a summary that has no aiAgreements map at all", async () => {
      await seedSummary({}, ["aiAgreements"]);
      await setComment(adaComment({"student-1": "yes"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      const summary = await readSummary();
      expect(Object.keys(summary?.aiAgreements)).toEqual([`${kCommentId}_student-1`]);
      expect(summary?.numAiAgreements).toBe(1);
    });
  });

  describe("when there is nothing to record against", () => {
    test("logs and skips when the document has no summary, and creates none", async () => {
      await setComment(adaComment({"student-1": "yes"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      const summaries = await firestore().collection("summaries").get();
      expect(summaries.empty).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        "ON COMMENT RATED:",
        "No summary for this document; skipping.",
        {documentKey: kDocumentKey, summaryPath: kSummaryPath}
      );
    });

    test("skips when the parent document has no key", async () => {
      await firestore().doc(`${kRoot}/${kSpace}/documents/${kDocumentId}`).set({context_id: "class-1"});
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      expect((await readSummary())?.aiAgreements).toEqual({});
      expect(logger.info).toHaveBeenCalledWith(
        "ON COMMENT RATED:",
        "No usable document key; nothing to record a rating against:",
        `${kRoot}/${kSpace}/documents/${kDocumentId}`
      );
    });

    test("skips when the parent document's key is not a string", async () => {
      // Metadata documents are writable directly in the open realms, so `key` is not guaranteed to
      // be the type the schema says. Deriving the summary path from a number would throw out of the
      // escaping rather than skip.
      await firestore().doc(`${kRoot}/${kSpace}/documents/${kDocumentId}`).set({key: 1234});
      await seedSummary();
      await setComment(adaComment({"student-1": "yes"}));

      await deliver({before: adaComment(), after: adaComment({"student-1": "yes"})});

      expect((await readSummary())?.aiAgreements).toEqual({});
      expect(logger.info).toHaveBeenCalledWith(
        "ON COMMENT RATED:",
        "No usable document key; nothing to record a rating against:",
        `${kRoot}/${kSpace}/documents/${kDocumentId}`
      );
    });
  });
});
