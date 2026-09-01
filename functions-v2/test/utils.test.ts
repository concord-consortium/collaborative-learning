import {escapeKey} from "../../shared/shared";
import {getSummaryPath} from "../src/utils";

describe("getSummaryPath", () => {
  it("builds the path from the realm root, the space, and the document key", () => {
    expect(getSummaryPath("authed", "learn_concord_org", "-M4iVnDvBGGuAA-kCFqK"))
      .toBe("summaries/authed-learn_concord_org--M4iVnDvBGGuAA-kCFqK");
    expect(getSummaryPath("demo", "CLUE", "-M4iVnDvBGGuAA-kCFqK"))
      .toBe("summaries/demo-CLUE--M4iVnDvBGGuAA-kCFqK");
  });

  // Real document keys are Firebase push ids, so escaping is a guard rather than a transformation.
  it("leaves a Firebase push key alone", () => {
    const pushKey = "-OaB_cd12EFghIJ-klmn";
    expect(escapeKey(pushKey)).toBe(pushKey);
    expect(getSummaryPath("qa", "qa1", pushKey)).toBe(`summaries/qa-qa1-${pushKey}`);
  });

  // A Firestore document id cannot contain a slash. The other five characters `escapeKey` rewrites
  // are legal in an id, but rewriting them too keeps this id consistent with every other escaped
  // key in the codebase.
  it("escapes the characters escapeKey rewrites, so a key with a slash cannot break the id", () => {
    expect(getSummaryPath("authed", "learn_concord_org", "msa/1/2"))
      .toBe("summaries/authed-learn_concord_org-msa_1_2");
    expect(getSummaryPath("authed", "learn_concord_org", "a.b$c[d]e#f"))
      .toBe("summaries/authed-learn_concord_org-a_b_c_d_e_f");
  });

  /*
   * The retired `onDocumentSummarized` derived the id from the metadata document's id instead of
   * its `key` field. On a document created by the current code the two agree, so this helper
   * addresses the same record the old function wrote.
   */
  it("matches the retired id scheme for a metadata document created by the current code", () => {
    const root = "authed";
    const space = "learn_concord_org";
    const key = "-M4iVnDvBGGuAA-kCFqK";
    // The id createFirestoreMetadataDocumentIfNecessaryWithoutValidation gives a new document...
    const metadataDocumentId = escapeKey(key);
    // ...and `summaries/${root}-${space}-${documentId}`, the path onDocumentSummarized built from
    // it. Written out rather than derived, so a change to either half shows up here.
    const retiredPath = `summaries/${root}-${space}-${metadataDocumentId}`;

    expect(retiredPath).toBe("summaries/authed-learn_concord_org--M4iVnDvBGGuAA-kCFqK");
    expect(getSummaryPath(root, space, key)).toBe(retiredPath);
  });

  /*
   * On a legacy metadata document the id and the key disagree, which is why both writers derive the
   * path from `key`. That property belongs to the callers, not to this helper — it only ever
   * receives a key, so no implementation of it could get this wrong. It is covered where it can
   * fail: `on-comment-rated.test.ts` runs every case with a metadata document whose id differs from
   * its key, so a trigger reaching for the id would find no summary and record nothing.
   *
   * What that means for data already stored: a record the old function wrote under a legacy
   * prefixed id is not the record this helper addresses, so it is simply never found. The rating
   * trigger logs and skips, and the next analysis run creates a record at the key-derived id.
   * Nothing is migrated, and nothing needs to be — the collection holds one demo record.
   */
});
