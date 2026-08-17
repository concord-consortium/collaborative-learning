import {AiAgreement} from "../src/on-document-summarized";
import {AgreementValue} from "../../shared/shared";
import {mapRelatedSummaries, RelatedSummarySource} from "../lib/src/ai-categorize-document";

jest.mock("firebase-functions/logger");

function agreement(value: AgreementValue, content = "a comment", tags: string[] = []): AiAgreement {
  return {version: 1, value, content, tags};
}

describe("mapRelatedSummaries", () => {
  it("returns each found document's own summary", () => {
    const docs: RelatedSummarySource[] = [
      {summary: "Summary of related document ONE", aiAgreements: {c1: agreement("yes")}},
      {summary: "Summary of related document TWO", aiAgreements: {c2: agreement("no")}},
    ];

    const result = mapRelatedSummaries(docs);

    expect(result.map((entry) => entry.summary)).toEqual([
      "Summary of related document ONE",
      "Summary of related document TWO",
    ]);
  });

  it("groups agreements by value with their content and tags", () => {
    const docs: RelatedSummarySource[] = [{
      summary: "A related summary",
      aiAgreements: {
        c1: agreement("yes", "spot on", ["user"]),
        c2: agreement("yes", "agreed"),
        c3: agreement("notSure", "hmm"),
      },
    }];

    const [entry] = mapRelatedSummaries(docs);

    expect(entry.agreements.yes).toEqual([
      {content: "spot on", tags: ["user"]},
      {content: "agreed", tags: []},
    ]);
    expect(entry.agreements.notSure).toEqual([{content: "hmm", tags: []}]);
    expect(entry.agreements.no).toBeUndefined();
  });

  it("skips documents with no aiAgreements map, but keeps an empty one", () => {
    const docs: RelatedSummarySource[] = [
      {summary: "No agreements here"},
      {summary: "Empty agreements", aiAgreements: {}},
      {summary: "Has agreements", aiAgreements: {c1: agreement("yes")}},
    ];

    // Matches the original behavior: an empty map yields an entry with no grouped agreements.
    expect(mapRelatedSummaries(docs).map((entry) => entry.summary)).toEqual([
      "Empty agreements",
      "Has agreements",
    ]);
  });

  it("skips documents whose summary is missing, non-string, or empty", () => {
    const docs: RelatedSummarySource[] = [
      {aiAgreements: {c1: agreement("yes")}},
      {summary: 42, aiAgreements: {c1: agreement("yes")}},
      {summary: "", aiAgreements: {c1: agreement("yes")}},
      {summary: "The only usable one", aiAgreements: {c1: agreement("yes")}},
    ];

    expect(mapRelatedSummaries(docs).map((entry) => entry.summary)).toEqual(["The only usable one"]);
  });

  it("returns an empty list for no documents", () => {
    expect(mapRelatedSummaries([])).toEqual([]);
  });
});
