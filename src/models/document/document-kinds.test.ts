import { GroupDocument, PersonalDocument } from "./document-types";
import { getDocumentKindInfo, registerDocumentKind } from "./document-kinds";

describe("document kinds registry", () => {
  it("resolves the built-in group kind as concurrent", () => {
    expect(getDocumentKindInfo(GroupDocument)?.concurrent).toBe(true);
  });

  it("returns undefined for unregistered or missing kinds", () => {
    expect(getDocumentKindInfo(PersonalDocument)).toBeUndefined();
    expect(getDocumentKindInfo(undefined)).toBeUndefined();
    expect(getDocumentKindInfo(null)).toBeUndefined();
  });

  it("registerDocumentKind adds new kinds", () => {
    registerDocumentKind({ kind: "test-word-wall", concurrent: true });
    expect(getDocumentKindInfo("test-word-wall")?.concurrent).toBe(true);
  });
});
