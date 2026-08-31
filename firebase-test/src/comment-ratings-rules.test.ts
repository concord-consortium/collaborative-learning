import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import firebase from "firebase";
import { kRatingValues } from "../../shared/shared";
import {
  adminWriteDoc, cPath, cProblem, cSection, cUnit, initFirestore, mockTimestamp, network1, noNetwork,
  prepareEachTest, student2Id, studentAuth, studentId, teacher2Auth, teacher2Id, teacher2Name,
  teacherAuth, teacherId, teacherName, tearDownTests, thisClass
} from "./setup-rules-tests";

// The client rates a comment by updating a single dotted key, and toggles a rating off by deleting
// that key (src/hooks/use-update-comment-rating.ts), so these tests write the same way rather than
// through the set-with-merge helpers in setup-rules-tests.
const expectRatingUpdateToSucceed =
  async (db: firebase.firestore.Firestore, docPath: string, update: Record<string, any>) => {
    expect(await assertSucceeds(db.doc(docPath).update(update))).toBeUndefined();
  };
const expectRatingUpdateToFail =
  async (db: firebase.firestore.Firestore, docPath: string, update: Record<string, any>) => {
    expect(await assertFails(db.doc(docPath).update(update))).toBeDefined();
  };

interface IRatingRealm {
  // path of the comment being rated
  commentPath: string;
  // writes the parent document and the comment, starting from the given ratings
  seedComment: (ratings?: Record<string, any>) => Promise<void>;
  // auth of a user rating someone else's comment
  raterAuth: any;
  // the rater's platform user id, which is the key their rating is stored under
  raterId: string;
  // some other user's id, used to check that a rater can't write another user's rating
  otherUserId: string;
  // auth of the user who wrote the comment. They reach these rules through a second path, since
  // isValidCommentUpdateRequest also lets an author edit their own comment.
  authorAuth: any;
  // the author's platform user id
  authorId: string;
}

function testRatingRules(realmName: string, realm: IRatingRealm) {
  const { commentPath, seedComment, raterAuth, raterId, otherUserId, authorAuth, authorId } = realm;

  describe(realmName, () => {
    let db: firebase.firestore.Firestore;

    beforeEach(async () => {
      await prepareEachTest();
      db = initFirestore(raterAuth);
    });

    it.each([...kRatingValues])("a user can rate a comment '%s'", async (value) => {
      await seedComment();
      await expectRatingUpdateToSucceed(db, commentPath, { [`ratings.${raterId}`]: value });
    });

    it("a user can change their own rating to another allowed value", async () => {
      await seedComment({ [raterId]: "yes" });
      await expectRatingUpdateToSucceed(db, commentPath, { [`ratings.${raterId}`]: "no" });
    });

    it("a user can toggle their own rating off by deleting their key", async () => {
      await seedComment({ [raterId]: "yes" });
      await expectRatingUpdateToSucceed(db, commentPath,
        { [`ratings.${raterId}`]: firebase.firestore.FieldValue.delete() });
    });

    it("a user can toggle their own rating off while another user's rating remains", async () => {
      await seedComment({ [raterId]: "yes", [otherUserId]: "no" });
      await expectRatingUpdateToSucceed(db, commentPath,
        { [`ratings.${raterId}`]: firebase.firestore.FieldValue.delete() });
    });

    it("rejects a rating value outside the allowed set", async () => {
      await seedComment();
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: "maybe" });
    });

    it("rejects an empty rating value", async () => {
      await seedComment();
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: "" });
    });

    it("rejects a rating value that isn't a string", async () => {
      await seedComment();
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: 1 });
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: true });
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: { value: "yes" } });
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: ["yes"] });
    });

    it("rejects changing an existing rating of one's own to a disallowed value", async () => {
      await seedComment({ [raterId]: "yes" });
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: "definitely" });
    });

    it("rejects replacing the whole ratings map", async () => {
      await seedComment({ [otherUserId]: "no" });
      await expectRatingUpdateToFail(db, commentPath, { ratings: { [raterId]: "yes" } });
    });

    it("rejects writing another user's rating", async () => {
      await seedComment();
      await expectRatingUpdateToFail(db, commentPath, { [`ratings.${otherUserId}`]: "yes" });
    });

    it("rejects deleting another user's rating", async () => {
      await seedComment({ [otherUserId]: "yes" });
      await expectRatingUpdateToFail(db, commentPath,
        { [`ratings.${otherUserId}`]: firebase.firestore.FieldValue.delete() });
    });

    it("rejects a valid rating that also changes another field", async () => {
      await seedComment();
      await expectRatingUpdateToFail(db, commentPath,
        { [`ratings.${raterId}`]: "yes", content: "A different comment!" });
    });

    // An author can edit their own comment, so their writes can satisfy isValidCommentUpdateRequest
    // without going through the rating rule. Ratings are read-only on that path, which leaves the
    // rating rule as the only way anyone changes them.
    describe("written by the comment's author", () => {
      beforeEach(() => {
        db = initFirestore(authorAuth);
      });

      it("the author can rate their own comment", async () => {
        await seedComment();
        await expectRatingUpdateToSucceed(db, commentPath, { [`ratings.${authorId}`]: "yes" });
      });

      it("rejects a rating value outside the allowed set", async () => {
        await seedComment();
        await expectRatingUpdateToFail(db, commentPath, { [`ratings.${authorId}`]: "bogus" });
      });

      it("rejects writing another user's rating", async () => {
        await seedComment();
        await expectRatingUpdateToFail(db, commentPath, { [`ratings.${raterId}`]: "yes" });
      });

      it("rejects replacing the whole ratings map, dropping another user's rating", async () => {
        await seedComment({ [raterId]: "yes" });
        await expectRatingUpdateToFail(db, commentPath, { ratings: { [authorId]: "yes" } });
      });

      it("the author can still edit their own comment", async () => {
        await seedComment({ [raterId]: "yes" });
        await expectRatingUpdateToSucceed(db, commentPath, { content: "A different comment!" });
      });

      it("rejects an edit that carries a rating change with it", async () => {
        await seedComment();
        await expectRatingUpdateToFail(db, commentPath,
          { [`ratings.${authorId}`]: "yes", content: "A different comment!" });
      });
    });
  });
}

describe("Firestore security rules for comment ratings", () => {

  afterAll(async () => {
    await tearDownTests();
  });

  // A student in the class rates a teacher's comment on a document in that class.
  const kDocumentDocPath = "authed/myPortal/documents/myDocument";
  testRatingRules("document comment ratings", {
    commentPath: `${kDocumentDocPath}/comments/myComment`,
    raterAuth: studentAuth,
    raterId: studentId,
    otherUserId: student2Id,
    authorAuth: teacherAuth,
    authorId: teacherId,
    seedComment: async (ratings?: Record<string, any>) => {
      await adminWriteDoc(kDocumentDocPath, {
        context_id: thisClass, network: noNetwork, uid: teacherId, type: "problemDocument",
        key: "my-document", createdAt: mockTimestamp()
      });
      await adminWriteDoc(`${kDocumentDocPath}/comments/myComment`, {
        uid: teacherId, name: teacherName, network: noNetwork, content: "A comment!",
        createdAt: mockTimestamp(), ...(ratings ? { ratings } : {})
      });
    }
  });

  // A teacher in the document's network rates another teacher's comment on a curriculum document.
  // Only teachers with access to the curriculum document can rate its comments.
  const kCurriculumDocPath = "authed/myPortal/curriculum/myCurriculum";
  testRatingRules("curriculum comment ratings", {
    commentPath: `${kCurriculumDocPath}/comments/myComment`,
    raterAuth: teacher2Auth,
    raterId: teacher2Id,
    otherUserId: teacherId,
    authorAuth: teacherAuth,
    authorId: teacherId,
    seedComment: async (ratings?: Record<string, any>) => {
      await adminWriteDoc(kCurriculumDocPath, {
        uid: teacherId, unit: cUnit, problem: cProblem, section: cSection, path: cPath,
        network: network1
      });
      // teacher 2 reaches the document through the network it belongs to
      await adminWriteDoc(`authed/myPortal/users/${teacher2Id}`, {
        uid: teacher2Id, name: teacher2Name, type: "teacher", networks: [network1]
      });
      await adminWriteDoc(`${kCurriculumDocPath}/comments/myComment`, {
        uid: teacherId, name: teacherName, network: network1, content: "A comment!",
        createdAt: mockTimestamp(), ...(ratings ? { ratings } : {})
      });
    }
  });
});
